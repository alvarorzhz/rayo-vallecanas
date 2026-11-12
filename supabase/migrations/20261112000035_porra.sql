-- =====================================================================
-- v4.9.0 · La porra del partido
-- · Antes de cada partido, cada persona activa de la app pone su resultado
--   (goles del Rayo y del rival). Se puede cambiar hasta el pitido inicial
--   (si no se sabe la hora, hasta que empieza el día del partido).
-- · Hasta el cierre cada uno ve solo su pronóstico; después se ven todos.
-- · Los puntos se calculan en la app con el resultado: 3 por clavarlo y 1 por
--   acertar quién gana (o el empate).
-- =====================================================================

create table public.match_predictions (
  match_id       uuid not null references public.matches (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  goals_for      smallint not null check (goals_for between 0 and 30),
  goals_against  smallint not null check (goals_against between 0 and 30),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (match_id, user_id)
);
create index match_predictions_user_idx on public.match_predictions (user_id);

create trigger match_predictions_touch before update on public.match_predictions
  for each row execute function public.touch_updated_at();

-- ¿Sigue abierta la porra de este partido?
create or replace function public.porra_open(p_match uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.matches m
     where m.id = p_match
       and m.status = 'scheduled'
       and ((m.match_date + coalesce(m.kickoff, time '00:00')) at time zone 'Europe/Madrid') > now()
  );
$$;
revoke execute on function public.porra_open(uuid) from public, anon;
grant execute on function public.porra_open(uuid) to authenticated;

-- Los pronósticos no pasan por la auditoría (son un juego). Solo se escriben con la función.
alter table public.match_predictions enable row level security;
create policy match_predictions_select on public.match_predictions for select to authenticated
  using (user_id = auth.uid() or not public.porra_open(match_id));
grant select on public.match_predictions to authenticated;

-- Guardar (o cambiar) mi pronóstico. Con p_for null se borra.
create or replace function public.porra_save(p_match uuid, p_for int, p_against int)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and active) then
    raise exception 'No tienes permiso para hacer esto' using errcode = '42501';
  end if;
  if not public.porra_open(p_match) then
    raise exception 'La porra de este partido ya está cerrada' using errcode = '22023';
  end if;
  if p_for is null then
    delete from public.match_predictions where match_id = p_match and user_id = v_uid;
    return;
  end if;
  if p_for not between 0 and 30 or p_against is null or p_against not between 0 and 30 then
    raise exception 'Resultado no válido' using errcode = '22023';
  end if;
  insert into public.match_predictions (match_id, user_id, goals_for, goals_against)
  values (p_match, v_uid, p_for, p_against)
  on conflict (match_id, user_id) do update set goals_for = excluded.goals_for, goals_against = excluded.goals_against;
end;
$$;
revoke execute on function public.porra_save(uuid, int, int) from public, anon;
grant execute on function public.porra_save(uuid, int, int) to authenticated;
