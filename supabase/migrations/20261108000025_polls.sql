-- =====================================================================
-- v3.17.0 · Votaciones sí/no
-- · Quien puede mandar avisos (permiso de Usuarios o de Sorteos para editar)
--   lanza una pregunta de sí o no a todo el equipo, solo a los jugadores o
--   solo a los gestores, con una hora de cierre. Sale un aviso al móvil con
--   los botones «Sí» y «No».
-- · Cada persona vota una vez y puede cambiar su voto hasta el cierre.
-- · Votación abierta: los destinatarios ven quién ha votado qué. Voto secreto:
--   nadie lo ve (ni los gestores), solo el recuento. Los votos no pasan por
--   la auditoría para que el voto secreto lo sea de verdad.
-- · Registro de avisos enviados (push_log): cada aviso que sale al móvil,
--   automático o manual, para verlo en Gestión → Avisos. Se guardan 90 días.
-- =====================================================================

create table public.polls (
  id          uuid primary key default gen_random_uuid(),
  question    text not null check (length(trim(question)) between 3 and 140),
  details     text check (details is null or length(details) <= 500),
  audience    text not null default 'all' check (audience in ('all', 'player', 'admin')),
  anonymous   boolean not null default false,
  closes_at   timestamptz not null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  reminded_at timestamptz
);
create index polls_closes_idx on public.polls (closes_at desc);

create table public.poll_votes (
  poll_id    uuid not null references public.polls (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  vote       boolean not null,                    -- true = sí, false = no
  voted_at   timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create trigger polls_touch before update on public.polls
  for each row execute function public.touch_updated_at();
create trigger audit_polls after insert or update or delete on public.polls
  for each row execute function public.audit_trigger();

-- ¿Puede lanzar votaciones? Lo mismo que para mandar avisos.
create or replace function public.can_send_notices()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_perm('users', 'update') or public.has_perm('lottery_admin', 'update');
$$;
revoke all on function public.can_send_notices() from public, anon;
grant execute on function public.can_send_notices() to authenticated;

-- ¿Va dirigida a esta persona? (según su rol base)
create or replace function public.poll_for_user(p_audience text, p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = p_user and p.active
       and (p_audience = 'all'
            or (p_audience = 'player' and p.role = 'player')
            or (p_audience = 'admin' and p.role <> 'player')));
$$;
revoke all on function public.poll_for_user(text, uuid) from public, anon, authenticated;

create or replace function public.poll_for_me(p_audience text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.poll_for_user(p_audience, auth.uid());
$$;
revoke all on function public.poll_for_me(text) from public, anon;
grant execute on function public.poll_for_me(text) to authenticated;

alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;
-- La ven sus destinatarios y quien las gestiona
create policy polls_select on public.polls for select to authenticated
  using (public.can_send_notices() or public.poll_for_me(audience));
create policy polls_insert on public.polls for insert to authenticated
  with check (public.can_send_notices());
create policy polls_update on public.polls for update to authenticated
  using (public.can_send_notices()) with check (public.can_send_notices());
create policy polls_delete on public.polls for delete to authenticated
  using (public.can_send_notices());
grant select, insert, update, delete on public.polls to authenticated;

-- Cada uno ve solo su voto; los recuentos y los nombres salen de poll_board()
create policy poll_votes_select on public.poll_votes for select to authenticated
  using (user_id = auth.uid());
grant select on public.poll_votes to authenticated;

-- ---------------------------------------------------------------------
-- Votar. poll_cast hace las comprobaciones; lo usan poll_vote (desde la app)
-- y el botón del aviso del móvil (servidor, con la clave de servicio).
-- ---------------------------------------------------------------------
create or replace function public.poll_cast(p_user uuid, p_poll uuid, p_vote boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_poll public.polls;
begin
  if p_vote is null then
    raise exception 'Voto no válido' using errcode = '22023';
  end if;
  select * into v_poll from public.polls where id = p_poll;
  if not found then
    raise exception 'Esta votación ya no existe' using errcode = 'P0002';
  end if;
  if v_poll.closes_at <= now() then
    raise exception 'La votación ya está cerrada' using errcode = '42501';
  end if;
  if not public.poll_for_user(v_poll.audience, p_user) then
    raise exception 'Esta votación no va dirigida a ti' using errcode = '42501';
  end if;
  insert into public.poll_votes (poll_id, user_id, vote, voted_at)
  values (p_poll, p_user, p_vote, now())
  on conflict (poll_id, user_id) do update set vote = excluded.vote, voted_at = excluded.voted_at;
end;
$$;
revoke all on function public.poll_cast(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.poll_cast(uuid, uuid, boolean) to service_role;

create or replace function public.poll_vote(p_poll uuid, p_vote boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para votar' using errcode = '42501';
  end if;
  perform public.poll_cast(auth.uid(), p_poll, p_vote);
end;
$$;
revoke all on function public.poll_vote(uuid, boolean) from public, anon;
grant execute on function public.poll_vote(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Tablero: las votaciones que ve el usuario, con recuento, su voto y, si no
-- es secreta, quién ha votado qué. p_poll = una sola; null = las últimas.
-- ---------------------------------------------------------------------
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
        p.id, p.question, p.details, p.audience, p.anonymous, p.closes_at, p.created_at, p.reminded_at,
        p.closes_at > now() as open,
        cp.full_name as created_by_name,
        (select count(*) from public.poll_votes v where v.poll_id = p.id and v.vote)     as yes,
        (select count(*) from public.poll_votes v where v.poll_id = p.id and not v.vote) as no,
        (select count(*) from public.profiles x
          where x.active and (p.audience = 'all'
                 or (p.audience = 'player' and x.role = 'player')
                 or (p.audience = 'admin' and x.role <> 'player')))                     as eligible,
        (select v.vote from public.poll_votes v where v.poll_id = p.id and v.user_id = v_uid) as my_vote,
        public.poll_for_user(p.audience, v_uid) as can_vote,
        case when p.anonymous then null else coalesce((
          select jsonb_agg(jsonb_build_object('name', x.full_name, 'vote', v.vote, 'avatar_url', x.avatar_url) order by x.full_name)
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

-- ---------------------------------------------------------------------
-- Registro de avisos enviados. Lo escribe solo el servidor (clave de servicio).
-- ---------------------------------------------------------------------
create table public.push_log (
  id         bigint generated always as identity primary key,
  title      text not null,
  body       text,
  url        text,
  tag        text,
  people     int not null default 0,        -- a cuántas personas iba
  devices    int not null default 0,        -- a cuántos dispositivos llegó
  created_at timestamptz not null default now()
);
create index push_log_created_idx on public.push_log (created_at desc);
alter table public.push_log enable row level security;
create policy push_log_select on public.push_log for select to authenticated
  using (public.can_send_notices());
grant select on public.push_log to authenticated;
grant select, insert, delete on public.push_log to service_role;
