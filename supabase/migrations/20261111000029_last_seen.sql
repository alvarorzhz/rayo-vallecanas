-- =====================================================================
-- v3.28.2 · Último acceso y sesiones abiertas que sí se actualizan
-- Hasta ahora:
-- · «Último acceso» salía de auth.users.last_sign_in_at, que Supabase solo
--   cambia al escribir la contraseña o usar un enlace. Con la app instalada
--   la sesión dura semanas, así que se quedaba congelado en el día de entrada.
-- · «Última actividad» de cada sesión salía de auth.sessions, que solo se
--   toca al renovar el token (y no siempre), así que tampoco se movía.
-- Ahora la propia app apunta la última conexión: session_alive(), que ya se
-- llama en cada página, guarda la hora (como mucho una vez por minuto) por
-- persona (user_activity) y por sesión (session_activity).
-- =====================================================================

create table if not exists public.user_activity (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

create table if not exists public.session_activity (
  session_id   uuid primary key references auth.sessions (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.user_activity enable row level security;
alter table public.session_activity enable row level security;
drop policy if exists user_activity_select on public.user_activity;
create policy user_activity_select on public.user_activity for select to authenticated
  using (public.is_superadmin());
drop policy if exists session_activity_select on public.session_activity;
create policy session_activity_select on public.session_activity for select to authenticated
  using (public.is_superadmin());
-- Solo escribe session_alive() (security definer)
revoke insert, update, delete on public.user_activity from anon, authenticated;
revoke insert, update, delete on public.session_activity from anon, authenticated;

-- ¿Sigue abierta la sesión de quien llama? Y, de paso, apunta su última conexión.
-- Antes era «stable» (solo lectura); ahora escribe, así que es volatile.
create or replace function public.session_alive()
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sid uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if v_sid is not null and not exists (select 1 from auth.sessions where id = v_sid) then
    return false;  -- un superadministrador la cerró: la app le saca
  end if;
  if v_uid is not null then
    begin
      insert into public.user_activity as a (user_id, last_seen_at) values (v_uid, now())
      on conflict (user_id) do update set last_seen_at = excluded.last_seen_at
        where a.last_seen_at < now() - interval '1 minute';
      if v_sid is not null then
        insert into public.session_activity as a (session_id, user_id, last_seen_at) values (v_sid, v_uid, now())
        on conflict (session_id) do update set last_seen_at = excluded.last_seen_at
          where a.last_seen_at < now() - interval '1 minute';
      end if;
    exception when others then
      null;  -- apuntar la hora nunca debe impedir usar la app
    end;
  end if;
  return true;
end;
$$;
revoke execute on function public.session_alive() from public, anon;
grant execute on function public.session_alive() to authenticated;

-- Sesiones abiertas, con la última conexión real (la más reciente primero)
create or replace function public.admin_sessions()
returns table (
  id uuid, user_id uuid, full_name text, role text,
  created_at timestamptz, last_seen timestamptz, not_after timestamptz,
  ip text, user_agent text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Solo un superadministrador puede ver las sesiones' using errcode = '42501';
  end if;
  return query
    select s.id, s.user_id, p.full_name, p.role::text,
           s.created_at,
           greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC', sa.last_seen_at) as last_seen,
           s.not_after,
           -- El dispositivo real es el que guardó la app al entrar
           -- (auth.sessions guarda el del servidor de la app, que no sirve)
           a.ip,
           a.user_agent
      from auth.sessions s
      left join public.profiles p on p.id = s.user_id
      left join public.session_activity sa on sa.session_id = s.id
      left join lateral (
        select l.ip, l.user_agent from public.access_log l
         where l.session_id = s.id and l.event in ('login', 'link')
         order by l.created_at desc limit 1
      ) a on true
     where s.not_after is null or s.not_after > now()
     order by last_seen desc nulls last;
end;
$$;
revoke execute on function public.admin_sessions() from public, anon;
grant execute on function public.admin_sessions() to authenticated;
