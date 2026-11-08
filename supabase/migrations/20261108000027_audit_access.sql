-- =====================================================================
-- v3.21.0 · Auditoría más detallada + historial de accesos y sesiones
-- · access_log: cada entrada, intento fallido, salida, cambio de contraseña
--   y cierre de sesión forzado, con la IP y el dispositivo (navegador).
--   Lo escribe el servidor de la app con la clave de servicio; solo lo lee
--   un superadministrador. No se puede modificar ni borrar desde la app.
-- · admin_sessions(): sesiones abiertas ahora mismo (de auth.sessions),
--   con el dispositivo del inicio de sesión. Solo superadministrador.
-- · admin_close_session(): un superadministrador cierra una sesión (por
--   ejemplo, la de un móvil perdido). Queda en la auditoría.
-- · session_alive(): la app comprueba en cada página que su sesión sigue
--   abierta, para que el cierre forzado sea inmediato.
-- =====================================================================

create table public.access_log (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete set null,
  email       text,                       -- el que se escribió (también en intentos fallidos)
  event       text not null check (event in ('login', 'login_failed', 'link', 'logout', 'password', 'revoked', 'disabled')),
  session_id  uuid,                       -- sesión de Supabase Auth que se abrió/cerró
  ip          text,
  user_agent  text,
  detail      text,
  created_at  timestamptz not null default now()
);
create index access_log_created_idx on public.access_log (created_at desc);
create index access_log_user_idx on public.access_log (user_id, created_at desc);
create index access_log_session_idx on public.access_log (session_id) where session_id is not null;

alter table public.access_log enable row level security;
create policy access_log_select on public.access_log for select to authenticated
  using (public.is_superadmin());
-- Sin políticas de escritura: solo la clave de servicio (servidor) inserta.
revoke insert, update, delete on public.access_log from anon, authenticated;

-- Filtrar la auditoría por persona
create index if not exists audit_log_user_idx on public.audit_log (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Sesiones abiertas
-- ---------------------------------------------------------------------
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
           greatest(s.created_at, s.updated_at, s.refreshed_at at time zone 'UTC') as last_seen,
           s.not_after,
           -- El dispositivo real es el que guardó la app al entrar
           -- (auth.sessions guarda el del servidor de la app, que no sirve)
           a.ip,
           a.user_agent
      from auth.sessions s
      left join public.profiles p on p.id = s.user_id
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

create or replace function public.admin_close_session(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid;
begin
  if not public.is_superadmin() then
    raise exception 'Solo un superadministrador puede cerrar sesiones' using errcode = '42501';
  end if;
  delete from auth.sessions where id = p_id returning user_id into v_user;
  if v_user is null then
    raise exception 'Esa sesión ya no está abierta';
  end if;
  insert into public.access_log (user_id, event, session_id, detail)
  values (v_user, 'revoked', p_id, 'Cerrada por ' || coalesce((select full_name from public.profiles where id = auth.uid()), 'un superadministrador'));
  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (auth.uid(), 'CLOSE_SESSION', 'sessions', p_id::text,
          jsonb_build_object('user_id', v_user, 'full_name', (select full_name from public.profiles where id = v_user)));
end;
$$;
revoke execute on function public.admin_close_session(uuid) from public, anon;
grant execute on function public.admin_close_session(uuid) to authenticated;

-- ¿Sigue abierta la sesión de quien llama? (si se cerró a la fuerza, la app le saca)
create or replace function public.session_alive()
returns boolean
language sql stable security definer set search_path = public
as $$
  select case
    when (auth.jwt() ->> 'session_id') is null then true
    else exists (select 1 from auth.sessions where id = (auth.jwt() ->> 'session_id')::uuid)
  end;
$$;
revoke execute on function public.session_alive() from public, anon;
grant execute on function public.session_alive() to authenticated;
