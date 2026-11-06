-- =====================================================================
-- Fase 3 · Plantilla (v2.2.0, segunda parte)
-- 1. Permiso de datos personales (squad_private): teléfono, emergencia,
--    nacimiento, observaciones y documentos. Por defecto lo tienen los gestores;
--    se le puede quitar a un gestor concreto. Nunca a los jugadores.
-- 2. Documentos privados por jugador (DNI, ficha federativa, médico...).
-- 3. Cuotas de los jugadores por temporada, cobradas como ingresos de Finanzas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Permiso de datos personales
-- ---------------------------------------------------------------------
insert into public.role_permissions (role, module, can_read, can_create, can_update, can_delete)
values ('admin', 'squad_private', true, true, true, true)
on conflict (role, module) do nothing;

-- Quien ya tenía permisos personalizados de Plantilla con edición, también ve los datos personales
insert into public.user_permissions (user_id, module, can_read, can_create, can_update, can_delete)
select user_id, 'squad_private', can_update, can_update, can_update, can_delete
  from public.user_permissions where module = 'squad'
on conflict (user_id, module) do nothing;

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
  -- Información económica y datos personales de otros: nunca para jugadores (decisión del club)
  if p_module in ('finances', 'squad_private') and v_role = 'player' then
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

drop policy if exists player_private_select on public.player_private;
drop policy if exists player_private_update on public.player_private;
create policy player_private_select on public.player_private for select to authenticated
  using (public.has_perm('squad_private', 'read'));
create policy player_private_update on public.player_private for update to authenticated
  using (public.has_perm('squad_private', 'update')) with check (public.has_perm('squad_private', 'update'));

-- Cumpleaños del mes: solo con permiso de datos personales
create or replace function public.squad_season_stats(p_season text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_perm('squad', 'read') then
    raise exception 'No tienes permiso' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'avg_age', round(avg(extract(year from age(current_date, pp.birth_date)))::numeric, 1),
      'with_birth', count(pp.birth_date),
      'birthdays', case when public.has_perm('squad_private', 'read') then coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'day', extract(day from pp.birth_date)::int)
                     order by extract(day from pp.birth_date))
                     filter (where extract(month from pp.birth_date) = extract(month from current_date)), '[]'::jsonb)
                   else '[]'::jsonb end
    )
    from public.squad_members m
    join public.players p on p.id = m.player_id
    join public.player_private pp on pp.player_id = p.id
    where m.season = p_season and m.status <> 'left'
  );
end;
$$;

-- ¿Es mi ficha? (para que el jugador vea y suba sus propios documentos)
create or replace function public.is_my_player(p_player uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.players where id = p_player and user_id = auth.uid())
$$;
revoke execute on function public.is_my_player(uuid) from public, anon;
grant execute on function public.is_my_player(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Documentos de los jugadores
-- ---------------------------------------------------------------------
create type public.player_doc_kind as enum ('dni', 'federation', 'medical', 'authorization', 'insurance', 'other');

create table public.player_documents (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete cascade,
  kind        public.player_doc_kind not null default 'other',
  title       text check (title is null or length(title) <= 80),
  file_path   text not null unique,            -- en el bucket privado player-docs: {player_id}/{uuid}.{ext}
  file_name   text not null,
  mime_type   text not null,
  size_bytes  int not null check (size_bytes > 0),
  expires_on  date,
  uploaded_by uuid not null default auth.uid() references public.profiles (id),
  created_at  timestamptz not null default now()
);
create index player_documents_player_idx on public.player_documents (player_id);
create index player_documents_expiry_idx on public.player_documents (expires_on) where expires_on is not null;

create trigger audit_player_documents after insert or update or delete on public.player_documents
  for each row execute function public.audit_trigger();

alter table public.player_documents enable row level security;
create policy player_documents_select on public.player_documents for select to authenticated
  using (public.has_perm('squad_private', 'read') or public.is_my_player(player_id));
create policy player_documents_insert on public.player_documents for insert to authenticated
  with check ((public.has_perm('squad_private', 'create') or public.is_my_player(player_id)) and uploaded_by = auth.uid());
create policy player_documents_update on public.player_documents for update to authenticated
  using (public.has_perm('squad_private', 'update')) with check (public.has_perm('squad_private', 'update'));
create policy player_documents_delete on public.player_documents for delete to authenticated
  using (public.has_perm('squad_private', 'delete') or (public.is_my_player(player_id) and uploaded_by = auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-docs', 'player-docs', false, 5242880, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy player_docs_select on storage.objects for select to authenticated
  using (bucket_id = 'player-docs' and (public.has_perm('squad_private', 'read')
         or public.is_my_player(((storage.foldername(name))[1])::uuid)));
create policy player_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'player-docs' and (public.has_perm('squad_private', 'create')
         or public.is_my_player(((storage.foldername(name))[1])::uuid)));
create policy player_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'player-docs' and (public.has_perm('squad_private', 'delete')
         or public.is_my_player(((storage.foldername(name))[1])::uuid)));

-- ---------------------------------------------------------------------
-- 3. Cuotas
-- ---------------------------------------------------------------------
-- Cuota general de cada temporada
create table public.squad_fee_plans (
  season        text primary key check (season ~ '^\d{4}/\d{2}$'),
  amount_cents  bigint not null check (amount_cents >= 0),
  due_on        date,
  notes         text check (notes is null or length(notes) <= 300),
  updated_at    timestamptz not null default now()
);
-- Cuota distinta para un jugador (descuento, exento...)
create table public.squad_fee_overrides (
  season        text not null check (season ~ '^\d{4}/\d{2}$'),
  player_id     uuid not null references public.players (id) on delete cascade,
  amount_cents  bigint not null check (amount_cents >= 0),
  reason        text check (reason is null or length(reason) <= 120),
  updated_at    timestamptz not null default now(),
  primary key (season, player_id)
);
create trigger squad_fee_plans_touch before update on public.squad_fee_plans
  for each row execute function public.touch_updated_at();
create trigger squad_fee_overrides_touch before update on public.squad_fee_overrides
  for each row execute function public.touch_updated_at();
create trigger audit_squad_fee_plans after insert or update or delete on public.squad_fee_plans
  for each row execute function public.audit_trigger();
create trigger audit_squad_fee_overrides after insert or update or delete on public.squad_fee_overrides
  for each row execute function public.audit_trigger();

alter table public.squad_fee_plans enable row level security;
alter table public.squad_fee_overrides enable row level security;
create policy squad_fee_plans_select on public.squad_fee_plans for select to authenticated using (public.has_perm('finances', 'read'));
create policy squad_fee_plans_write on public.squad_fee_plans for all to authenticated
  using (public.has_perm('finances', 'update')) with check (public.has_perm('finances', 'update'));
create policy squad_fee_overrides_select on public.squad_fee_overrides for select to authenticated using (public.has_perm('finances', 'read'));
create policy squad_fee_overrides_write on public.squad_fee_overrides for all to authenticated
  using (public.has_perm('finances', 'update')) with check (public.has_perm('finances', 'update'));

-- Los cobros de cuotas son ingresos de Finanzas enlazados al jugador y a la temporada de la cuota
alter table public.finance_movements
  add column player_id  uuid references public.players (id) on delete restrict,
  add column fee_season text check (fee_season is null or fee_season ~ '^\d{4}/\d{2}$');
alter table public.finance_movements add constraint finance_movements_fee_check
  check (fee_season is null or (player_id is not null and kind = 'income'));
create index finance_movements_player_idx on public.finance_movements (player_id) where player_id is not null;
