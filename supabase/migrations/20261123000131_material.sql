-- =====================================================================
-- v4.29.0 · Material deportivo: el inventario del club
-- · Artículos (equipaciones, balones, petos, conos, botiquín…) con un
--   mínimo opcional: si quedan menos piezas en buen estado, la app avisa.
-- · Cada artículo se guarda en «lotes»: cuántas piezas hay en un estado
--   (nueva, usada, rota), con talla y dorsal si hace falta, y quién las
--   tiene si están prestadas. Una camiseta es un lote de 1 (talla M, dorsal 7);
--   «8 balones nuevos» es un lote de 8.
-- · Los gestores lo ven y lo cambian todo. Cada jugador ve solo lo que
--   tiene él (y el artículo al que pertenece), nada más.
-- Requiere haber ejecutado antes 20261123000130_material_module.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Permisos: los gestores lo hacen todo; los jugadores, nada (solo lo suyo, por la regla de abajo)
-- ---------------------------------------------------------------------
insert into public.role_permissions (role, module, can_read, can_create, can_update, can_delete)
values ('admin', 'material', true, true, true, true)
on conflict (role, module) do update set can_read = true, can_create = true, can_update = true, can_delete = true;
insert into public.role_permissions (role, module, can_read, can_create, can_update, can_delete)
values ('player', 'material', false, false, false, false)
on conflict (role, module) do nothing;
-- Los perfiles a medida que ya existen: con base gestor, todo; con base jugador, nada
insert into public.custom_role_permissions (role_id, module, can_read, can_create, can_update, can_delete)
select id, 'material', base = 'admin', base = 'admin', base = 'admin', base = 'admin' from public.custom_roles
on conflict (role_id, module) do nothing;

-- ---------------------------------------------------------------------
-- Artículos
-- ---------------------------------------------------------------------
create table public.material_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 2 and 60),
  -- equipaciones · balones · entrenamiento · portero · botiquín · otros
  category    text not null default 'other' check (category in ('kit', 'balls', 'training', 'goalkeeper', 'medical', 'other')),
  min_qty     integer check (min_qty is null or min_qty between 1 and 999),   -- aviso si quedan menos en buen estado
  notes       text check (notes is null or length(notes) <= 500),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index material_items_name_idx on public.material_items (lower(trim(name)));

-- Lotes: piezas iguales de un artículo (mismo estado, talla, dorsal y quién las tiene)
create table public.material_lots (
  id                uuid primary key default gen_random_uuid(),
  item_id           uuid not null references public.material_items (id) on delete cascade,
  qty               integer not null default 1 check (qty between 1 and 999),
  condition         text not null default 'new' check (condition in ('new', 'used', 'broken')),
  size              text check (size is null or length(size) between 1 and 8),
  number            smallint check (number is null or number between 0 and 99),
  holder_player_id  uuid references public.players (id) on delete set null,      -- prestado a
  lent_on           date,
  notes             text check (notes is null or length(notes) <= 200),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index material_lots_item_idx on public.material_lots (item_id);
create index material_lots_holder_idx on public.material_lots (holder_player_id) where holder_player_id is not null;

create trigger material_items_touch before update on public.material_items
  for each row execute function public.touch_updated_at();
create trigger material_lots_touch before update on public.material_lots
  for each row execute function public.touch_updated_at();
create trigger audit_material_items after insert or update or delete on public.material_items
  for each row execute function public.audit_trigger();
create trigger audit_material_lots after insert or update or delete on public.material_lots
  for each row execute function public.audit_trigger();

-- Ficha del jugador conectado (una vez por consulta en las reglas de abajo, no por fila)
create or replace function public.material_my_player()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.players where user_id = auth.uid()
$$;
revoke execute on function public.material_my_player() from public, anon;
grant execute on function public.material_my_player() to authenticated;

alter table public.material_items enable row level security;
alter table public.material_lots enable row level security;

create policy material_items_select on public.material_items for select to authenticated
  using ((select public.has_perm('material', 'read'))
         or exists (select 1 from public.material_lots l
                     where l.item_id = material_items.id and l.holder_player_id = (select public.material_my_player())));
create policy material_items_insert on public.material_items for insert to authenticated
  with check ((select public.has_perm('material', 'create')));
create policy material_items_update on public.material_items for update to authenticated
  using ((select public.has_perm('material', 'update'))) with check ((select public.has_perm('material', 'update')));
create policy material_items_delete on public.material_items for delete to authenticated
  using ((select public.has_perm('material', 'delete')));

create policy material_lots_select on public.material_lots for select to authenticated
  using ((select public.has_perm('material', 'read')) or holder_player_id = (select public.material_my_player()));
create policy material_lots_insert on public.material_lots for insert to authenticated
  with check ((select public.has_perm('material', 'create')) or (select public.has_perm('material', 'update')));
create policy material_lots_update on public.material_lots for update to authenticated
  using ((select public.has_perm('material', 'update'))) with check ((select public.has_perm('material', 'update')));
create policy material_lots_delete on public.material_lots for delete to authenticated
  using ((select public.has_perm('material', 'update')) or (select public.has_perm('material', 'delete')));

grant select, insert, update, delete on public.material_items, public.material_lots to authenticated;
