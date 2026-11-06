-- =====================================================================
-- Fase 2 · Finanzas (v1.7.0)
-- Ingresos, gastos, categorías, saldo inicial, temporadas y justificantes.
-- Los movimientos nunca se borran: se anulan con motivo y quedan en auditoría.
-- El perfil Jugador no puede acceder nunca a Finanzas, aunque tenga permisos personalizados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permisos: los jugadores nunca ven Finanzas; los gestores pueden anular
-- ---------------------------------------------------------------------
create or replace function public.has_perm(p_module public.app_module, p_action public.app_action)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_role public.app_role;
  v_row  record;
begin
  select role into v_role from public.profiles where id = auth.uid() and active;
  if v_role is null then
    return false;
  end if;
  if v_role = 'superadmin' then
    return true;
  end if;
  -- Información económica: nunca para jugadores (decisión del club)
  if p_module = 'finances' and v_role = 'player' then
    return false;
  end if;

  select * into v_row from public.user_permissions where user_id = auth.uid() and module = p_module;
  if not found then
    select * into v_row from public.role_permissions where role = v_role and module = p_module;
    if not found then
      return false;
    end if;
  end if;

  return case p_action
    when 'read'   then v_row.can_read
    when 'create' then v_row.can_create
    when 'update' then v_row.can_update
    when 'delete' then v_row.can_delete
  end;
end;
$$;

insert into public.role_permissions (role, module, can_read, can_create, can_update, can_delete)
values ('admin', 'finances', true, true, true, true)
on conflict (role, module) do update set can_read = true, can_create = true, can_update = true, can_delete = true;
delete from public.role_permissions where role = 'player' and module = 'finances';
delete from public.user_permissions up using public.profiles p
 where up.user_id = p.id and p.role = 'player' and up.module = 'finances';

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create type public.finance_kind as enum ('income', 'expense');

create table public.finance_categories (
  id          uuid primary key default gen_random_uuid(),
  kind        public.finance_kind not null,
  name        text not null check (length(trim(name)) between 1 and 60),
  sort        int not null default 100,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (kind, name)
);

insert into public.finance_categories (kind, name, sort) values
  ('income',  'Cuotas de jugadores', 10),
  ('income',  'Lotería y rifas',     20),
  ('income',  'Patrocinios',         30),
  ('income',  'Premios',             40),
  ('income',  'Colaboraciones',      50),
  ('income',  'Otros ingresos',      90),
  ('expense', 'Equipaciones',        10),
  ('expense', 'Material deportivo',  20),
  ('expense', 'Inscripciones',       30),
  ('expense', 'Arbitrajes',          40),
  ('expense', 'Instalaciones',       50),
  ('expense', 'Desplazamientos',     60),
  ('expense', 'Seguros',             70),
  ('expense', 'Otros gastos',        90);

-- Una sola fila: saldo que había en caja en una fecha. Los movimientos anteriores no cuentan para el saldo.
create table public.finance_settings (
  id                     int primary key default 1 check (id = 1),
  opening_balance_cents  bigint not null default 0,
  opening_date           date not null default date '2026-09-01',
  updated_at             timestamptz not null default now()
);
insert into public.finance_settings (id) values (1);

-- Temporada deportiva de una fecha: de septiembre a agosto ("2026/27")
create or replace function public.finance_season(p_date date)
returns text
language sql immutable
as $$
  select case when extract(month from p_date) >= 9
    then extract(year from p_date)::int || '/' || lpad(((extract(year from p_date)::int + 1) % 100)::text, 2, '0')
    else (extract(year from p_date)::int - 1) || '/' || lpad((extract(year from p_date)::int % 100)::text, 2, '0')
  end
$$;

create table public.finance_movements (
  id               uuid primary key default gen_random_uuid(),
  kind             public.finance_kind not null,
  op_date          date not null default current_date,
  season           text generated always as (public.finance_season(op_date)) stored,
  concept          text not null check (length(trim(concept)) between 1 and 200),
  category_id      uuid not null references public.finance_categories (id),
  amount_cents     bigint not null check (amount_cents > 0),
  method           public.payment_method not null default 'cash',
  counterparty     text,                  -- persona o entidad (ingreso) / proveedor o destinatario (gasto)
  notes            text,
  attachment_path  text,                  -- fichero en el bucket privado finance-docs
  attachment_name  text,
  campaign_id      uuid references public.lottery_campaigns (id) on delete set null,  -- recaudación pasada desde Sorteos
  created_by       uuid not null default auth.uid() references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  voided_at        timestamptz,
  voided_by        uuid references public.profiles (id),
  void_reason      text
);
create index finance_movements_date_idx on public.finance_movements (op_date desc, created_at desc);
create index finance_movements_season_idx on public.finance_movements (season);
create index finance_movements_category_idx on public.finance_movements (category_id);
create index finance_movements_campaign_idx on public.finance_movements (campaign_id) where campaign_id is not null;

