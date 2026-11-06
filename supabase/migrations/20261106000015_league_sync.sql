-- =====================================================================
-- v3.0.2 · Sincronizar con la liga (futormes)
-- Los rivales y los partidos importados guardan su identificador en la web
-- de la liga para poder actualizarlos sin duplicarlos.
-- =====================================================================

alter table public.rivals add column ext_id text unique;     -- "futormes:176726"
alter table public.matches add column ext_id text unique;    -- "futormes:1371201"

-- Configuración de la liga (una sola fila)
create table public.league_sync (
  id             smallint primary key default 1 check (id = 1),
  provider       text not null default 'futormes' check (provider in ('futormes')),
  competition    text not null check (competition ~ '^\d{1,9}$'),   -- itm de la competición
  competition_name text check (competition_name is null or length(competition_name) <= 160),
  team           text not null check (team ~ '^\d{1,9}$'),          -- itm de nuestro equipo
  last_synced_at timestamptz,
  last_summary   jsonb,
  updated_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at     timestamptz not null default now()
);
create trigger league_sync_touch before update on public.league_sync
  for each row execute function public.touch_updated_at();
create trigger audit_league_sync after insert or update or delete on public.league_sync
  for each row execute function public.audit_trigger();

alter table public.league_sync enable row level security;
create policy league_sync_select on public.league_sync for select to authenticated
  using (public.has_perm('matches', 'read'));
create policy league_sync_write on public.league_sync for all to authenticated
  using (public.has_perm('matches', 'update')) with check (public.has_perm('matches', 'update'));
grant select, insert, update, delete on public.league_sync to authenticated;

-- Jugadores traídos de la liga (para no duplicarlos al repetir la sincronización)
alter table public.players add column ext_id text unique;          -- "futormes:2830585"
