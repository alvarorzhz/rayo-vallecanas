-- =====================================================================
-- v4.28.0 · Apertura y Clausura en la misma temporada
-- El objetivo «acabar entre los N primeros» se mide en una liga concreta.
-- Hasta ahora se medía siempre con la liga del momento, así que al pasar a la
-- Clausura (otra división) un objetivo del Apertura se volvía a medir con otra
-- tabla. Ahora cada objetivo de puesto guarda su competición, y para la
-- Clausura se puede poner otro aunque sea el mismo número.
--
-- Se puede ejecutar más de una vez sin problema.
-- =====================================================================

alter table public.season_goals add column if not exists league_competition text
  check (league_competition is null or league_competition ~ '^\d{1,9}$');

-- Los objetivos de puesto que ya hay son de la primera liga de su temporada (el Apertura)
-- o, si no se sabe, de la liga configurada ahora.
update public.season_goals g
   set league_competition = coalesce(
         (select c.competition from public.league_competitions c where c.season = g.season order by c.created_at limit 1),
         (select ls.competition from public.league_sync ls where ls.id = 1))
 where g.kind = 'position' and g.league_competition is null;

-- El mismo objetivo puede estar una vez por liga (antes, una vez por temporada)
alter table public.season_goals drop constraint if exists season_goals_season_kind_target_key;
create unique index if not exists season_goals_unique_idx
  on public.season_goals (season, kind, target, coalesce(league_competition, ''));
