-- =====================================================================
-- RAYO VALLECAÑAS · Núcleo: usuarios, roles, permisos y auditoría
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Roles y módulos
-- ---------------------------------------------------------------------
create type public.app_role as enum ('superadmin', 'admin', 'coach', 'player');

-- Módulos sobre los que se conceden permisos (consultar/crear/modificar/eliminar).
-- Se añaden nuevos módulos en fases posteriores con ALTER TYPE ... ADD VALUE.
create type public.app_module as enum (
  'lottery_admin',  -- gestión global de lotería: campañas, todas las ventas, cobros, anulaciones
  'lottery_sell',   -- vendedor: registrar y consultar sus propias ventas
  'users',          -- usuarios y permisos
  'audit',          -- registro de auditoría
  'finances',       -- fase 2
  'squad',          -- fase 3
  'matches'         -- fase 4
);

create type public.app_action as enum ('read', 'create', 'update', 'delete');

-- ---------------------------------------------------------------------
-- Perfiles (1:1 con auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text,
  phone       text,
  role        public.app_role not null default 'player',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Permisos por defecto de cada rol
create table public.role_permissions (
  role        public.app_role not null,
  module      public.app_module not null,
  can_read    boolean not null default false,
  can_create  boolean not null default false,
  can_update  boolean not null default false,
  can_delete  boolean not null default false,
  primary key (role, module)
);

-- Permisos personalizados por usuario (sustituyen a los del rol para ese módulo)
create table public.user_permissions (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  module      public.app_module not null,
  can_read    boolean not null default false,
  can_create  boolean not null default false,
  can_update  boolean not null default false,
  can_delete  boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, module)
);

insert into public.role_permissions (role, module, can_read, can_create, can_update, can_delete) values
  ('admin',  'lottery_admin', true,  true,  true,  true),
  ('admin',  'lottery_sell',  true,  true,  true,  false),
  ('admin',  'users',         true,  true,  true,  false),
  ('admin',  'audit',         true,  false, false, false),
  ('admin',  'finances',      true,  true,  true,  false),
  ('admin',  'squad',         true,  true,  true,  false),
  ('admin',  'matches',       true,  true,  true,  false),
  ('coach',  'lottery_sell',  true,  true,  true,  false),
  ('coach',  'squad',         true,  true,  true,  false),
  ('coach',  'matches',       true,  true,  true,  true),
  ('player', 'lottery_sell',  true,  true,  true,  false),
  ('player', 'squad',         true,  false, false, false),
  ('player', 'matches',       true,  false, false, false);

-- ---------------------------------------------------------------------
-- Comprobación de permisos (usada por RLS y por las funciones RPC)
-- ---------------------------------------------------------------------
create or replace function public.current_role_name()
returns public.app_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_superadmin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'superadmin' from public.profiles where id = auth.uid() and active), false)
$$;

create or replace function public.has_perm(p_module public.app_module, p_action public.app_action)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_role public.app_role;
  v_row  record;
begin
  select role into v_role from public.profiles where id = auth.uid() and active;
  if v_role is null then
    return false;
  end if;
  if v_role = 'superadmin' then
    return true;
  end if;

  select * into v_row from public.user_permissions where user_id = auth.uid() and module = p_module;
  if not found then
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

-- Permisos efectivos del usuario actual (para pintar la interfaz)
create or replace function public.my_permissions()
returns table (module public.app_module, can_read boolean, can_create boolean, can_update boolean, can_delete boolean)
language sql stable security definer set search_path = public
as $$
  select m.module,
         public.has_perm(m.module, 'read'),
         public.has_perm(m.module, 'create'),
         public.has_perm(m.module, 'update'),
         public.has_perm(m.module, 'delete')
  from unnest(enum_range(null::public.app_module)) as m(module)
$$;

-- ---------------------------------------------------------------------
-- Alta automática de perfil. El primer usuario registrado es superadmin.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_first boolean;
begin
  select not exists (select 1 from public.profiles) into v_first;
  insert into public.profiles (id, full_name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    -- El rol NUNCA se toma de los metadatos (los controla quien se registra).
    -- La directiva lo asigna después desde Usuarios.
    case when v_first then 'superadmin'::public.app_role else 'player'::public.app_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Vista con solo nombre y rol, para mostrar vendedores sin exponer datos privados
create view public.member_directory
with (security_invoker = false) as
  select id, full_name, role, active from public.profiles;

-- ---------------------------------------------------------------------
-- Auditoría
-- ---------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  user_id     uuid,
  action      text not null,          -- INSERT / UPDATE / DELETE / acción de negocio
  table_name  text not null,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_table_record_idx on public.audit_log (table_name, record_id);
create index audit_log_created_idx on public.audit_log (created_at desc);

create or replace function public.audit_trigger()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_id text;
begin
  -- Ignora actualizaciones que solo tocan contadores internos
  if tg_op = 'UPDATE' and (to_jsonb(old) - 'updated_at' - 'sale_seq') = (to_jsonb(new) - 'updated_at' - 'sale_seq') then
    return null;
  end if;
  v_id := coalesce(
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> 'id',
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end ->> 'user_id'
  );
  insert into public.audit_log (user_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(), tg_op, tg_table_name, v_id,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

-- Registro explícito de acciones de negocio (anulaciones, envíos, etc.)
create or replace function public.log_action(p_action text, p_table text, p_record text, p_data jsonb default null)
returns void
language sql security definer set search_path = public
as $$
  insert into public.audit_log (user_id, action, table_name, record_id, new_data)
  values (auth.uid(), p_action, p_table, p_record, p_data);
$$;

create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function public.audit_trigger();
create trigger audit_user_permissions after insert or update or delete on public.user_permissions
  for each row execute function public.audit_trigger();

-- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Un usuario no puede cambiarse a sí mismo el rol ni el estado
create or replace function public.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active) then
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
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permissions enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_perm('users', 'read'));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid() or public.has_perm('users', 'update'))
  with check (id = auth.uid() or public.has_perm('users', 'update'));

create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

create policy user_permissions_select on public.user_permissions for select to authenticated
  using (user_id = auth.uid() or public.has_perm('users', 'read'));
create policy user_permissions_write on public.user_permissions for all to authenticated
  using (public.has_perm('users', 'update')) with check (public.has_perm('users', 'update'));

create policy audit_select on public.audit_log for select to authenticated
  using (public.has_perm('audit', 'read'));

revoke all on public.member_directory from anon;
grant select on public.member_directory to authenticated;
