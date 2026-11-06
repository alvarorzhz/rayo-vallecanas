-- =====================================================================
-- Fase 4 · Gestión deportiva (v3.0.0)
-- Calendario de partidos, rivales y resultados. Cada partido pertenece a una
-- temporada (septiembre a agosto, como la plantilla y Finanzas).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permisos: los gestores también pueden eliminar partidos (los creados por error).
-- Los jugadores solo consultan (ya venía así desde la fase 1).
-- ---------------------------------------------------------------------
insert into public.role_permissions (role, module, can_read, can_create, can_update, can_delete)
values ('admin', 'matches', true, true, true, true)
on conflict (role, module) do update set can_read = true, can_create = true, can_update = true, can_delete = true;
insert into public.role_permissions (role, module, can_read, can_create, can_update, can_delete)
values ('player', 'matches', true, false, false, false)
on conflict (role, module) do nothing;

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.match_status as enum ('scheduled', 'played', 'postponed', 'cancelled');  -- pendiente, finalizado, aplazado, suspendido
create type public.match_competition as enum ('league', 'cup', 'friendly', 'tournament');   -- liga, copa, amistoso, torneo

-- ---------------------------------------------------------------------
-- Rivales: lista reutilizable con su escudo y su campo habitual
-- ---------------------------------------------------------------------
create table public.rivals (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(trim(name)) between 1 and 60),
  short_name   text check (short_name is null or length(short_name) <= 4),   -- siglas para el marcador ("ATL")
  color        text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),     -- color del escudo genérico si no hay escudo
  crest_url    text,
  home_venue   text check (home_venue is null or length(home_venue) <= 120),
  home_maps_url text check (home_maps_url is null or home_maps_url ~ '^https://'),
  notes        text check (notes is null or length(notes) <= 1000),
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index rivals_name_uniq on public.rivals (lower(trim(name)));

-- ---------------------------------------------------------------------
-- Partidos
-- ---------------------------------------------------------------------
create table public.matches (
  id             uuid primary key default gen_random_uuid(),
  match_date     date not null,
  kickoff        time,                                                        -- hora del partido (hora de Madrid), si se sabe
  season         text generated always as (public.finance_season(match_date)) stored,
  competition    public.match_competition not null default 'league',
  round          text check (round is null or length(round) <= 40),           -- "Jornada 5", "Octavos"…
  rival_id       uuid not null references public.rivals (id) on delete restrict,
  is_home        boolean not null default true,
  venue          text check (venue is null or length(venue) <= 120),
  maps_url       text check (maps_url is null or maps_url ~ '^https://'),
  status         public.match_status not null default 'scheduled',
  goals_for      smallint check (goals_for is null or goals_for between 0 and 99),
  goals_against  smallint check (goals_against is null or goals_against between 0 and 99),
  notes          text check (notes is null or length(notes) <= 2000),
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Un partido finalizado siempre tiene marcador
  constraint matches_played_score check (status <> 'played' or (goals_for is not null and goals_against is not null))
);
create index matches_season_idx on public.matches (season, match_date);
create index matches_date_idx on public.matches (match_date);
create index matches_rival_idx on public.matches (rival_id);

-- ---------------------------------------------------------------------
-- Disparadores: updated_at y auditoría
-- ---------------------------------------------------------------------
create trigger rivals_touch before update on public.rivals
  for each row execute function public.touch_updated_at();
create trigger matches_touch before update on public.matches
  for each row execute function public.touch_updated_at();
create trigger audit_rivals after insert or update or delete on public.rivals
  for each row execute function public.audit_trigger();
create trigger audit_matches after insert or update or delete on public.matches
  for each row execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- Seguridad a nivel de fila
-- ---------------------------------------------------------------------
alter table public.rivals enable row level security;
alter table public.matches enable row level security;

create policy rivals_select on public.rivals for select to authenticated
  using (public.has_perm('matches', 'read'));
create policy rivals_insert on public.rivals for insert to authenticated
  with check (public.has_perm('matches', 'create') or public.has_perm('matches', 'update'));
create policy rivals_update on public.rivals for update to authenticated
  using (public.has_perm('matches', 'update')) with check (public.has_perm('matches', 'update'));
create policy rivals_delete on public.rivals for delete to authenticated
  using (public.has_perm('matches', 'delete'));

create policy matches_select on public.matches for select to authenticated
  using (public.has_perm('matches', 'read'));
create policy matches_insert on public.matches for insert to authenticated
  with check (public.has_perm('matches', 'create'));
create policy matches_update on public.matches for update to authenticated
  using (public.has_perm('matches', 'update')) with check (public.has_perm('matches', 'update'));
create policy matches_delete on public.matches for delete to authenticated
  using (public.has_perm('matches', 'delete'));

grant select, insert, update, delete on public.rivals, public.matches to authenticated;

-- ---------------------------------------------------------------------
-- Escudos de los rivales (públicos, como las fotos). Los suben los gestores.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rival-crests', 'rival-crests', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy rival_crests_select on storage.objects for select to authenticated
  using (bucket_id = 'rival-crests' and public.has_perm('matches', 'update'));
create policy rival_crests_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'rival-crests' and public.has_perm('matches', 'update'));
create policy rival_crests_update on storage.objects for update to authenticated
  using (bucket_id = 'rival-crests' and public.has_perm('matches', 'update'))
  with check (bucket_id = 'rival-crests' and public.has_perm('matches', 'update'));
create policy rival_crests_delete on storage.objects for delete to authenticated
  using (bucket_id = 'rival-crests' and public.has_perm('matches', 'update'));
