-- =====================================================================
-- 4.30.7 · Dar de baja a un usuario borrando sus datos personales.
--
-- Hasta ahora un usuario solo se podía deshabilitar: su perfil va unido a ventas,
-- cobros, entregas de material, votos y a la auditoría, así que borrarlo de verdad
-- rompería (o se llevaría por delante) todo eso.
--
-- remove_member(uid) hace la baja definitiva sin romper nada:
--   · el perfil se queda, pero como «Antiguo miembro», sin email, teléfono ni foto,
--     sin acceso (no se puede volver a habilitar) y con la fecha de la baja;
--   · la cuenta de acceso (auth.users) se vacía: email inventado, contraseña
--     imposible, sin datos, bloqueada para siempre y con todas las sesiones cerradas;
--   · se borran sus permisos a medida, avisos push, rastro de conexiones y uso, y
--     el email/teléfono/foto que guardaba la auditoría de su perfil;
--   · su ficha de jugador (si tenía) se queda en la plantilla con sus estadísticas,
--     pero sin su foto y sin enlace a la cuenta.
-- Sus ventas, cobros, apuntes, votos y lo que hizo en la app se conservan a nombre
-- de «Antiguo miembro». No se puede deshacer.
--
-- Puede hacerlo quien tenga permiso de BORRAR usuarios (de serie, solo el
-- superadministrador), nunca sobre sí mismo, y a otro superadministrador solo un
-- superadministrador. La foto (archivos del bucket avatars) la borra la app.
-- =====================================================================

alter table public.profiles add column if not exists removed_at timestamptz;

-- Un usuario dado de baja no vuelve: ni se habilita ni se le quita la marca.
create or replace function public.guard_profile_removed()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.removed_at is not null and (new.removed_at is null or new.active) then
    raise exception 'Este usuario está dado de baja y sus datos se borraron: no se puede volver a habilitar. Dale de alta de nuevo si vuelve.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_profile_removed() from public, anon, authenticated;
drop trigger if exists profiles_removed_guard on public.profiles;
create trigger profiles_removed_guard before update on public.profiles
  for each row execute function public.guard_profile_removed();

create or replace function public.remove_member(p_uid uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_role public.app_role;
  v_removed timestamptz;
  v_by text;
begin
  if auth.uid() is null or not (public.has_perm('users', 'delete') and public.has_perm('users', 'update')) then
    raise exception 'No tienes permiso para dar de baja usuarios' using errcode = '42501';
  end if;
  if p_uid = auth.uid() then
    raise exception 'No puedes darte de baja a ti mismo' using errcode = '42501';
  end if;
  select role, removed_at into v_role, v_removed from public.profiles where id = p_uid;
  if not found then
    raise exception 'Usuario no encontrado';
  end if;
  if v_role = 'superadmin' and not public.is_superadmin() then
    raise exception 'Solo un superadministrador puede dar de baja a otro superadministrador' using errcode = '42501';
  end if;

  -- 1) Perfil: primero la foto (así la ficha de jugador pierde también la misma foto)
  update public.profiles set avatar_url = null where id = p_uid and avatar_url is not null;
  update public.profiles
     set full_name = 'Antiguo miembro', email = null, phone = null,
         role = 'player', custom_role_id = null, active = false,
         notify_sales = false, must_change_password = false,
         removed_at = coalesce(removed_at, now())
   where id = p_uid;

  -- 2) Ficha de jugador: se queda con sus estadísticas, pero sin enlace a la cuenta
  update public.players set user_id = null where user_id = p_uid;

  -- 3) Cuenta de acceso: vacía y bloqueada para siempre
  update auth.users
     set email = 'baja-' || p_uid::text || '@baja.invalid',
         encrypted_password = '',
         phone = null,
         raw_user_meta_data = '{}'::jsonb,
         email_confirmed_at = coalesce(email_confirmed_at, now()),
         confirmation_token = '', recovery_token = '', email_change_token_new = '',
         email_change = '', email_change_token_current = '', reauthentication_token = '',
         banned_until = now() + interval '100 years',   -- como «876000h» de la app ('infinity' rompe Supabase Auth)
         updated_at = now()
   where id = p_uid;
  delete from auth.identities where user_id = p_uid;
  delete from auth.sessions where user_id = p_uid;   -- sale de la app al momento

  -- 4) Rastro personal
  delete from public.user_permissions where user_id = p_uid;
  delete from public.push_subscriptions where user_id = p_uid;
  delete from public.user_activity where user_id = p_uid;
  delete from public.session_activity where user_id = p_uid;
  delete from public.usage_daily where user_id = p_uid;
  delete from public.app_errors where user_id = p_uid;
  update public.access_log set email = null, ip = null, user_agent = null where user_id = p_uid;

  -- 5) Auditoría de su perfil: fuera nombre, email, teléfono y foto de lo guardado
  update public.audit_log
     set old_data = case when old_data is null then null
                         else old_data || jsonb_build_object('full_name', 'Antiguo miembro', 'email', null, 'phone', null, 'avatar_url', null) end,
         new_data = case when new_data is null then null
                         else new_data || jsonb_build_object('full_name', 'Antiguo miembro', 'email', null, 'phone', null, 'avatar_url', null) end
   where table_name = 'profiles' and record_id = p_uid::text;
  update public.audit_log
     set new_data = new_data || jsonb_build_object('full_name', 'Antiguo miembro')
   where new_data ? 'full_name' and new_data ->> 'user_id' = p_uid::text and table_name = 'sessions';

  select full_name into v_by from public.profiles where id = auth.uid();
  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (auth.uid(), 'REMOVE_MEMBER', 'profiles', p_uid::text,
          jsonb_build_object('full_name', 'Antiguo miembro', 'detail', 'Dado de baja y datos personales borrados', 'by', v_by));
end;
$$;
revoke execute on function public.remove_member(uuid) from public, anon;
grant execute on function public.remove_member(uuid) to authenticated;
