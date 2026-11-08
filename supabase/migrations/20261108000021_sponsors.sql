-- =====================================================================
-- v3.14.0 · Patrocinadores
-- · Fichas de patrocinadores (logo, contacto, nivel) y acuerdos por temporada
--   (dinero, especie o ambos; qué reciben a cambio; contrato en PDF).
-- · Plazos de cobro: cada cobro es un ingreso de Finanzas («Patrocinios»)
--   enlazado a su plazo. Si se anula el movimiento, el plazo vuelve a pendiente.
-- · Importes, contactos y contratos: nunca para jugadores (como Finanzas).
--   Todo el equipo ve solo el nombre, el logo y la web (sponsor_showcase).
-- Requiere haber ejecutado antes 20261108000020_sponsors_module.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permisos: los gestores lo hacen todo; los jugadores, nada (y la BD lo bloquea)
-- ---------------------------------------------------------------------
insert into public.role_permissions (role, module, can_read, can_create, can_update, can_delete)
values ('admin', 'sponsors', true, true, true, true)
on conflict (role, module) do update set can_read = true, can_create = true, can_update = true, can_delete = true;
insert into public.role_permissions (role, module, can_read, can_create, can_update, can_delete)
values ('player', 'sponsors', false, false, false, false)
on conflict (role, module) do nothing;

create or replace function public.user_has_perm(p_user uuid, p_module public.app_module, p_action public.app_action)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_role   public.app_role;
  v_custom uuid;
  v_row    record;
begin
  select role, custom_role_id into v_role, v_custom from public.profiles where id = p_user and active;
  if v_role is null then
    return false;
  end if;
  if v_role = 'superadmin' then
    return true;
  end if;
  -- Auditoría: solo el superadministrador (decisión del club)
  if p_module = 'audit' then
    return false;
  end if;
  -- Información económica, patrocinios y datos personales de otros: nunca para jugadores (decisión del club)
  if p_module in ('finances', 'squad_private', 'sponsors') and v_role = 'player' then
    return false;
  end if;

  select * into v_row from public.user_permissions where user_id = p_user and module = p_module;
  if not found and v_custom is not null then
    select * into v_row from public.custom_role_permissions where role_id = v_custom and module = p_module;
    if not found then
      return false;
    end if;
  elsif not found then
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
revoke execute on function public.user_has_perm(uuid, public.app_module, public.app_action) from public, anon, authenticated;
grant execute on function public.user_has_perm(uuid, public.app_module, public.app_action) to service_role;

-- ---------------------------------------------------------------------
-- Patrocinadores
-- ---------------------------------------------------------------------
create table public.sponsors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) between 2 and 80),
  tier           text not null default 'partner' check (tier in ('main', 'partner')),  -- principal · colaborador
  logo_url       text check (logo_url is null or logo_url ~ '^(/|https://)'),
  website        text check (website is null or website ~ '^https?://'),
  instagram      text check (instagram is null or length(instagram) <= 60),
  contact_name   text check (contact_name is null or length(contact_name) <= 80),
  contact_phone  text check (contact_phone is null or length(contact_phone) <= 30),
  contact_email  text check (contact_email is null or length(contact_email) <= 120),
  notes          text check (notes is null or length(notes) <= 2000),
  active         boolean not null default true,
  sort           int not null default 100,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index sponsors_name_idx on public.sponsors (lower(trim(name)));

