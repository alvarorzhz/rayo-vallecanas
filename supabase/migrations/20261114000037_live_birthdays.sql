-- =====================================================================
-- v4.12.0 · Acta en vivo y cumpleaños
-- · Acta en vivo: durante el partido, quien lleva el directo apunta goles,
--   asistencias y tarjetas al momento. El marcador se ve en directo en Inicio
--   y, al pitido final, el acta sale ya rellena con lo apuntado.
-- · Cumpleaños: ese día sale una tarjeta en Inicio para felicitar al jugador.
--   Solo se comparte el día y el mes (nunca el año ni la edad).
-- El ciclo de amarillas no necesita nada nuevo: se cuenta con las actas.
-- Se puede ejecutar más de una vez sin problema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Acta en vivo
-- ---------------------------------------------------------------------
alter table public.matches
  add column if not exists live_started_at timestamptz,   -- pitido inicial (primera parte)
  add column if not exists live_second_at  timestamptz;   -- empieza la segunda parte

create table if not exists public.match_live_events (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  -- goal: gol nuestro · goal_against: gol del rival · yellow / red: tarjeta a uno nuestro
  kind        text not null check (kind in ('goal', 'goal_against', 'yellow', 'red')),
  player_id   uuid references public.players (id) on delete set null,   -- goleador o amonestado (null = sin apuntar)
  assist_id   uuid references public.players (id) on delete set null,
  own_goal    boolean not null default false,                           -- gol en propia puerta del rival
  half        smallint check (half in (1, 2)),
  minute      smallint check (minute between 0 and 150),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  check (kind = 'goal' or (assist_id is null and not own_goal)),
  check (kind <> 'goal_against' or player_id is null),
  check (kind not in ('yellow', 'red') or player_id is not null),
  check (not own_goal or player_id is null),
  check (assist_id is null or player_id is null or assist_id <> player_id)
);
create index if not exists match_live_events_match_idx on public.match_live_events (match_id, created_at);

alter table public.match_live_events enable row level security;
drop policy if exists match_live_events_select on public.match_live_events;
create policy match_live_events_select on public.match_live_events for select to authenticated
  using (public.has_perm('matches', 'read'));
drop policy if exists match_live_events_write on public.match_live_events;
create policy match_live_events_write on public.match_live_events for all to authenticated
  using (public.has_perm('matches', 'update')) with check (public.has_perm('matches', 'update'));
grant select, insert, update, delete on public.match_live_events to authenticated;

-- ---------------------------------------------------------------------
-- Cumpleaños
-- ---------------------------------------------------------------------
-- Día y mes de nacimiento de los jugadores de la plantilla de esa temporada (sin bajas).
-- La fecha completa sigue siendo privada: esto solo devuelve día y mes.
create or replace function public.squad_birthdays(p_season text)
returns table (player_id uuid, month int, day int)
language sql stable security definer set search_path = public as $$
  select pp.player_id, extract(month from pp.birth_date)::int, extract(day from pp.birth_date)::int
    from public.player_private pp
    join public.squad_members sm on sm.player_id = pp.player_id and sm.season = p_season and sm.status <> 'left'
   where pp.birth_date is not null
     and auth.uid() is not null
     and public.has_perm('squad', 'read');
$$;
revoke all on function public.squad_birthdays(text) from public, anon;
grant execute on function public.squad_birthdays(text) to authenticated;

-- Felicitaciones: una por persona y cumpleaños
create table if not exists public.birthday_wishes (
  player_id   uuid not null references public.players (id) on delete cascade,
  year        smallint not null check (year between 2024 and 2200),
  user_id     uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (player_id, year, user_id)
);
create index if not exists birthday_wishes_user_idx on public.birthday_wishes (user_id);

alter table public.birthday_wishes enable row level security;
drop policy if exists birthday_wishes_select on public.birthday_wishes;
create policy birthday_wishes_select on public.birthday_wishes for select to authenticated
  using (public.has_perm('squad', 'read'));
drop policy if exists birthday_wishes_insert on public.birthday_wishes;
create policy birthday_wishes_insert on public.birthday_wishes for insert to authenticated
  with check (user_id = auth.uid() and public.has_perm('squad', 'read'));
drop policy if exists birthday_wishes_delete on public.birthday_wishes;
create policy birthday_wishes_delete on public.birthday_wishes for delete to authenticated
  using (user_id = auth.uid());
grant select, insert, delete on public.birthday_wishes to authenticated;

-- Quién ha felicitado (nombre de pila): los jugadores no pueden leer los perfiles de los demás
create or replace function public.birthday_wishers(p_players uuid[], p_year int)
returns table (player_id uuid, user_id uuid, first_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select w.player_id, w.user_id, split_part(p.full_name, ' ', 1), w.created_at
    from public.birthday_wishes w
    join public.profiles p on p.id = w.user_id
   where w.player_id = any (p_players) and w.year = p_year
     and auth.uid() is not null and public.has_perm('squad', 'read')
   order by w.created_at;
$$;
revoke all on function public.birthday_wishers(uuid[], int) from public, anon;
grant execute on function public.birthday_wishers(uuid[], int) to authenticated;
