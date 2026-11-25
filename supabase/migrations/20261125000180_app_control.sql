-- =====================================================================
-- 4.31.0 · Mandos de la app (solo superadministrador).
--
-- app_settings: una única fila con los interruptores de la app entera.
--   · Modo mantenimiento: todos menos el superadministrador ven «Estamos de
--     obras» (con mensaje y hora de vuelta). Opcionalmente también se cierran
--     las páginas públicas (rifa y noticias).
--   · Mensaje fijo: una franja arriba en todas las pantallas, informativa o
--     urgente, que se quita sola en la fecha indicada.
--   · Módulos apagados: apartados que se esconden para todos (sorteos, La Voz,
--     porra, cápsula, votaciones).
--   · reload_at: «forzar actualización», los móviles recargan la última versión.
-- La lee cualquiera con sesión (la app la necesita en cada página) y solo la
-- cambia un superadministrador. Cada cambio queda en la auditoría.
--
-- app_public_status(): lo justo del mantenimiento para las páginas sin sesión
-- (y las marcas de actualización, para que los móviles se enteren al momento).
-- admin_close_all_sessions(): saca a todo el mundo menos a quien lo pulsa.
-- =====================================================================

create table if not exists public.app_settings (
  id                  boolean primary key default true check (id),
  maintenance         boolean not null default false,
  maintenance_message text check (char_length(maintenance_message) <= 400),
  maintenance_until   timestamptz,
  maintenance_public  boolean not null default false,
  banner_text         text check (char_length(banner_text) <= 200),
  banner_tone         text not null default 'info' check (banner_tone in ('info', 'urgent')),
  banner_until        timestamptz,
  modules_off         text[] not null default '{}'
                        check (modules_off <@ array['lottery', 'news', 'porra', 'capsule', 'polls']::text[]),
  reload_at           timestamptz,
  updated_at          timestamptz not null default now(),
  updated_by          uuid references auth.users (id) on delete set null
);
insert into public.app_settings (id) values (true) on conflict (id) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select to authenticated using (true);
drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings for update to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
revoke all on public.app_settings from anon;
revoke insert, delete, truncate on public.app_settings from authenticated;
grant select, update on public.app_settings to authenticated;

create or replace function public.app_settings_touch()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;
revoke execute on function public.app_settings_touch() from public, anon, authenticated;
drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.app_settings_touch();

drop trigger if exists audit_app_settings on public.app_settings;
create trigger audit_app_settings after update on public.app_settings
  for each row execute function public.audit_trigger();

-- Para /mantenimiento, /rifa y /noticias, que se abren sin sesión. Lleva también las
-- marcas de «forzar actualización» y del último cambio: la app las mira al cambiar de
-- pantalla para recargar o refrescar la franja sin esperar.
drop function if exists public.app_public_status();
create function public.app_public_status()
returns table (maintenance boolean, message text, until timestamptz, public_closed boolean, reload_at timestamptz, updated_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select a.maintenance, a.maintenance_message, a.maintenance_until, a.maintenance and a.maintenance_public, a.reload_at, a.updated_at
    from public.app_settings a where a.id;
$$;
revoke execute on function public.app_public_status() from public;
grant execute on function public.app_public_status() to anon, authenticated;

-- «Cerrar sesión a todos»: borra las sesiones de todos menos las de quien lo pulsa.
-- session_alive() ya saca a cada uno en cuanto abre otra pantalla.
create or replace function public.admin_close_all_sessions()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_me   uuid := auth.uid();
  v_who  text;
  v_n    integer;
begin
  if not public.is_superadmin() then
    raise exception 'Solo un superadministrador puede cerrar las sesiones de todos' using errcode = '42501';
  end if;
  v_who := 'Cerrada por ' || coalesce((select full_name from public.profiles where id = v_me), 'un superadministrador') || ' (todas a la vez)';
  with gone as (
    delete from auth.sessions where user_id is distinct from v_me returning id, user_id
  ), logged as (
    insert into public.access_log (user_id, event, session_id, detail)
    select g.user_id, 'revoked', g.id, v_who from gone g
    returning 1
  )
  select count(*) into v_n from logged;
  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (v_me, 'CLOSE_ALL_SESSIONS', 'sessions', null, jsonb_build_object('sesiones', v_n));
  return v_n;
end;
$$;
revoke execute on function public.admin_close_all_sessions() from public, anon;
grant execute on function public.admin_close_all_sessions() to authenticated;