-- La categoría tiene que ser del mismo tipo que el movimiento
create or replace function public.finance_movement_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_kind public.finance_kind;
begin
  select kind into v_kind from public.finance_categories where id = new.category_id;
  if v_kind is distinct from new.kind then
    raise exception 'La categoría no corresponde a un %', case new.kind when 'income' then 'ingreso' else 'gasto' end;
  end if;
  if tg_op = 'UPDATE' then
    -- Al eliminar un sorteo, sus movimientos se conservan y solo pierden el enlace
    if new.campaign_id is null and old.campaign_id is not null
       and (to_jsonb(new) - 'campaign_id') = (to_jsonb(old) - 'campaign_id') then
      return new;
    end if;
    if current_setting('rv.finance_void', true) is distinct from '1' then
      if old.voided_at is not null then
        raise exception 'Un movimiento anulado no se puede modificar' using errcode = '42501';
      end if;
      if new.voided_at is distinct from old.voided_at or new.voided_by is distinct from old.voided_by
         or new.void_reason is distinct from old.void_reason then
        raise exception 'Para anular un movimiento usa la opción Anular' using errcode = '42501';
      end if;
    end if;
    if new.kind <> old.kind or new.created_by <> old.created_by or new.created_at <> old.created_at
       or new.campaign_id is distinct from old.campaign_id then
      raise exception 'Ese dato del movimiento no se puede cambiar' using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger finance_movements_guard before insert or update on public.finance_movements
  for each row execute function public.finance_movement_guard();

create trigger finance_movements_no_delete before delete on public.finance_movements
  for each row execute function public.forbid_change();

create trigger audit_finance_movements after insert or update or delete on public.finance_movements
  for each row execute function public.audit_trigger();
create trigger audit_finance_categories after insert or update or delete on public.finance_categories
  for each row execute function public.audit_trigger();
create trigger audit_finance_settings after insert or update or delete on public.finance_settings
  for each row execute function public.audit_trigger();
create trigger finance_settings_touch before update on public.finance_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Seguridad a nivel de fila
-- ---------------------------------------------------------------------
alter table public.finance_categories enable row level security;
alter table public.finance_settings enable row level security;
alter table public.finance_movements enable row level security;

create policy fin_categories_select on public.finance_categories for select to authenticated
  using (public.has_perm('finances', 'read'));
create policy fin_categories_insert on public.finance_categories for insert to authenticated
  with check (public.has_perm('finances', 'update'));
create policy fin_categories_update on public.finance_categories for update to authenticated
  using (public.has_perm('finances', 'update')) with check (public.has_perm('finances', 'update'));

create policy fin_settings_select on public.finance_settings for select to authenticated
  using (public.has_perm('finances', 'read'));
create policy fin_settings_update on public.finance_settings for update to authenticated
  using (public.has_perm('finances', 'update')) with check (public.has_perm('finances', 'update'));

create policy fin_movements_select on public.finance_movements for select to authenticated
  using (public.has_perm('finances', 'read'));
create policy fin_movements_insert on public.finance_movements for insert to authenticated
  with check (public.has_perm('finances', 'create') and created_by = auth.uid() and voided_at is null);
create policy fin_movements_update on public.finance_movements for update to authenticated
  using (public.has_perm('finances', 'update')) with check (public.has_perm('finances', 'update'));

-- ---------------------------------------------------------------------
-- Justificantes y facturas (bucket privado)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('finance-docs', 'finance-docs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create policy finance_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'finance-docs' and public.has_perm('finances', 'read'));
create policy finance_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'finance-docs' and (public.has_perm('finances', 'create') or public.has_perm('finances', 'update')));

-- ---------------------------------------------------------------------
-- Funciones
-- ---------------------------------------------------------------------

