-- =====================================================================
-- v3.1.0 · Convocatorias
-- Los gestores eligen a los convocados, la hora y el sitio de quedada y la
-- alineación. Cada jugador responde «Voy», «No voy» o «Duda» desde la app.
-- =====================================================================

create type public.callup_reply as enum ('pending', 'yes', 'no', 'maybe');   -- sin responder, voy, no voy, duda

alter table public.matches
  add column meet_time            time,                                          -- hora de quedada
  add column meet_place           text check (meet_place is null or length(meet_place) <= 120),
  add column callup_notes         text check (callup_notes is null or length(callup_notes) <= 1000),
  add column formation            text check (formation is null or formation ~ '^[1-5](-[1-5]){1,3}$'),  -- «2-3-1» (sin el portero)
  add column callup_published_at  timestamptz,                                   -- null = borrador, solo lo ven los gestores
  add column callup_reminded_at   timestamptz;                                   -- último recordatorio automático

create table public.match_callups (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  player_id   uuid not null references public.players (id) on delete cascade,
  reply       public.callup_reply not null default 'pending',
  reply_note  text check (reply_note is null or length(reply_note) <= 140),
  replied_at  timestamptz,
  replied_by  uuid references public.profiles (id) on delete set null,
  slot        smallint check (slot is null or slot between 1 and 11),           -- alineación: 1 = portero; null = banquillo
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (match_id, player_id),
  unique (match_id, slot)
);
create index match_callups_player_idx on public.match_callups (player_id);

create trigger match_callups_touch before update on public.match_callups
  for each row execute function public.touch_updated_at();
create trigger audit_match_callups after insert or update or delete on public.match_callups
  for each row execute function public.audit_trigger();

alter table public.match_callups enable row level security;
-- La ven todos cuando está publicada; el borrador, solo los gestores
create policy match_callups_select on public.match_callups for select to authenticated
  using (public.has_perm('matches', 'read') and (
    public.has_perm('matches', 'update')
    or exists (select 1 from public.matches m where m.id = match_id and m.callup_published_at is not null)));
create policy match_callups_insert on public.match_callups for insert to authenticated
  with check (public.has_perm('matches', 'update'));
create policy match_callups_update on public.match_callups for update to authenticated
  using (public.has_perm('matches', 'update')) with check (public.has_perm('matches', 'update'));
create policy match_callups_delete on public.match_callups for delete to authenticated
  using (public.has_perm('matches', 'update'));
grant select, insert, update, delete on public.match_callups to authenticated;

-- El jugador responde a su convocatoria (solo a la suya, solo si está publicada y el partido no se ha jugado)
create or replace function public.callup_reply(p_match uuid, p_reply public.callup_reply, p_note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_player uuid;
  v_ok boolean;
begin
  if p_reply = 'pending' then
    raise exception 'Respuesta no válida' using errcode = '22023';
  end if;
  select id into v_player from public.players where user_id = auth.uid();
  if v_player is null then
    raise exception 'No tienes ficha de jugador vinculada' using errcode = '42501';
  end if;
  select m.callup_published_at is not null and m.status in ('scheduled', 'postponed') into v_ok
    from public.matches m where m.id = p_match;
  if not coalesce(v_ok, false) then
    raise exception 'Esta convocatoria ya está cerrada' using errcode = '42501';
  end if;
  update public.match_callups
     set reply = p_reply,
         reply_note = nullif(left(trim(coalesce(p_note, '')), 140), ''),
         replied_at = now(),
         replied_by = auth.uid()
   where match_id = p_match and player_id = v_player;
  if not found then
    raise exception 'No estás convocado para este partido' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.callup_reply(uuid, public.callup_reply, text) from public, anon;
grant execute on function public.callup_reply(uuid, public.callup_reply, text) to authenticated;
