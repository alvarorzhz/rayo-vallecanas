-- =====================================================================
-- v3.27.0 · Liga reutilizable: histórico por competición
-- Hasta ahora la app solo conocía «la» competición de futormes. Al cambiar de
-- liga (Apertura → siguiente división), los totales de cada jugador se pisaban
-- con los de la nueva y los partidos no decían de qué competición eran.
--
-- Se puede ejecutar más de una vez sin problema.
-- =====================================================================

-- 1) Competiciones que se han sincronizado alguna vez (la actual sigue en league_sync)
create table if not exists public.league_competitions (
  competition     text primary key check (competition ~ '^\d{1,9}$'),   -- itm de la competición
  provider        text not null default 'futormes' check (provider in ('futormes')),
  name            text check (name is null or length(name) <= 160),
  team            text not null check (team ~ '^\d{1,9}$'),             -- itm de nuestro equipo en esa competición
  team_name       text check (team_name is null or length(team_name) <= 120),
  season          text check (season is null or season ~ '^\d{4}/\d{2}$'),
  finished        boolean not null default false,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.league_competitions enable row level security;
drop policy if exists league_competitions_select on public.league_competitions;
create policy league_competitions_select on public.league_competitions for select to authenticated
  using (public.has_perm('matches', 'read'));
drop policy if exists league_competitions_write on public.league_competitions;
create policy league_competitions_write on public.league_competitions for all to authenticated
  using (public.has_perm('matches', 'update')) with check (public.has_perm('matches', 'update'));
grant select, insert, update, delete on public.league_competitions to authenticated;

-- 2) Nombre de nuestro equipo en la liga: sirve para encontrarlo solo en la competición siguiente
alter table public.league_sync add column if not exists team_name text
  check (team_name is null or length(team_name) <= 120);

-- 3) Cada partido de liga sabe de qué competición viene
alter table public.matches add column if not exists league_competition text
  check (league_competition is null or league_competition ~ '^\d{1,9}$');
create index if not exists matches_league_competition_idx on public.matches (league_competition)
  where league_competition is not null;

-- 4) Totales de la liga de cada jugador, separados por competición.
--    league_stats sigue siendo el total de la temporada (la suma), así que la
--    vista de estadísticas no cambia.
alter table public.squad_members add column if not exists league_stats_by jsonb;

-- 5) Lo que ya hay pertenece a la competición configurada ahora
insert into public.league_competitions (competition, name, team, last_synced_at)
select competition, competition_name, team, last_synced_at from public.league_sync where id = 1
on conflict (competition) do nothing;

update public.matches m
   set league_competition = ls.competition
  from public.league_sync ls
 where ls.id = 1 and m.league_competition is null and m.ext_id like 'futormes:%';

update public.league_competitions c
   set season = (select min(m.season) from public.matches m where m.league_competition = c.competition)
 where c.season is null;

update public.squad_members sm
   set league_stats_by = jsonb_build_object(c.competition, sm.league_stats)
  from public.league_competitions c
 where sm.league_stats is not null and sm.league_stats_by is null and c.season = sm.season
   and c.competition = (select competition from public.league_sync where id = 1);