-- Acuerdo de una temporada. «Cobrado» y «vencido» se calculan: no se guardan.
create table public.sponsor_agreements (
  id                  uuid primary key default gen_random_uuid(),
  sponsor_id          uuid not null references public.sponsors (id) on delete cascade,
  season              text not null check (season ~ '^\d{4}/\d{2}$'),
  kind                text not null default 'money' check (kind in ('money', 'in_kind', 'mixed')),  -- dinero · especie · ambos
  amount_cents        bigint not null default 0 check (amount_cents >= 0),                          -- parte en dinero
  in_kind             text check (in_kind is null or length(in_kind) <= 500),                       -- qué aporta en especie
  in_kind_value_cents bigint check (in_kind_value_cents is null or in_kind_value_cents >= 0),       -- valor aproximado
  benefits            text check (benefits is null or length(benefits) <= 1000),                    -- qué recibe a cambio
  status              text not null default 'negotiating' check (status in ('negotiating', 'signed', 'cancelled')),
  starts_on           date,
  ends_on             date,
  contract_path       text,                 -- fichero en el bucket privado sponsor-docs
  contract_name       text,
  notes               text check (notes is null or length(notes) <= 2000),
  expiry_reminded_at  timestamptz,          -- último aviso de «vence pronto»
  created_by          uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index sponsor_agreements_sponsor_idx on public.sponsor_agreements (sponsor_id, season desc);
create index sponsor_agreements_season_idx on public.sponsor_agreements (season);

-- Plazos de cobro de la parte en dinero
create table public.sponsor_installments (
  id            uuid primary key default gen_random_uuid(),
  agreement_id  uuid not null references public.sponsor_agreements (id) on delete cascade,
  due_on        date not null,
  amount_cents  bigint not null check (amount_cents > 0),
  reminded_at   timestamptz,               -- último aviso de «plazo sin cobrar»
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index sponsor_installments_agreement_idx on public.sponsor_installments (agreement_id, due_on);

-- El cobro de un plazo es un ingreso de Finanzas enlazado a él (como mucho uno vivo por plazo)
alter table public.finance_movements
  add column sponsor_installment_id uuid references public.sponsor_installments (id) on delete restrict;
create unique index finance_movements_installment_idx on public.finance_movements (sponsor_installment_id)
  where sponsor_installment_id is not null and voided_at is null;
alter table public.finance_movements add constraint finance_movements_installment_check
  check (sponsor_installment_id is null or kind = 'income');

-- El enlace con el plazo no se cambia a mano (solo se pierde al borrar el plazo)
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
    -- Al borrar un plazo de patrocinio con cobros anulados, esos cobros solo pierden el enlace
    -- («season» es una columna generada: en este momento todavía viene vacía)
    if new.sponsor_installment_id is null and old.sponsor_installment_id is not null
       and (to_jsonb(new) - 'sponsor_installment_id' - 'season') = (to_jsonb(old) - 'sponsor_installment_id' - 'season') then
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
       or new.campaign_id is distinct from old.campaign_id
       or new.sponsor_installment_id is distinct from old.sponsor_installment_id then
      raise exception 'Ese dato del movimiento no se puede cambiar' using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger sponsors_touch before update on public.sponsors
  for each row execute function public.touch_updated_at();
create trigger sponsor_agreements_touch before update on public.sponsor_agreements
  for each row execute function public.touch_updated_at();
create trigger sponsor_installments_touch before update on public.sponsor_installments
  for each row execute function public.touch_updated_at();
create trigger audit_sponsors after insert or update or delete on public.sponsors
  for each row execute function public.audit_trigger();
create trigger audit_sponsor_agreements after insert or update or delete on public.sponsor_agreements
  for each row execute function public.audit_trigger();
create trigger audit_sponsor_installments after insert or update or delete on public.sponsor_installments
  for each row execute function public.audit_trigger();

-- Un acuerdo o un plazo con cobros vivos no se borra: primero se anula el cobro en Finanzas
create or replace function public.sponsor_guard_delete()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.finance_movements fm
      join public.sponsor_installments i on i.id = fm.sponsor_installment_id
     where fm.voided_at is null
       and (case when tg_table_name = 'sponsor_installments' then i.id = old.id else i.agreement_id = old.id end)
  ) then
    raise exception 'Tiene cobros apuntados en Finanzas: anúlalos allí antes de borrarlo';
  end if;
  -- Los cobros anulados se desenlazan para poder borrar el plazo (el movimiento se queda en Finanzas)
  update public.finance_movements fm set sponsor_installment_id = null
    from public.sponsor_installments i
   where i.id = fm.sponsor_installment_id
     and (case when tg_table_name = 'sponsor_installments' then i.id = old.id else i.agreement_id = old.id end);
  return old;
end;
$$;
revoke execute on function public.sponsor_guard_delete() from public, anon, authenticated;
create trigger sponsor_agreements_guard_delete before delete on public.sponsor_agreements
  for each row execute function public.sponsor_guard_delete();
create trigger sponsor_installments_guard_delete before delete on public.sponsor_installments
  for each row execute function public.sponsor_guard_delete();

alter table public.sponsors enable row level security;
alter table public.sponsor_agreements enable row level security;
alter table public.sponsor_installments enable row level security;

create policy sponsors_select on public.sponsors for select to authenticated using (public.has_perm('sponsors', 'read'));
create policy sponsors_insert on public.sponsors for insert to authenticated with check (public.has_perm('sponsors', 'create'));
create policy sponsors_update on public.sponsors for update to authenticated
  using (public.has_perm('sponsors', 'update')) with check (public.has_perm('sponsors', 'update'));
create policy sponsors_delete on public.sponsors for delete to authenticated using (public.has_perm('sponsors', 'delete'));

create policy sponsor_agreements_select on public.sponsor_agreements for select to authenticated using (public.has_perm('sponsors', 'read'));
create policy sponsor_agreements_insert on public.sponsor_agreements for insert to authenticated with check (public.has_perm('sponsors', 'create'));
create policy sponsor_agreements_update on public.sponsor_agreements for update to authenticated
  using (public.has_perm('sponsors', 'update')) with check (public.has_perm('sponsors', 'update'));
create policy sponsor_agreements_delete on public.sponsor_agreements for delete to authenticated using (public.has_perm('sponsors', 'delete'));

create policy sponsor_installments_select on public.sponsor_installments for select to authenticated using (public.has_perm('sponsors', 'read'));
create policy sponsor_installments_write on public.sponsor_installments for all to authenticated
  using (public.has_perm('sponsors', 'update')) with check (public.has_perm('sponsors', 'update'));

grant select, insert, update, delete on public.sponsors, public.sponsor_agreements, public.sponsor_installments to authenticated;

-- Dónde se enseñan los logos (lo deciden gestores y superadministradores)
create table public.sponsor_settings (
  id           boolean primary key default true check (id),
  show_home    boolean not null default true,   -- línea discreta al pie de Inicio
  show_result  boolean not null default true,   -- patrocinador principal en la imagen del resultado
  updated_at   timestamptz not null default now()
);
insert into public.sponsor_settings (id) values (true) on conflict do nothing;
create trigger sponsor_settings_touch before update on public.sponsor_settings
  for each row execute function public.touch_updated_at();
create trigger audit_sponsor_settings after insert or update or delete on public.sponsor_settings
  for each row execute function public.audit_trigger();
alter table public.sponsor_settings enable row level security;
create policy sponsor_settings_select on public.sponsor_settings for select to authenticated using (true);
create policy sponsor_settings_update on public.sponsor_settings for update to authenticated
  using (public.has_perm('sponsors', 'update')) with check (public.has_perm('sponsors', 'update'));
grant select, update on public.sponsor_settings to authenticated;

-- Lo que ve todo el equipo: nombre, nivel, logo y web de los patrocinadores activos
create or replace function public.sponsor_showcase()
returns table (id uuid, name text, tier text, logo_url text, website text)
language sql stable security definer set search_path = public
as $$
  select s.id, s.name, s.tier, s.logo_url, s.website
    from public.sponsors s
   where s.active and auth.uid() is not null
   order by (s.tier = 'main') desc, s.sort, s.name
$$;
revoke execute on function public.sponsor_showcase() from public, anon;
grant execute on function public.sponsor_showcase() to authenticated, service_role;

-- Cobros de los plazos (quien ve los patrocinios ve si un plazo está cobrado, aunque no vea Finanzas)
create or replace function public.sponsor_payments(p_agreement_ids uuid[])
returns table (installment_id uuid, movement_id uuid, op_date date, amount_cents bigint, method public.payment_method)
language sql stable security definer set search_path = public
as $$
  select fm.sponsor_installment_id, fm.id, fm.op_date, fm.amount_cents, fm.method
    from public.finance_movements fm
    join public.sponsor_installments i on i.id = fm.sponsor_installment_id
   where public.has_perm('sponsors', 'read')
     and fm.voided_at is null
     and i.agreement_id = any (p_agreement_ids)
$$;
revoke execute on function public.sponsor_payments(uuid[]) from public, anon;
grant execute on function public.sponsor_payments(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Ficheros: logos (públicos, para la imagen del resultado) y contratos (privados)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sponsor-logos', 'sponsor-logos', true, 1048576, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sponsor-docs', 'sponsor-docs', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy sponsor_logos_select on storage.objects for select to authenticated
  using (bucket_id = 'sponsor-logos' and public.has_perm('sponsors', 'update'));
create policy sponsor_logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sponsor-logos' and public.has_perm('sponsors', 'update'));
create policy sponsor_logos_update on storage.objects for update to authenticated
  using (bucket_id = 'sponsor-logos' and public.has_perm('sponsors', 'update'))
  with check (bucket_id = 'sponsor-logos' and public.has_perm('sponsors', 'update'));
create policy sponsor_logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sponsor-logos' and public.has_perm('sponsors', 'update'));

create policy sponsor_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'sponsor-docs' and public.has_perm('sponsors', 'read'));
create policy sponsor_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'sponsor-docs' and public.has_perm('sponsors', 'update'));
create policy sponsor_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'sponsor-docs' and public.has_perm('sponsors', 'update'));

-- ---------------------------------------------------------------------
-- Los patrocinadores actuales del club (logos incluidos en la app)
-- ---------------------------------------------------------------------
insert into public.sponsors (name, tier, logo_url, sort, notes) values
  ('Bar El Barrio', 'main', '/patrocinadores/bar-el-barrio.png', 10, 'Plaza Barcelona, 7.'),
  ('Transportes Joya', 'partner', '/patrocinadores/transportes-joya.png', 20, null),
  ('Granitos Yuste', 'partner', '/patrocinadores/granitos-yuste.png', 30, 'Granitos «Yuste» S.L. · Ctra. Valdelacasa, km 1,300 · 37768 Los Santos (Salamanca).')
on conflict do nothing;
