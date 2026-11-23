-- =====================================================================
-- 4.29.1 · Votaciones «en directo»
--
-- Al lanzar una votación se elige cuándo se ven los votos (Alvaro, 2026-11-23):
--   · Al cerrar (como siempre, la opción por defecto): mientras está abierta
--     nadie ve qué ha votado cada uno ni el recuento. Solo «han votado X de Y».
--     Quien gestiona las votaciones sigue viendo el recuento y quién falta,
--     para poder recordarlo, pero ya no qué ha votado cada uno hasta el cierre.
--   · En directo: desde el primer voto todos sus destinatarios ven el recuento
--     y quién ha votado qué (si además es voto secreto, solo el recuento).
-- Antes de esta versión, en las votaciones no secretas los nombres se podían
-- ver mientras estaba abierta; ahora eso solo pasa si es «en directo».
-- La regla se aplica aquí, en poll_board(), no solo en la pantalla.
-- Las votaciones ya lanzadas quedan como «al cerrar».
-- =====================================================================

alter table public.polls add column if not exists live boolean not null default false;

create or replace function public.poll_board(p_poll uuid default null, p_limit int default 30)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_mgr boolean := public.can_send_notices();
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.open desc, t.closes_at desc)
    from (
      select
        p.id, p.question, p.details, p.audience, p.anonymous, p.live, p.closes_at, p.created_at, p.reminded_at,
        p.closes_at > now() as open,
        cp.full_name as created_by_name,
        (select count(*) from public.poll_votes v where v.poll_id = p.id)                as votes,
        -- Recuento: al cerrar, en directo o para quien gestiona
        case when p.closes_at <= now() or p.live or v_mgr then
          (select count(*) from public.poll_votes v where v.poll_id = p.id and v.vote) end      as yes,
        case when p.closes_at <= now() or p.live or v_mgr then
          (select count(*) from public.poll_votes v where v.poll_id = p.id and not v.vote) end  as no,
        (select count(*) from public.profiles x
          where x.active and (p.audience = 'all'
                 or (p.audience = 'player' and x.role = 'player')
                 or (p.audience = 'admin' and x.role <> 'player')))                     as eligible,
        (select v.vote from public.poll_votes v where v.poll_id = p.id and v.user_id = v_uid) as my_vote,
        public.poll_for_user(p.audience, v_uid) as can_vote,
        -- Quién ha votado qué: nunca si es secreta; si no, al cerrar o en directo
        case when p.anonymous or (p.closes_at > now() and not p.live) then null else coalesce((
          select jsonb_agg(jsonb_build_object('name', x.full_name, 'vote', v.vote, 'avatar_url', x.avatar_url, 'voted_at', v.voted_at) order by v.voted_at desc)
            from public.poll_votes v join public.profiles x on x.id = v.user_id
           where v.poll_id = p.id), '[]'::jsonb) end as voters,
        -- Quién falta por votar: solo para quien gestiona y si no es secreta
        case when v_mgr and not p.anonymous then coalesce((
          select jsonb_agg(x.full_name order by x.full_name)
            from public.profiles x
           where x.active and (p.audience = 'all'
                  or (p.audience = 'player' and x.role = 'player')
                  or (p.audience = 'admin' and x.role <> 'player'))
             and not exists (select 1 from public.poll_votes v where v.poll_id = p.id and v.user_id = x.id)), '[]'::jsonb) end as missing
      from public.polls p
      left join public.profiles cp on cp.id = p.created_by
      where (p_poll is null or p.id = p_poll)
        and (v_mgr or public.poll_for_user(p.audience, v_uid))
      order by (p.closes_at > now()) desc, p.closes_at desc
      limit greatest(1, least(coalesce(p_limit, 30), 100))
    ) t
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.poll_board(uuid, int) from public, anon;
grant execute on function public.poll_board(uuid, int) to authenticated;

-- Las votaciones que estén abiertas al ejecutar esto pasan a «en directo» (Alvaro, 2026-11-23:
-- quiere ver así la que hay en curso). Desde la app, quien gestiona puede ponerla o quitarla.
update public.polls set live = true where closes_at > now() and not live;
