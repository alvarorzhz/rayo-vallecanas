-- =====================================================================
-- Fase 3 · Plantilla (v2.0.0)
-- Fichas de jugadores (independientes de los usuarios de la app, se pueden
-- vincular), plantilla por temporada (dorsal, posición, estado, capitán)
-- y datos personales visibles solo para gestores y para el propio jugador.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permisos: los gestores también pueden eliminar fichas (las creadas por error)
-- ---------------------------------------------------------------------
insert into public.role_permissions (role, module, can_read, can_create, can_update, can_delete)
values ('admin', 'squad', true, true, true, true)
on conflict (role, module) do update set can_read = true, can_create = true, can_update = true, can_delete = true;
insert into public.role_permissions (role, module, can_read, can_create, can_update, can_delete)
values ('player', 'squad', true, false, false, false)
on conflict (role, module) do nothing;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.squad_status as enum ('active', 'injured', 'away', 'left');  -- activo, lesionado, baja temporal, baja definitiva
create type public.player_foot as enum ('right', 'left', 'both');

-- ---------------------------------------------------------------------
-- Jugadores: datos que ve toda la plantilla
-- ---------------------------------------------------------------------
create table public.players (
  id              uuid primary key default gen_random_uuid(),
  first_name      text not null check (length(trim(first_name)) between 1 and 60),
  last_name       text not null default '' check (length(last_name) <= 80),
  nickname        text check (nickname is null or length(nickname) <= 24),   -- nombre en la camiseta
  photo_url       text,
  foot            public.player_foot,
  height_cm       smallint check (height_cm is null or height_cm between 120 and 230),
  joined_club_on  date,                                                      -- en el club desde
  user_id         uuid unique references public.profiles (id) on delete set null,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index players_name_idx on public.players (first_name, last_name);

-- ---------------------------------------------------------------------
-- Datos personales y observaciones: solo gestores (y el propio jugador, por funciones)
-- ---------------------------------------------------------------------
create table public.player_private (
  player_id        uuid primary key references public.players (id) on delete cascade,
  birth_date       date check (birth_date is null or birth_date between date '1930-01-01' and current_date),
  phone            text check (phone is null or length(phone) <= 30),
  email            text check (email is null or length(email) <= 120),
  emergency_name   text check (emergency_name is null or length(emergency_name) <= 80),
  emergency_phone  text check (emergency_phone is null or length(emergency_phone) <= 30),
  sport_notes      text check (sport_notes is null or length(sport_notes) <= 2000),
  internal_notes   text check (internal_notes is null or length(internal_notes) <= 2000),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Plantilla de cada temporada (septiembre a agosto, "2026/27", igual que Finanzas)
-- ---------------------------------------------------------------------
create table public.squad_members (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.players (id) on delete cascade,
  season      text not null check (season ~ '^\d{4}/\d{2}$'),
  number      smallint check (number is null or number between 1 and 99),
  position    text not null check (position in ('POR','LD','DFC','LI','MCD','MC','MCO','MD','MI','ED','EI','DC')),
  status      public.squad_status not null default 'active',
  armband     text check (armband is null or armband in ('captain', 'vice')),
  joined_on   date,
  left_on     date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (player_id, season)
);
create index squad_members_season_idx on public.squad_members (season);
-- Un dorsal y un brazalete por temporada (los que se han ido dejan libre el suyo)
create unique index squad_members_number_uniq on public.squad_members (season, number)
  where number is not null and status <> 'left';
create unique index squad_members_armband_uniq on public.squad_members (season, armband)
  where armband is not null and status <> 'left';

-- ---------------------------------------------------------------------
-- Disparadores: updated_at, auditoría y foto del usuario vinculado
-- ---------------------------------------------------------------------
create trigger players_touch before update on public.players
  for each row execute function public.touch_updated_at();
create trigger player_private_touch before update on public.player_private
  for each row execute function public.touch_updated_at();
create trigger squad_members_touch before update on public.squad_members
  for each row execute function public.touch_updated_at();

create trigger audit_players after insert or update or delete on public.players
  for each row execute function public.audit_trigger();
create trigger audit_player_private after insert or update or delete on public.player_private
  for each row execute function public.audit_trigger();
create trigger audit_squad_members after insert or update or delete on public.squad_members
  for each row execute function public.audit_trigger();

-- Cada ficha tiene siempre su fila de datos personales
create or replace function public.players_after_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.player_private (player_id) values (new.id) on conflict do nothing;
  return null;
end;
$$;
create trigger players_private_row after insert on public.players
  for each row execute function public.players_after_insert();

-- Al vincular una ficha con un usuario: si la ficha no tiene foto, usa la de su perfil,
-- y completa el teléfono y el email si estaban vacíos
create or replace function public.players_link_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  p public.profiles;
begin
  if new.user_id is not null and new.user_id is distinct from old.user_id then
    select * into p from public.profiles where id = new.user_id;
    if new.photo_url is null then
      new.photo_url := p.avatar_url;
    end if;
    update public.player_private
       set phone = coalesce(phone, p.phone), email = coalesce(email, p.email)
     where player_id = new.id;
  end if;
  return new;
end;
$$;
create trigger players_link before update of user_id on public.players
  for each row execute function public.players_link_user();

-- Cuando un jugador vinculado cambia la foto de su perfil, también cambia la de su ficha
-- (salvo que un gestor le haya puesto otra distinta)
create or replace function public.profiles_sync_player_photo()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.avatar_url is distinct from old.avatar_url then
    update public.players
       set photo_url = new.avatar_url
     where user_id = new.id and (photo_url is null or photo_url = old.avatar_url);
  end if;
  return null;
end;
$$;
create trigger profiles_player_photo after update of avatar_url on public.profiles
  for each row execute function public.profiles_sync_player_photo();

-- ---------------------------------------------------------------------
-- Seguridad a nivel de fila
-- ---------------------------------------------------------------------
alter table public.players enable row level security;
alter table public.player_private enable row level security;
alter table public.squad_members enable row level security;

create policy players_select on public.players for select to authenticated
  using (public.has_perm('squad', 'read'));
create policy players_insert on public.players for insert to authenticated
  with check (public.has_perm('squad', 'create'));
create policy players_update on public.players for update to authenticated
  using (public.has_perm('squad', 'update')) with check (public.has_perm('squad', 'update'));
create policy players_delete on public.players for delete to authenticated
  using (public.has_perm('squad', 'delete'));

-- Datos personales: solo quien puede modificar la plantilla (gestores)
create policy player_private_select on public.player_private for select to authenticated
  using (public.has_perm('squad', 'update'));
create policy player_private_update on public.player_private for update to authenticated
  using (public.has_perm('squad', 'update')) with check (public.has_perm('squad', 'update'));

create policy squad_members_select on public.squad_members for select to authenticated
  using (public.has_perm('squad', 'read'));
create policy squad_members_insert on public.squad_members for insert to authenticated
  with check (public.has_perm('squad', 'create') or public.has_perm('squad', 'update'));
create policy squad_members_update on public.squad_members for update to authenticated
  using (public.has_perm('squad', 'update')) with check (public.has_perm('squad', 'update'));
create policy squad_members_delete on public.squad_members for delete to authenticated
  using (public.has_perm('squad', 'update'));

-- ---------------------------------------------------------------------
-- Fotos de los jugadores (públicas, como las de perfil). Las suben los gestores.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('player-photos', 'player-photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy player_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'player-photos' and public.has_perm('squad', 'update'));
create policy player_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'player-photos' and public.has_perm('squad', 'update'));
create policy player_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'player-photos' and public.has_perm('squad', 'update'))
  with check (bucket_id = 'player-photos' and public.has_perm('squad', 'update'));
create policy player_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'player-photos' and public.has_perm('squad', 'update'));

