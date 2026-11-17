-- =====================================================================
-- v4.20.0 · Objetivos de temporada
-- El gestor elige unos objetivos de una lista (puesto en la liga, goles,
-- victorias, rachas, porterías a cero, que juegue toda la plantilla) y la
-- app los mide sola con las actas y la clasificación. Cuando se cumple uno
-- se apunta la fecha (achieved_at) y se avisa al equipo una sola vez.
-- =====================================================================

create table if not exists public.season_goals (
  id           uuid primary key default gen_random_uuid(),
  season       text not null check (season ~ '^\d{4}/\d{2}$'),
  kind         text not null check (kind in ('position', 'goals_for', 'wins', 'win_streak', 'unbeaten_streak', 'clean_sheets', 'all_play')),
  target       int not null check (target between 1 and 999),
  sort         int not null default 100,
  achieved_at  timestamptz,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  unique (season, kind, target)
);
create index if not exists season_goals_season_idx on public.season_goals (season, sort);

alter table public.season_goals enable row level security;
drop policy if exists season_goals_select on public.season_goals;
create policy season_goals_select on public.season_goals for select to authenticated
  using (public.has_perm('matches', 'read'));
drop policy if exists season_goals_write on public.season_goals;
create policy season_goals_write on public.season_goals for all to authenticated
  using (public.has_perm('matches', 'update')) with check (public.has_perm('matches', 'update'));

drop trigger if exists audit_season_goals on public.season_goals;
create trigger audit_season_goals after insert or update or delete on public.season_goals
  for each row execute function public.audit_trigger();
