-- =====================================================================
-- v3.20.0 · El MVP lo vota el equipo
-- · Al guardar el acta se abre sola la votación del MVP del partido, hasta
--   las 23:59 (hora de Madrid) de ese día. También la puede abrir un gestor a
--   mano (si no hay acta, con los convocados que dijeron «Voy»).
-- · Se vota a uno de los que jugaron. Vota cualquier persona activa de la app,
--   una vez (se puede cambiar hasta el cierre) y nunca a sí misma.
-- · El voto es secreto: nadie ve quién ha votado a quién, y el recuento no se
--   ve hasta el cierre.
-- · Al cerrar: gana el más votado. Si hay empate, el que más goles marcó en el
--   partido; si sigue el empate, lo decide un gestor (permiso de Partidos).
-- · El ganador pasa a ser el MVP oficial (matches.mvp_player_id): imagen del
--   resultado, estadísticas y cromos. El acta ya no pide MVP.
-- =====================================================================

create table public.mvp_polls (
  match_id    uuid primary key references public.matches (id) on delete cascade,
  candidates  uuid[] not null,                          -- players.id que se pueden votar
  closes_at   timestamptz not null,
  opened_by   uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  closed_at   timestamptz,                              -- cuándo se hizo el recuento
  winner_id   uuid references public.players (id) on delete set null,
  tie_ids     uuid[],                                   -- empate sin resolver: decide un gestor
  picked_by   uuid references public.profiles (id) on delete set null
);
create index mvp_polls_open_idx on public.mvp_polls (closes_at) where closed_at is null;

create table public.mvp_votes (
  match_id     uuid not null references public.mvp_polls (match_id) on delete cascade,
  voter_id     uuid not null references public.profiles (id) on delete cascade,
  candidate_id uuid not null references public.players (id) on delete cascade,
  voted_at     timestamptz not null default now(),
  primary key (match_id, voter_id)
);
create index mvp_votes_candidate_idx on public.mvp_votes (match_id, candidate_id);

create trigger audit_mvp_polls after insert or update or delete on public.mvp_polls
  for each row execute function public.audit_trigger();

-- Los votos no pasan por la auditoría (son secretos). Solo se tocan con las funciones.
alter table public.mvp_polls enable row level security;
alter table public.mvp_votes enable row level security;
create policy mvp_polls_select on public.mvp_polls for select to authenticated
  using (public.has_perm('matches', 'read'));
grant select on public.mvp_polls to authenticated;
create policy mvp_votes_select on public.mvp_votes for select to authenticated
  using (voter_id = auth.uid());
grant select on public.mvp_votes to authenticated;

-- ---------------------------------------------------------------------
-- Abrir (o, si sigue abierta, actualizar los candidatos al volver a guardar el
-- acta). Devuelve true solo si se acaba de abrir, para mandar el aviso.
-- ---------------------------------------------------------------------
create or replace function public.mvp_open(p_match uuid, p_candidates uuid[], p_closes timestamptz)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_poll public.mvp_polls;
  v_ids uuid[];
begin
  if not public.has_perm('matches', 'update') then
    raise exception 'No tienes permiso para hacer esto' using errcode = '42501';
  end if;
  if not exists (select 1 from public.matches where id = p_match and status = 'played') then
    raise exception 'Primero pon el resultado del partido' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids
    from unnest(coalesce(p_candidates, '{}')) x
   where exists (select 1 from public.players p where p.id = x);
  if cardinality(v_ids) = 0 then
    raise exception 'No hay jugadores para votar: rellena el acta o la convocatoria' using errcode = '22023';
  end if;

  select * into v_poll from public.mvp_polls where match_id = p_match for update;
  if found then
    if v_poll.closed_at is null and v_poll.closes_at > now() then
      update public.mvp_polls set candidates = v_ids where match_id = p_match;
      delete from public.mvp_votes where match_id = p_match and not (candidate_id = any (v_ids));
    end if;
    return false;
  end if;

  if p_closes is null or p_closes <= now() + interval '10 minutes' or p_closes > now() + interval '3 days' then
    raise exception 'Hora de cierre no válida' using errcode = '22023';
  end if;
  insert into public.mvp_polls (match_id, candidates, closes_at, opened_by)
  values (p_match, v_ids, p_closes, auth.uid());
  return true;
