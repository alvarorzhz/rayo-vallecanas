-- =====================================================================
-- v4.26.0 · La cápsula del tiempo de la temporada
-- · Un gestor (quien puede preparar la temporada) crea la cápsula de una
--   temporada: hasta cuándo se puede escribir y el día de la gala.
-- · Cada persona activa de la app guarda sus predicciones (máximo goleador,
--   puesto final…) y mensajes (al equipo, a un compañero o a sí mismo).
-- · BAJO LLAVE: hasta que se abre, cada uno solo puede leer lo suyo. Nadie
--   más, tampoco los gestores ni los superadministradores desde la app.
--   Estas tablas no pasan por la auditoría (guardaría el texto) y la copia de
--   seguridad solo se lleva las cápsulas ya abiertas.
-- · Se abre sola el día de la gala, pero nunca antes de que acabe (2 h tras
--   el pitido) el último partido de esa temporada que haya en el calendario.
--   Si luego entran más partidos (el Clausura…), espera a que acaben.
-- =====================================================================

create table if not exists public.time_capsules (
  season           text primary key check (season ~ '^\d{4}/\d{2}$'),
  write_until      timestamptz not null,            -- hasta cuándo se puede escribir
  opens_on         date not null,                   -- día de la gala (ver capsule_opens_at)
  final_position   smallint check (final_position between 1 and 99),  -- puesto final, apuntado al abrirse
  opened_notified  boolean not null default false,  -- ya se avisó al equipo de que se ha abierto
  reminded         boolean not null default false,  -- ya se recordó a los que no han escrito
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists time_capsules_touch on public.time_capsules;
create trigger time_capsules_touch before update on public.time_capsules
  for each row execute function public.touch_updated_at();

-- Momento en que se abre la cápsula de una temporada (hora de Madrid)
create or replace function public.capsule_opens_at(p_season text)
returns timestamptz
language sql stable security definer set search_path = public
as $$
  select greatest(
    (c.opens_on::timestamp) at time zone 'Europe/Madrid',
    coalesce((
      select max(((m.match_date + coalesce(m.kickoff, time '20:00'))::timestamp at time zone 'Europe/Madrid') + interval '2 hours')
        from public.matches m
       where m.season = c.season and m.status <> 'cancelled'
    ), '-infinity'::timestamptz)
  )
  from public.time_capsules c where c.season = p_season;
$$;

create or replace function public.capsule_is_open(p_season text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.capsule_opens_at(p_season) <= now(), false);
$$;

create or replace function public.capsule_writable(p_season text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.time_capsules c where c.season = p_season and c.write_until > now())
     and not public.capsule_is_open(p_season);
$$;

revoke execute on function public.capsule_opens_at(text) from public, anon;
revoke execute on function public.capsule_is_open(text) from public, anon;
revoke execute on function public.capsule_writable(text) from public, anon;
grant execute on function public.capsule_opens_at(text) to authenticated, service_role;
grant execute on function public.capsule_is_open(text) to authenticated, service_role;
grant execute on function public.capsule_writable(text) to authenticated, service_role;

-- Guardas al crear/cambiar/borrar una cápsula
create or replace function public.time_capsules_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.capsule_predictions where season = old.season)
       or exists (select 1 from public.capsule_messages where season = old.season) then
      raise exception 'La cápsula ya tiene mensajes guardados: no se puede borrar' using errcode = '22023';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if new.season <> old.season then
      raise exception 'No se puede cambiar la temporada de la cápsula' using errcode = '22023';
    end if;
    -- Ya abierta, solo cambian las marcas internas (puesto final, avisos)
    if public.capsule_is_open(old.season)
       and (new.write_until <> old.write_until or new.opens_on <> old.opens_on) then
      raise exception 'La cápsula ya está abierta' using errcode = '22023';
    end if;
  end if;
  if new.opens_on < (new.write_until at time zone 'Europe/Madrid')::date then
    raise exception 'La gala no puede ser antes de que se cierre la cápsula' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists time_capsules_guard on public.time_capsules;
create trigger time_capsules_guard before insert or update or delete on public.time_capsules
  for each row execute function public.time_capsules_guard();

alter table public.time_capsules enable row level security;
drop policy if exists time_capsules_select on public.time_capsules;
create policy time_capsules_select on public.time_capsules for select to authenticated using (true);
drop policy if exists time_capsules_write on public.time_capsules;
create policy time_capsules_write on public.time_capsules for all to authenticated
  using ((select public.has_perm('squad', 'create'))) with check ((select public.has_perm('squad', 'create')));
grant select, insert, update, delete on public.time_capsules to authenticated;

drop trigger if exists audit_time_capsules on public.time_capsules;
create trigger audit_time_capsules after insert or update or delete on public.time_capsules
  for each row execute function public.audit_trigger();

-- Predicciones: una respuesta por pregunta (un jugador o un número)
create table if not exists public.capsule_predictions (
  season      text not null references public.time_capsules (season) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  question    text not null check (question in ('top_scorer', 'top_assists', 'top_mvp', 'top_apps', 'top_cards', 'position', 'goals_for', 'wins')),
  player_id   uuid references public.players (id) on delete cascade,
  number      smallint check (number between 0 and 999),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (season, user_id, question),
  check ((player_id is null) <> (number is null))
);
create index if not exists capsule_predictions_user_idx on public.capsule_predictions (user_id);

drop trigger if exists capsule_predictions_touch on public.capsule_predictions;
create trigger capsule_predictions_touch before update on public.capsule_predictions
  for each row execute function public.touch_updated_at();

