-- =====================================================================
-- Altas con contraseña provisional, notificaciones push y copia de seguridad
-- =====================================================================

-- Alta sin email: el usuario debe cambiar la contraseña provisional al entrar
alter table public.profiles add column must_change_password boolean not null default false;
-- Preferencia: avisos de cada venta nueva (solo tiene efecto para quien gestiona sorteos)
alter table public.profiles add column notify_sales boolean not null default true;

-- ---------------------------------------------------------------------
-- Suscripciones push (una por dispositivo)
-- ---------------------------------------------------------------------
create table public.push_subscriptions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_own_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_own_insert on public.push_subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy push_own_update on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_own_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- Claves internas de la app (las claves VAPID del push). Sin políticas: solo el servidor
-- con la clave de servicio puede leerlas o escribirlas.
create table public.app_secrets (
  name        text primary key,
  value       text not null,
  created_at  timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

-- ---------------------------------------------------------------------
-- Copia de seguridad: deja constancia en auditoría (solo superadministradores)
-- ---------------------------------------------------------------------
create or replace function public.log_backup(p_format text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Solo un superadministrador puede descargar la copia de seguridad' using errcode = '42501';
  end if;
  perform public.log_action('BACKUP', 'app', null, jsonb_build_object('format', p_format));
end;
$$;
revoke execute on function public.log_backup(text) from public, anon;
grant execute on function public.log_backup(text) to authenticated;

-- Avisos enviados a mano desde Gestión → Avisos: quedan en auditoría
create or replace function public.log_notice(p_title text, p_body text, p_to text, p_devices int)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not (public.has_perm('users', 'update') or public.has_perm('lottery_admin', 'update')) then
    raise exception 'No tienes permiso para enviar avisos' using errcode = '42501';
  end if;
  perform public.log_action('NOTICE', 'push', null,
    jsonb_build_object('title', p_title, 'body', p_body, 'to', p_to, 'devices', p_devices));
end;
$$;
revoke execute on function public.log_notice(text, text, text, int) from public, anon;
grant execute on function public.log_notice(text, text, text, int) to authenticated;
