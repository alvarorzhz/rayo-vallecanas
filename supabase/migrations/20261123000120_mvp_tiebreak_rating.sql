-- =====================================================================
-- 4.28.3 · Empate en el MVP: primero decide la nota del partido.
--
-- Orden para elegir al MVP al cerrar la votación (Alvaro, 2026-11-23):
--   1) más votos;
--   2) si hay empate, la mejor nota media de ESE partido (la misma media que
--      enseña el tablero de notas: solo cuenta si le han puntuado al menos
--      2 personas; quien no llega a 2 notas va detrás de los que sí);
--   3) si sigue el empate, más goles en el partido;
--   4) si aún sigue, lo elige un gestor entre los empatados (mvp_pick), como antes.
--
-- Las notas se cierran a la vez que la votación (mismo closes_at de mvp_polls:
-- rating_set no admite notas después), así que al hacer el recuento ya son
-- las definitivas. La media se compara con 2 decimales, como en rating_board.
-- Solo cambia mvp_finish; mvp_pick y lo demás siguen igual.
-- =====================================================================
create or replace function public.mvp_finish(p_match uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_poll public.mvp_polls;
  v_top int;
  v_ids uuid[];
  v_best int;
  v_best_rating numeric;
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

    -- Desempate 1: la mejor nota media del partido (con 2 notas o más)
    if cardinality(v_ids) > 1 then
      select max(a) into v_best_rating from (
        select round(avg(r.score), 2) as a from public.player_ratings r
         where r.match_id = p_match and r.player_id = any (v_ids)
         group by r.player_id having count(*) >= 2) t;
      if v_best_rating is not null then
        select array_agg(player_id) into v_ids from (
          select r.player_id from public.player_ratings r
           where r.match_id = p_match and r.player_id = any (v_ids)
           group by r.player_id having count(*) >= 2 and round(avg(r.score), 2) = v_best_rating) t;
      end if;
    end if;

    -- Desempate 2: más goles en el partido
    if cardinality(v_ids) > 1 then
      select max(g) into v_best from (
        select (select count(*) from public.match_goals mg where mg.match_id = p_match and mg.scorer_id = x) as g
          from unnest(v_ids) x) t;
      select array_agg(x) into v_ids from unnest(v_ids) x
       where (select count(*) from public.match_goals mg where mg.match_id = p_match and mg.scorer_id = x) = v_best;
    end if;

    if cardinality(v_ids) = 1 then v_winner := v_ids[1]; end if;
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