-- Anular un movimiento (no se borra nunca)
create or replace function public.finance_void_movement(p_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_perm('finances', 'delete') then
    raise exception 'No tienes permiso para anular movimientos' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo de la anulación';
  end if;
  perform set_config('rv.finance_void', '1', true);
  update public.finance_movements
     set voided_at = now(), voided_by = auth.uid(), void_reason = trim(p_reason)
   where id = p_id and voided_at is null;
  if not found then
    raise exception 'El movimiento no existe o ya estaba anulado';
  end if;
  perform set_config('rv.finance_void', '0', true);
end;
$$;

-- Resumen económico: saldo actual (desde el saldo inicial) y totales del periodo pedido
create or replace function public.finance_summary(p_from date default null, p_to date default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  s public.finance_settings;
  v jsonb;
begin
  if not public.has_perm('finances', 'read') then
    raise exception 'No tienes permiso' using errcode = '42501';
  end if;
  select * into s from public.finance_settings where id = 1;
  select jsonb_build_object(
    'opening_cents', s.opening_balance_cents,
    'opening_date',  s.opening_date,
    'balance_cents', s.opening_balance_cents + coalesce(sum(case kind when 'income' then amount_cents else -amount_cents end)
                       filter (where op_date >= s.opening_date), 0),
    'income_cents',  coalesce(sum(amount_cents) filter (where kind = 'income'
                       and (p_from is null or op_date >= p_from) and (p_to is null or op_date <= p_to)), 0),
    'expense_cents', coalesce(sum(amount_cents) filter (where kind = 'expense'
                       and (p_from is null or op_date >= p_from) and (p_to is null or op_date <= p_to)), 0),
    'count',         count(*) filter (where (p_from is null or op_date >= p_from) and (p_to is null or op_date <= p_to))
  ) into v
  from public.finance_movements where voided_at is null;
  return v;
end;
$$;

-- Temporadas con movimientos (más la actual), para el selector
create or replace function public.finance_seasons()
returns setof text
language sql stable security definer set search_path = public
as $$
  select season from (
    select distinct season from public.finance_movements where public.has_perm('finances', 'read')
    union select public.finance_season(current_date)
  ) t order by season desc
$$;

-- Lo cobrado en un sorteo y lo que ya se ha pasado a Finanzas
create or replace function public.finance_campaign_status(p_campaign_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_perm('finances', 'read') then
    raise exception 'No tienes permiso' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'paid_cents', (select coalesce(sum(paid_cents), 0) from public.lottery_sales
                    where campaign_id = p_campaign_id and cancelled_at is null),
    'transferred_cents', (select coalesce(sum(case kind when 'income' then amount_cents else -amount_cents end), 0)
                    from public.finance_movements where campaign_id = p_campaign_id and voided_at is null),
    'last_at', (select max(created_at) from public.finance_movements where campaign_id = p_campaign_id and voided_at is null)
  );
end;
$$;

-- Pasa a Finanzas lo cobrado en un sorteo que aún no se había pasado (solo la diferencia)
create or replace function public.finance_import_campaign(p_campaign_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  c        public.lottery_campaigns;
  v_paid   bigint;
  v_done   bigint;
  v_diff   bigint;
  v_cat    uuid;
  v_id     uuid;
begin
  if not public.has_perm('finances', 'create') then
    raise exception 'No tienes permiso para apuntar movimientos' using errcode = '42501';
  end if;
  select * into c from public.lottery_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'El sorteo no existe';
  end if;
  select coalesce(sum(paid_cents), 0) into v_paid from public.lottery_sales
   where campaign_id = p_campaign_id and cancelled_at is null;
  select coalesce(sum(case kind when 'income' then amount_cents else -amount_cents end), 0) into v_done
    from public.finance_movements where campaign_id = p_campaign_id and voided_at is null;
  v_diff := v_paid - v_done;
  if v_diff = 0 then
    raise exception 'Todo lo cobrado en este sorteo ya está en Finanzas';
  end if;

  if v_diff > 0 then
    select id into v_cat from public.finance_categories where kind = 'income' and active
     order by (name ilike 'loter%' or name ilike '%rifa%') desc, sort limit 1;
  else
    select id into v_cat from public.finance_categories where kind = 'expense' and active
     order by (name ilike 'otros%') desc, sort limit 1;
  end if;

  insert into public.finance_movements (kind, op_date, concept, category_id, amount_cents, method, counterparty, notes, campaign_id, created_by)
  values (
    case when v_diff > 0 then 'income'::public.finance_kind else 'expense'::public.finance_kind end,
    current_date,
    case when v_diff > 0 then 'Recaudación · ' else 'Devoluciones · ' end || c.name,
    v_cat, abs(v_diff), 'cash', 'Sorteos',
    case when v_done = 0 then 'Pasado desde Sorteos.'
         else 'Pasado desde Sorteos (diferencia con lo ya apuntado: ' || to_char(v_done / 100.0, 'FM999G999G990D00') || ' €).' end,
    p_campaign_id, auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.finance_void_movement(uuid, text) from anon;
revoke execute on function public.finance_summary(date, date) from anon;
revoke execute on function public.finance_seasons() from anon;
revoke execute on function public.finance_campaign_status(uuid) from anon;
revoke execute on function public.finance_import_campaign(uuid) from anon;
