-- =====================================================================
-- v3.2.0 · Actas y estadísticas automáticas
-- Cada partido jugado tiene su acta: quién jugó (y de titular), los goles con
-- su asistencia, las tarjetas, los goles que encajó el portero y el MVP.
-- Las estadísticas de los cromos salen solas:
--   previas (lo apuntado a mano) + actas + lo que la liga tenga de más.
-- «Lo que la liga tenga de más»: de cada dato se cuenta lo mayor entre la web
-- de la liga y las actas de los partidos de liga, así nunca se suma dos veces.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Acta del partido
-- ---------------------------------------------------------------------
alter table public.matches
  add column mvp_player_id   uuid references public.players (id) on delete set null,
  add column report_saved_at timestamptz,                                              -- null = sin acta
  add column report_by       uuid references public.profiles (id) on delete set null;

-- Quién jugó
create table public.match_appearances (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  started     boolean not null default false,                       -- titular
  goalkeeper  boolean not null default false,                       -- jugó de portero
  conceded    smallint not null default 0 check (conceded between 0 and 99),
  yellows     smallint not null default 0 check (yellows between 0 and 2),
  red         boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (match_id, player_id),
  check (goalkeeper or conceded = 0)
);
create index match_appearances_player_idx on public.match_appearances (player_id);

-- Nuestros goles: autor (null = sin apuntar o en propia puerta del rival) y asistencia
create table public.match_goals (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  scorer_id   uuid references public.players (id) on delete set null,
  assist_id   uuid references public.players (id) on delete set null,
  own_goal    boolean not null default false,                       -- en propia puerta del rival
  sort        smallint not null default 0,
  created_at  timestamptz not null default now(),
  check (assist_id is null or scorer_id is null or assist_id <> scorer_id),
  check (not own_goal or scorer_id is null)
);
create index match_goals_match_idx on public.match_goals (match_id);
create index match_goals_scorer_idx on public.match_goals (scorer_id);
create index match_goals_assist_idx on public.match_goals (assist_id);

create trigger audit_match_appearances after insert or update or delete on public.match_appearances
  for each row execute function public.audit_trigger();
create trigger audit_match_goals after insert or update or delete on public.match_goals
  for each row execute function public.audit_trigger();

alter table public.match_appearances enable row level security;
alter table public.match_goals enable row level security;
create policy match_appearances_select on public.match_appearances for select to authenticated using (public.has_perm('matches', 'read'));
create policy match_appearances_write on public.match_appearances for all to authenticated
  using (public.has_perm('matches', 'update')) with check (public.has_perm('matches', 'update'));
create policy match_goals_select on public.match_goals for select to authenticated using (public.has_perm('matches', 'read'));
create policy match_goals_write on public.match_goals for all to authenticated
  using (public.has_perm('matches', 'update')) with check (public.has_perm('matches', 'update'));
grant select, insert, update, delete on public.match_appearances, public.match_goals to authenticated;

-- ---------------------------------------------------------------------
-- Estadísticas de la liga aparte de las previas
-- Hasta ahora la sincronización escribía sus totales encima de las estadísticas
-- de la temporada. Se pasan a su propia columna y las previas quedan a cero
-- (en esas fichas no había nada apuntado a mano: todo venía de la liga).
-- ---------------------------------------------------------------------
alter table public.squad_members add column league_stats jsonb;

update public.squad_members sm
   set league_stats = jsonb_build_object('apps', sm.apps, 'goals', sm.goals, 'conceded', sm.conceded, 'yellows', sm.yellows, 'reds', sm.reds),
       apps = 0, starts = 0, goals = 0, conceded = 0, yellows = 0, reds = 0
  from public.players p
 where p.id = sm.player_id and p.ext_id is not null
   and sm.starts = 0 and sm.assists = 0 and sm.mvps = 0 and sm.clean_sheets = 0;   -- solo las que tocó la liga

