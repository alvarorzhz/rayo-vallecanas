-- =====================================================================
-- v4.30.5 · Los fichajes nuevos entran en la convocatoria abierta
-- Al preparar una convocatoria se marca a los jugadores activos de ese momento.
-- Quien se daba de alta después (ficha nueva o vuelta tras una baja) no
-- aparecía en ella y no podía contestar: había que añadirlo a mano.
-- Ahora, al entrar en la plantilla de una temporada como activo, se le
-- añade «sin responder» a las convocatorias abiertas de esa temporada
-- (partido por jugar o aplazado, de hoy en adelante, con convocatoria ya
-- empezada). No toca a nadie que el gestor quitara antes de una convocatoria.
-- =====================================================================

create or replace function public.squad_join_open_callups()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status = 'left') then
    insert into public.match_callups (match_id, player_id)
    select m.id, new.player_id
      from public.matches m
     where m.season = new.season
       and m.status in ('scheduled', 'postponed')
       and m.match_date >= (now() at time zone 'Europe/Madrid')::date
       and exists (select 1 from public.match_callups c where c.match_id = m.id)
    on conflict (match_id, player_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.squad_join_open_callups() from public, anon, authenticated;

drop trigger if exists squad_join_open_callups on public.squad_members;
create trigger squad_join_open_callups after insert or update of status on public.squad_members
  for each row execute function public.squad_join_open_callups();

-- Los que ya se dieron de alta después de abrir una convocatoria que sigue abierta
insert into public.match_callups (match_id, player_id)
select m.id, sm.player_id
  from public.matches m
  join public.squad_members sm on sm.season = m.season and sm.status = 'active'
 where m.status in ('scheduled', 'postponed')
   and m.match_date >= (now() at time zone 'Europe/Madrid')::date
   and sm.created_at > (select min(c.created_at) from public.match_callups c where c.match_id = m.id)
on conflict (match_id, player_id) do nothing;
