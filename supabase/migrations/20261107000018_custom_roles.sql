-- =====================================================================
-- v3.3.0 · Permisos personalizables
-- 1. Perfiles a medida (Entrenador, Delegado, Tesorero…): cada uno parte de
--    una base (gestor o jugador) y tiene su propia tabla de permisos.
--    La base decide las reglas fijas: con base jugador nunca hay Finanzas
--    ni datos personales de otros. Solo el superadministrador los crea y edita.
-- 2. La auditoría queda fija para el superadministrador.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Perfiles a medida
-- ---------------------------------------------------------------------
create table public.custom_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 2 and 40),
  description text not null default '' check (length(description) <= 300),
  base        public.app_role not null check (base in ('admin', 'player')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index custom_roles_name_idx on public.custom_roles (lower(trim(name)));

create table public.custom_role_permissions (
  role_id     uuid not null references public.custom_roles (id) on delete cascade,
  module      public.app_module not null,
  can_read    boolean not null default false,
  can_create  boolean not null default false,
  can_update  boolean not null default false,
  can_delete  boolean not null default false,
  primary key (role_id, module)
);

alter table public.profiles
  add column custom_role_id uuid references public.custom_roles (id) on delete set null;
create index profiles_custom_role_idx on public.profiles (custom_role_id);

create trigger custom_roles_touch before update on public.custom_roles
  for each row execute function public.touch_updated_at();
create trigger audit_custom_roles after insert or update or delete on public.custom_roles
  for each row execute function public.audit_trigger();
create trigger audit_custom_role_permissions after insert or update or delete on public.custom_role_permissions
  for each row execute function public.audit_trigger();
create trigger audit_role_permissions after insert or update or delete on public.role_permissions
  for each row execute function public.audit_trigger();

-- La base de un perfil no cambia (cambiaría lo que pueden hacer sus usuarios por la puerta de atrás)
create or replace function public.guard_custom_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.base is distinct from old.base then
    raise exception 'La base de un perfil no se puede cambiar: crea otro perfil' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_custom_role() from public, anon, authenticated;
create trigger custom_roles_guard before update on public.custom_roles
  for each row execute function public.guard_custom_role();

-- El rol de un usuario con perfil a medida es siempre la base del perfil
create or replace function public.sync_custom_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.custom_role_id is not null then
    if new.role = 'superadmin' then
      new.custom_role_id := null;            -- el superadministrador no lleva perfil a medida
    else
      select base into new.role from public.custom_roles where id = new.custom_role_id;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.sync_custom_role() from public, anon, authenticated;
-- Se llama «profiles_a_sync» para que corra antes que «profiles_guard» (orden alfabético)
create trigger profiles_a_sync before insert or update on public.profiles
  for each row execute function public.sync_custom_role();

-- Cambiar el perfil a medida cuenta como cambiar el rol
create or replace function public.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active
      or new.custom_role_id is distinct from old.custom_role_id) then
    if not public.has_perm('users', 'update') then
      raise exception 'No tienes permiso para cambiar roles' using errcode = '42501';
    end if;
    if new.role = 'superadmin' and not public.is_superadmin() then
      raise exception 'Solo un superadministrador puede nombrar otro superadministrador' using errcode = '42501';
    end if;
    if old.role = 'superadmin' and not public.is_superadmin() then
      raise exception 'Solo un superadministrador puede modificar a otro superadministrador' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;

alter table public.custom_roles enable row level security;
alter table public.custom_role_permissions enable row level security;
create policy custom_roles_select on public.custom_roles for select to authenticated using (true);
create policy custom_roles_write on public.custom_roles for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy custom_role_permissions_select on public.custom_role_permissions for select to authenticated using (true);
create policy custom_role_permissions_write on public.custom_role_permissions for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
grant select, insert, update, delete on public.custom_roles, public.custom_role_permissions to authenticated;

-- ---------------------------------------------------------------------
-- Comprobación de permisos
-- Orden: excepción de la persona → su perfil a medida → su rol.
-- ---------------------------------------------------------------------
create or replace function public.user_has_perm(p_user uuid, p_module public.app_module, p_action public.app_action)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_role   public.app_role;
  v_custom uuid;
  v_row    record;
begin
  select role, custom_role_id into v_role, v_custom from public.profiles where id = p_user and active;
  if v_role is null then
    return false;
  end if;
  if v_role = 'superadmin' then
    return true;
  end if;
  -- Auditoría: solo el superadministrador (decisión del club)
  if p_module = 'audit' then
    return false;
  end if;
  -- Información económica y datos personales de otros: nunca para jugadores (decisión del club)
  if p_module in ('finances', 'squad_private') and v_role = 'player' then
    return false;
  end if;

  select * into v_row from public.user_permissions where user_id = p_user and module = p_module;
  if not found and v_custom is not null then
    select * into v_row from public.custom_role_permissions where role_id = v_custom and module = p_module;
    if not found then
      return false;
    end if;
  elsif not found then
    select * into v_row from public.role_permissions where role = v_role and module = p_module;
    if not found then
      return false;
    end if;
  end if;

  return case p_action
    when 'read'   then v_row.can_read
    when 'create' then v_row.can_create
    when 'update' then v_row.can_update
    when 'delete' then v_row.can_delete
  end;
end;
$$;
revoke execute on function public.user_has_perm(uuid, public.app_module, public.app_action) from public, anon, authenticated;
grant execute on function public.user_has_perm(uuid, public.app_module, public.app_action) to service_role;

create or replace function public.has_perm(p_module public.app_module, p_action public.app_action)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.user_has_perm(auth.uid(), p_module, p_action)
$$;

-- Usuarios activos con un permiso (para los avisos push; solo desde el servidor)
create or replace function public.users_with_perm(p_module public.app_module, p_action public.app_action)
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select id from public.profiles where active and public.user_has_perm(id, p_module, p_action)
$$;
revoke execute on function public.users_with_perm(public.app_module, public.app_action) from public, anon, authenticated;
grant execute on function public.users_with_perm(public.app_module, public.app_action) to service_role;