-- Mensajes: al equipo (to_player_id null) o a un jugador (también a uno mismo)
create table if not exists public.capsule_messages (
  id            uuid primary key default gen_random_uuid(),
  season        text not null references public.time_capsules (season) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  to_player_id  uuid references public.players (id) on delete set null,
  body          text not null check (length(trim(body)) between 1 and 800),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists capsule_messages_season_idx on public.capsule_messages (season, created_at);
create index if not exists capsule_messages_user_idx on public.capsule_messages (user_id);

drop trigger if exists capsule_messages_touch on public.capsule_messages;
create trigger capsule_messages_touch before update on public.capsule_messages
  for each row execute function public.touch_updated_at();

-- Bajo llave: lo tuyo siempre; lo de los demás, solo con la cápsula abierta. Sin excepciones por perfil.
alter table public.capsule_predictions enable row level security;
alter table public.capsule_messages enable row level security;
drop policy if exists capsule_predictions_select on public.capsule_predictions;
create policy capsule_predictions_select on public.capsule_predictions for select to authenticated
  using (user_id = (select auth.uid()) or public.capsule_is_open(season));
drop policy if exists capsule_messages_select on public.capsule_messages;
create policy capsule_messages_select on public.capsule_messages for select to authenticated
  using (user_id = (select auth.uid()) or public.capsule_is_open(season));
-- Solo se escriben con las funciones de abajo
grant select on public.capsule_predictions to authenticated;
grant select on public.capsule_messages to authenticated;

create or replace function public.capsule_check_writer(p_season text)
returns uuid
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and active) then
    raise exception 'No tienes permiso para hacer esto' using errcode = '42501';
  end if;
  if not exists (select 1 from public.time_capsules where season = p_season) then
    raise exception 'No hay cápsula del tiempo para esa temporada' using errcode = '22023';
  end if;
  if not public.capsule_writable(p_season) then
    raise exception 'La cápsula ya está cerrada: no se puede escribir' using errcode = '22023';
  end if;
  return v_uid;
end;
$$;
revoke execute on function public.capsule_check_writer(text) from public, anon, authenticated;

-- Guardar (o borrar, con los dos valores null) una predicción
create or replace function public.capsule_predict(p_season text, p_question text, p_player uuid, p_number int)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public.capsule_check_writer(p_season);
begin
  if p_player is null and p_number is null then
    delete from public.capsule_predictions where season = p_season and user_id = v_uid and question = p_question;
    return;
  end if;
  if p_player is not null and not exists (select 1 from public.players where id = p_player) then
    raise exception 'Ese jugador no existe' using errcode = '22023';
  end if;
  if p_number is not null and p_number not between 0 and 999 then
    raise exception 'Número no válido' using errcode = '22023';
  end if;
  insert into public.capsule_predictions (season, user_id, question, player_id, number)
  values (p_season, v_uid, p_question, p_player, case when p_player is null then p_number end)
  on conflict (season, user_id, question) do update set player_id = excluded.player_id, number = excluded.number;
end;
$$;
revoke execute on function public.capsule_predict(text, text, uuid, int) from public, anon;
grant execute on function public.capsule_predict(text, text, uuid, int) to authenticated;

-- Escribir un mensaje nuevo (p_id null) o cambiar uno tuyo. Como mucho 12 por persona y temporada.
create or replace function public.capsule_message_save(p_season text, p_id uuid, p_to uuid, p_body text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := public.capsule_check_writer(p_season);
  v_id uuid;
begin
  if p_body is null or length(trim(p_body)) not between 1 and 800 then
    raise exception 'El mensaje tiene que tener entre 1 y 800 letras' using errcode = '22023';
  end if;
  if p_to is not null and not exists (select 1 from public.players where id = p_to) then
    raise exception 'Ese jugador no existe' using errcode = '22023';
  end if;
  if p_id is null then
    if (select count(*) from public.capsule_messages where season = p_season and user_id = v_uid) >= 12 then
      raise exception 'Ya has guardado 12 mensajes en esta cápsula' using errcode = '22023';
    end if;
    insert into public.capsule_messages (season, user_id, to_player_id, body)
    values (p_season, v_uid, p_to, trim(p_body)) returning id into v_id;
    return v_id;
  end if;
  update public.capsule_messages set to_player_id = p_to, body = trim(p_body)
   where id = p_id and season = p_season and user_id = v_uid returning id into v_id;
  if v_id is null then
    raise exception 'Ese mensaje no es tuyo' using errcode = '42501';
  end if;
  return v_id;
end;
$$;
revoke execute on function public.capsule_message_save(text, uuid, uuid, text) from public, anon;
grant execute on function public.capsule_message_save(text, uuid, uuid, text) to authenticated;

create or replace function public.capsule_message_delete(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_season text;
begin
  select season into v_season from public.capsule_messages where id = p_id and user_id = auth.uid();
  if v_season is null then
    raise exception 'Ese mensaje no es tuyo' using errcode = '42501';
  end if;
  perform public.capsule_check_writer(v_season);
  delete from public.capsule_messages where id = p_id;
end;
$$;
revoke execute on function public.capsule_message_delete(uuid) from public, anon;
grant execute on function public.capsule_message_delete(uuid) to authenticated;

-- Cuántos han escrito ya (solo números: nunca el contenido ni quién)
create or replace function public.capsule_counts(p_season text)
returns table (writers int, messages int, predictions int)
language sql stable security definer set search_path = public
as $$
  select
    (select count(distinct u)::int from (
       select user_id u from public.capsule_predictions where season = p_season
       union select user_id from public.capsule_messages where season = p_season) x),
    (select count(*)::int from public.capsule_messages where season = p_season),
    (select count(*)::int from public.capsule_predictions where season = p_season);
$$;
revoke execute on function public.capsule_counts(text) from public, anon;
grant execute on function public.capsule_counts(text) to authenticated, service_role;
