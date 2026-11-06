-- =====================================================================
-- Fase 3 · Plantilla (v2.0.0, segunda parte)
-- Fútbol 7: posiciones de fútbol 7 y estadísticas de cada jugador por temporada.
-- Las estadísticas las apuntan los gestores; en la fase 4 se calcularán con las actas de los partidos.
-- =====================================================================

-- Posiciones de fútbol 7 (pivote, bandas y mediapunta; sin extremos ni mediocentro de fútbol 11)
update public.squad_members set position = case position
    when 'MC' then 'MCD'
    when 'ED' then 'MD'
    when 'EI' then 'MI'
    else position end
 where position in ('MC', 'ED', 'EI');
alter table public.squad_members drop constraint if exists squad_members_position_check;
alter table public.squad_members add constraint squad_members_position_check
  check (position in ('POR', 'LD', 'DFC', 'LI', 'MCD', 'MD', 'MI', 'MCO', 'DC'));

-- Estadísticas de la temporada
alter table public.squad_members
  add column apps          smallint not null default 0 check (apps >= 0),          -- partidos jugados
  add column starts        smallint not null default 0 check (starts >= 0),        -- de titular
  add column goals         smallint not null default 0 check (goals >= 0),
  add column assists       smallint not null default 0 check (assists >= 0),
  add column yellows       smallint not null default 0 check (yellows >= 0),
  add column reds          smallint not null default 0 check (reds >= 0),
  add column mvps          smallint not null default 0 check (mvps >= 0),          -- mejor jugador del partido
  add column conceded      smallint not null default 0 check (conceded >= 0),      -- porteros: goles encajados
  add column clean_sheets  smallint not null default 0 check (clean_sheets >= 0);  -- porteros: porterías a cero
alter table public.squad_members add constraint squad_members_starts_le_apps check (starts <= apps);
