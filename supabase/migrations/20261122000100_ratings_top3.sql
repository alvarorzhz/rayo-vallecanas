-- =====================================================================
-- 4.28.1 · Notas del partido: al cerrar solo se ve la media de los 3 mejores.
-- Los demás siguen saliendo en su sitio (de mejor a peor) pero sin su nota.
-- La votación y lo guardado no cambian, y la media de la temporada
-- (rating_season) sigue usando todas las notas.
--
-- rating_board devuelve, por jugador puntuado:
--   n   cuántas personas le puntuaron
--   pos su puesto en la lista (1, 2, 3…) si tiene media (2 o más notas), si no null
--   avg su media SOLO si está entre los 3 mejores (empates en el 3º, todos); si no null
-- =====================================================================
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
        select jsonb_object_agg(player_id, jsonb_build_object(
                 'n', n,
                 'pos', case when n >= 2 then pos end,
                 'avg', case when n >= 2 and top <= 3 then avg_score end))
          from (
            select t.*,
                   row_number() over (order by (t.n >= 2) desc, t.avg_score desc, t.n desc, t.player_id) as pos,
                   rank() over (order by (t.n >= 2) desc, round(t.avg_score, 1) desc) as top
              from (
                select r.player_id, count(*) as n, round(avg(r.score), 2) as avg_score
                  from public.player_ratings r where r.match_id = p_match group by r.player_id
              ) t
          ) ranked),
        '{}'::jsonb) end
  );
end;
$$;
revoke all on function public.rating_board(uuid) from public, anon;
grant execute on function public.rating_board(uuid) to authenticated;
