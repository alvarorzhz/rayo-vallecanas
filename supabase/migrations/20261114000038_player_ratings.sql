-- =====================================================================
-- v4.13.0 · Notas de los jugadores en cada partido
-- · Van con la votación del MVP: se abren y se cierran a la vez (mvp_polls).
-- · Cualquier persona activa de la app pone nota del 1 al 10 (con medios
--   puntos) a los que jugaron, menos a sí misma. No hace falta puntuar a todos
--   y se puede cambiar o quitar hasta el cierre.
-- · Son secretas: hasta el cierre cada uno solo ve las suyas y nunca se dice
--   quién puso qué nota.
-- · Al cerrar sale la media de cada jugador, solo si le han puntuado al menos
--   2 personas (un voto suelto no hace media).
-- · rating_season(): la media de la temporada de cada jugador (media de sus
--   medias de partido) para Estadísticas.
-- =====================================================================

create table public.player_ratings (
  match_id   uuid not null references public.mvp_polls (match_id) on delete cascade,
  voter_id   uuid not null references public.profiles (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  score      numeric(3,1) not null check (score between 1 and 10 and score * 2 = trunc(score * 2)),
  rated_at   timestamptz not null default now(),
  primary key (match_id, voter_id, player_id)
);
create index player_ratings_player_idx on public.player_ratings (match_id, player_id);

-- Como los votos del MVP, no pasan por la auditoría (son secretas) y solo se tocan con las funciones.
alter table public.player_ratings enable row level security;
create policy player_ratings_select on public.player_ratings for select to authenticated
  using (voter_id = auth.uid());
grant select on public.player_ratings to authenticated;

-- Si al volver a guardar el acta alguien deja de figurar como que jugó, fuera sus notas.
create or replace function public.player_ratings_sync_candidates()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.player_ratings where match_id = new.match_id and not (player_id = any (new.candidates));
  return new;
end;
$$;
create trigger mvp_polls_ratings_sync after update of candidates on public.mvp_polls
  for each row when (old.candidates is distinct from new.candidates)
  execute function public.player_ratings_sync_candidates();

-- ---------------------------------------------------------------------
-- Poner, cambiar o quitar (p_score = null) la nota de un jugador.
-- ---------------------------------------------------------------------
create or replace function public.rating_set(p_match uuid, p_player uuid, p_score numeric)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.mvp_polls;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and active) then
    raise exception 'Inicia sesión para puntuar' using errcode = '42501';
  end if;
  select * into v_poll from public.mvp_polls where match_id = p_match;
  if not found then
    raise exception 'Este partido no tiene notas abiertas' using errcode = 'P0002';
  end if;
  if v_poll.closed_at is not null or v_poll.closes_at <= now() then
    raise exception 'Las notas ya están cerradas' using errcode = '42501';
  end if;
  if not (p_player = any (v_poll.candidates)) then
    raise exception 'Ese jugador no jugó este partido' using errcode = '22023';
  end if;
  if exists (select 1 from public.players where id = p_player and user_id = v_uid) then
    raise exception 'No puedes ponerte nota a ti mismo 😉' using errcode = '22023';
  end if;
  if p_score is null then
    delete from public.player_ratings where match_id = p_match and voter_id = v_uid and player_id = p_player;
    return;
  end if;
  if p_score < 1 or p_score > 10 or p_score * 2 <> trunc(p_score * 2) then
    raise exception 'La nota va del 1 al 10, de medio en medio punto' using errcode = '22023';
  end if;
  insert into public.player_ratings (match_id, voter_id, player_id, score, rated_at)
  values (p_match, v_uid, p_player, p_score, now())
  on conflict (match_id, voter_id, player_id) do update set score = excluded.score, rated_at = excluded.rated_at;
end;
$$;
revoke all on function public.rating_set(uuid, uuid, numeric) from public, anon;
grant execute on function public.rating_set(uuid, uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- Notas de un partido: las mías, cuántas personas han puntuado y, al cerrar,
-- la media de cada jugador (null si le puntuaron menos de 2) y cuántos le
-- puntuaron. Nunca dice quién puso qué nota.
-- ---------------------------------------------------------------------
create or replace function public.rating_board(p_match uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.mvp_polls;
  v_closed boolean;
begin
  if v_uid is null or not public.has_perm('matches', 'read') then
    return null;
  end if;
  select * into v_poll from public.mvp_polls where match_id = p_match;
  if not found then
    return null;
  end if;
  v_closed := v_poll.closed_at is not null or v_poll.closes_at <= now();
  return jsonb_build_object(
    'match_id', v_poll.match_id,
    'open', not v_closed,
    'raters', (select count(distinct r.voter_id) from public.player_ratings r where r.match_id = p_match),
    'mine', coalesce((select jsonb_object_agg(r.player_id, r.score) from public.player_ratings r
                       where r.match_id = p_match and r.voter_id = v_uid), '{}'::jsonb),
    'averages', case when v_closed then coalesce((
        select jsonb_object_agg(player_id, jsonb_build_object('avg', case when n >= 2 then avg_score end, 'n', n)) from (
          select r.player_id, count(*) as n, round(avg(r.score), 2) as avg_score
            from public.player_ratings r where r.match_id = p_match group by r.player_id) t),
        '{}'::jsonb) end
  );
end;
$$;
revoke all on function public.rating_board(uuid) from public, anon;
grant execute on function public.rating_board(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Media de la temporada de cada jugador: la media de sus notas medias en los
-- partidos ya cerrados (solo los partidos en los que le puntuaron 2 o más).
-- ---------------------------------------------------------------------
create or replace function public.rating_season(p_season text)
returns table (player_id uuid, avg_score numeric, matches int, best numeric)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_perm('matches', 'read') then
    return;
  end if;
  return query
    select t.player_id, round(avg(t.m_avg), 2), count(*)::int, max(t.m_avg)
      from (
        select r.player_id, r.match_id, round(avg(r.score), 2) as m_avg
          from public.player_ratings r
          join public.mvp_polls p on p.match_id = r.match_id
          join public.matches m on m.id = r.match_id
         where m.season = p_season and (p.closed_at is not null or p.closes_at <= now())
         group by r.player_id, r.match_id
        having count(*) >= 2
      ) t
     group by t.player_id;
end;
$$;
revoke all on function public.rating_season(text) from public, anon;
grant execute on function public.rating_season(text) to authenticated;