-- ---------------------------------------------------------------------
-- Funciones para el propio jugador
-- ---------------------------------------------------------------------
-- Mis datos personales (solo los de contacto; nunca las observaciones de los gestores)
create or replace function public.squad_my_private()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'player_id', pp.player_id, 'birth_date', pp.birth_date, 'phone', pp.phone, 'email', pp.email,
    'emergency_name', pp.emergency_name, 'emergency_phone', pp.emergency_phone)
  from public.player_private pp
  join public.players p on p.id = pp.player_id
  where p.user_id = auth.uid()
$$;

-- El jugador corrige sus datos de contacto y el de emergencia
create or replace function public.squad_update_my_contact(
  p_phone text, p_email text, p_emergency_name text, p_emergency_phone text, p_birth_date date default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.players where user_id = auth.uid();
  if v_id is null then
    raise exception 'No tienes ficha de jugador vinculada' using errcode = '42501';
  end if;
  update public.player_private
     set phone = nullif(trim(p_phone), ''),
         email = nullif(lower(trim(p_email)), ''),
         emergency_name = nullif(trim(p_emergency_name), ''),
         emergency_phone = nullif(trim(p_emergency_phone), ''),
         birth_date = coalesce(p_birth_date, birth_date)
   where player_id = v_id;
end;
$$;

-- Edad media (y cumpleaños del mes, para gestores) de la plantilla de una temporada, sin exponer las fechas
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
      -- Cumpleaños del mes: solo para gestores (la fecha de nacimiento es un dato personal)
      'birthdays', case when public.has_perm('squad', 'update') then coalesce(jsonb_agg(jsonb_build_object('player_id', p.id, 'day', extract(day from pp.birth_date)::int)
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

revoke execute on function public.players_after_insert() from public, anon, authenticated;
revoke execute on function public.players_link_user() from public, anon, authenticated;
revoke execute on function public.profiles_sync_player_photo() from public, anon, authenticated;
revoke execute on function public.squad_my_private() from public, anon;
revoke execute on function public.squad_update_my_contact(text, text, text, text, date) from public, anon;
revoke execute on function public.squad_season_stats(text) from public, anon;
grant execute on function public.squad_my_private() to authenticated;
grant execute on function public.squad_update_my_contact(text, text, text, text, date) to authenticated;
grant execute on function public.squad_season_stats(text) to authenticated;