end;
$$;
revoke all on function public.mvp_open(uuid, uuid[], timestamptz) from public, anon;
grant execute on function public.mvp_open(uuid, uuid[], timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- Votar (o cambiar el voto).
-- ---------------------------------------------------------------------
create or replace function public.mvp_vote(p_match uuid, p_candidate uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.mvp_polls;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and active) then
    raise exception 'Inicia sesión para votar' using errcode = '42501';
  end if;
  select * into v_poll from public.mvp_polls where match_id = p_match;
  if not found then
    raise exception 'Este partido no tiene votación del MVP' using errcode = 'P0002';
  end if;
  if v_poll.closed_at is not null or v_poll.closes_at <= now() then
    raise exception 'La votación ya está cerrada' using errcode = '42501';
  end if;
  if not (p_candidate = any (v_poll.candidates)) then
    raise exception 'Ese jugador no se puede votar' using errcode = '22023';
  end if;
  if exists (select 1 from public.players where id = p_candidate and user_id = v_uid) then
    raise exception 'No puedes votarte a ti mismo 😉' using errcode = '22023';
  end if;
  insert into public.mvp_votes (match_id, voter_id, candidate_id, voted_at)
  values (p_match, v_uid, p_candidate, now())
  on conflict (match_id, voter_id) do update set candidate_id = excluded.candidate_id, voted_at = excluded.voted_at;
end;
$$;
revoke all on function public.mvp_vote(uuid, uuid) from public, anon;
grant execute on function public.mvp_vote(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Recuento. No hace nada hasta la hora de cierre y solo una vez, así que lo
-- puede llamar cualquiera (la página del partido, Inicio o el cron de la noche).
-- just_closed = true solo para quien hace el recuento (el que manda el aviso).
-- ---------------------------------------------------------------------
create or replace function public.mvp_finish(p_match uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_poll public.mvp_polls;
  v_top int;
  v_ids uuid[];
  v_best int;
  v_winner uuid;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('just_closed', false);
  end if;
  select * into v_poll from public.mvp_polls where match_id = p_match for update;
  if not found or v_poll.closed_at is not null or v_poll.closes_at > now() then
    return jsonb_build_object('just_closed', false);
  end if;

  select max(n) into v_top from (
    select count(*) as n from public.mvp_votes where match_id = p_match group by candidate_id) t;
  if v_top is not null then
    select array_agg(candidate_id) into v_ids from (
      select candidate_id from public.mvp_votes where match_id = p_match
       group by candidate_id having count(*) = v_top) t;
    if cardinality(v_ids) = 1 then
      v_winner := v_ids[1];
    else
      -- Desempate: más goles en el partido
      select max(g) into v_best from (
        select (select count(*) from public.match_goals mg where mg.match_id = p_match and mg.scorer_id = x) as g
          from unnest(v_ids) x) t;
      select array_agg(x) into v_ids from unnest(v_ids) x
       where (select count(*) from public.match_goals mg where mg.match_id = p_match and mg.scorer_id = x) = v_best;
      if cardinality(v_ids) = 1 then v_winner := v_ids[1]; end if;
    end if;
  end if;

  update public.mvp_polls
     set closed_at = now(), winner_id = v_winner,
         tie_ids = case when v_winner is null and v_top is not null then v_ids end
   where match_id = p_match;
  if v_winner is not null then
    update public.matches set mvp_player_id = v_winner where id = p_match;
  end if;
  return jsonb_build_object('just_closed', true, 'winner_id', v_winner, 'votes', coalesce(v_top, 0),
                            'tie', v_winner is null and v_top is not null);
end;
$$;
revoke all on function public.mvp_finish(uuid) from public, anon;
grant execute on function public.mvp_finish(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Empate (o nadie votó): lo decide un gestor entre los empatados (o entre
-- todos los candidatos si nadie votó).
-- ---------------------------------------------------------------------
create or replace function public.mvp_pick(p_match uuid, p_player uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_poll public.mvp_polls;
begin
  if not public.has_perm('matches', 'update') then
    raise exception 'No tienes permiso para hacer esto' using errcode = '42501';
  end if;
  select * into v_poll from public.mvp_polls where match_id = p_match for update;
  if not found or v_poll.closed_at is null then
    raise exception 'La votación aún no se ha cerrado' using errcode = '22023';
  end if;
  if v_poll.winner_id is not null then
    raise exception 'Esta votación ya tiene ganador' using errcode = '22023';
  end if;
  if not (p_player = any (coalesce(v_poll.tie_ids, v_poll.candidates))) then
    raise exception 'Elige a uno de los empatados' using errcode = '22023';
  end if;
  update public.mvp_polls set winner_id = p_player, tie_ids = null, picked_by = auth.uid() where match_id = p_match;
  update public.matches set mvp_player_id = p_player where id = p_match;
end;
$$;
revoke all on function public.mvp_pick(uuid, uuid) from public, anon;
grant execute on function public.mvp_pick(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Tablero de un partido: candidatos, mi voto, cuántos han votado y, cuando
-- se cierra, el recuento de cada uno. Nunca dice quién votó a quién.
-- ---------------------------------------------------------------------
create or replace function public.mvp_board(p_match uuid)
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
    'closes_at', v_poll.closes_at,
    'open', not v_closed,
    'counted', v_poll.closed_at is not null,
    'winner_id', v_poll.winner_id,
    'tie_ids', v_poll.tie_ids,
    'picked', v_poll.picked_by is not null,
    'voters', (select count(*) from public.mvp_votes v where v.match_id = p_match),
    'eligible', (select count(*) from public.profiles x where x.active),
    'my_vote', (select v.candidate_id from public.mvp_votes v where v.match_id = p_match and v.voter_id = v_uid),
    'my_player_id', (select p.id from public.players p where p.user_id = v_uid),
    'tally', case when v_closed then coalesce((
        select jsonb_object_agg(candidate_id, n) from (
          select candidate_id, count(*) as n from public.mvp_votes v where v.match_id = p_match group by candidate_id) t),
        '{}'::jsonb) end,
    'candidates', to_jsonb(v_poll.candidates)
  );
end;
$$;
revoke all on function public.mvp_board(uuid) from public, anon;
grant execute on function public.mvp_board(uuid) to authenticated;