-- ---------------------------------------------------------------------
-- Ficha de temporada con las estadísticas ya sumadas
-- (respeta los permisos de quien consulta: security_invoker)
-- ---------------------------------------------------------------------
create or replace view public.squad_members_full with (security_invoker = true) as
with ap as (
  select a.player_id, m.season,
         count(*)                                                        as apps,
         count(*) filter (where a.started)                               as starts,
         coalesce(sum(a.yellows), 0)                                     as yellows,
         count(*) filter (where a.red)                                   as reds,
         coalesce(sum(a.conceded), 0)                                    as conceded,
         count(*) filter (where a.goalkeeper and a.started and m.goals_against = 0) as clean_sheets,
         count(*) filter (where m.ext_id is not null)                    as lg_apps,
         coalesce(sum(a.yellows) filter (where m.ext_id is not null), 0) as lg_yellows,
         count(*) filter (where a.red and m.ext_id is not null)          as lg_reds,
         coalesce(sum(a.conceded) filter (where m.ext_id is not null), 0) as lg_conceded
    from public.match_appearances a
    join public.matches m on m.id = a.match_id and m.status = 'played'
   group by a.player_id, m.season
), gl as (
  select g.scorer_id as player_id, m.season, count(*) as goals, count(*) filter (where m.ext_id is not null) as lg_goals
    from public.match_goals g
    join public.matches m on m.id = g.match_id and m.status = 'played'
   where g.scorer_id is not null
   group by g.scorer_id, m.season
), asi as (
  select g.assist_id as player_id, m.season, count(*) as assists
    from public.match_goals g
    join public.matches m on m.id = g.match_id and m.status = 'played'
   where g.assist_id is not null
   group by g.assist_id, m.season
), mv as (
  select m.mvp_player_id as player_id, m.season, count(*) as mvps
    from public.matches m
   where m.status = 'played' and m.mvp_player_id is not null
   group by m.mvp_player_id, m.season
)
select sm.id, sm.player_id, sm.season, sm.number, sm.position, sm.status, sm.armband, sm.joined_on, sm.left_on,
       sm.created_at, sm.updated_at,
       (sm.apps + coalesce(ap.apps, 0)
          + greatest(coalesce((sm.league_stats ->> 'apps')::int, 0) - coalesce(ap.lg_apps, 0), 0))::int          as apps,
       (sm.starts + coalesce(ap.starts, 0))::int                                                                 as starts,
       (sm.goals + coalesce(gl.goals, 0)
          + greatest(coalesce((sm.league_stats ->> 'goals')::int, 0) - coalesce(gl.lg_goals, 0), 0))::int        as goals,
       (sm.assists + coalesce(asi.assists, 0))::int                                                              as assists,
       (sm.yellows + coalesce(ap.yellows, 0)
          + greatest(coalesce((sm.league_stats ->> 'yellows')::int, 0) - coalesce(ap.lg_yellows, 0), 0))::int    as yellows,
       (sm.reds + coalesce(ap.reds, 0)
          + greatest(coalesce((sm.league_stats ->> 'reds')::int, 0) - coalesce(ap.lg_reds, 0), 0))::int          as reds,
       (sm.mvps + coalesce(mv.mvps, 0))::int                                                                     as mvps,
       (sm.conceded + coalesce(ap.conceded, 0)
          + greatest(coalesce((sm.league_stats ->> 'conceded')::int, 0) - coalesce(ap.lg_conceded, 0), 0))::int  as conceded,
       (sm.clean_sheets + coalesce(ap.clean_sheets, 0))::int                                                     as clean_sheets
  from public.squad_members sm
  left join ap  on ap.player_id  = sm.player_id and ap.season  = sm.season
  left join gl  on gl.player_id  = sm.player_id and gl.season  = sm.season
  left join asi on asi.player_id = sm.player_id and asi.season = sm.season
  left join mv  on mv.player_id  = sm.player_id and mv.season  = sm.season;

grant select on public.squad_members_full to authenticated;
