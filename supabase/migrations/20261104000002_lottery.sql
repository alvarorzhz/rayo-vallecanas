-- =====================================================================
-- RAYO VALLECAÑAS · Módulo de lotería (fase 1)
-- Importes en céntimos (integer) para evitar errores de redondeo.
-- =====================================================================

create type public.lottery_campaign_status as enum ('draft', 'active', 'closed', 'drawn');
-- auto: el sistema asigna las primeras participaciones libres
-- booklet: talonarios; se asignan las libres del talonario del vendedor
-- manual: el vendedor elige qué participaciones concretas vende (registro flexible)
create type public.lottery_numbering_mode as enum ('auto', 'booklet', 'manual');
create type public.lottery_share_status as enum ('available', 'reserved', 'sold', 'voided');
create type public.payment_status as enum ('pending', 'partial', 'paid', 'cancelled');
create type public.payment_method as enum ('cash', 'bizum', 'transfer', 'card', 'other');
create type public.notification_channel as enum ('email', 'whatsapp');
create type public.notification_status as enum ('pending', 'sent', 'failed');

-- ---------------------------------------------------------------------
-- Campañas
-- ---------------------------------------------------------------------
create table public.lottery_campaigns (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  year            int  not null check (year between 2000 and 2100),
  lottery_number  text not null check (lottery_number ~ '^[0-9]{5}$'),
  draw_type       text not null default 'Sorteo Extraordinario de Navidad',
  draw_date       date,
  price_cents     int  not null check (price_cents > 0),
  played_cents    int  not null default 0 check (played_cents >= 0),
  donation_cents  int  not null default 0 check (donation_cents >= 0),
  total_shares    int  not null check (total_shares between 1 and 100000),
  numbering_mode  public.lottery_numbering_mode not null default 'auto',
  ref_prefix      text not null default 'RV',
  status          public.lottery_campaign_status not null default 'draft',
  sale_seq        int  not null default 0,
  winning_prize_cents int,                   -- premio por participación tras el sorteo
  notes           text,
  created_by      uuid references public.profiles (id) default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (played_cents + donation_cents <= price_cents or played_cents = 0)
);

-- Vendedores asignados a cada campaña
create table public.lottery_campaign_sellers (
  campaign_id  uuid not null references public.lottery_campaigns (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  assigned_at  timestamptz not null default now(),
  assigned_by  uuid default auth.uid(),
  primary key (campaign_id, user_id)
);

-- Talonarios: rango de participaciones entregadas a un vendedor
create table public.lottery_booklets (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null references public.lottery_campaigns (id) on delete cascade,
  seller_id    uuid not null references public.profiles (id),
  label        text,
  from_number  int not null,
  to_number    int not null,
  created_at   timestamptz not null default now(),
  check (from_number >= 1 and to_number >= from_number)
);

-- ---------------------------------------------------------------------
-- Compradores (datos mínimos; sin consentimiento comercial por defecto)
-- ---------------------------------------------------------------------
create table public.buyers (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text not null,
  phone              text,
  email              text,
  marketing_consent  boolean not null default false,
  created_by         uuid default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (phone is not null or email is not null)
);
create index buyers_email_idx on public.buyers (lower(email));
create index buyers_phone_idx on public.buyers (phone);

-- ---------------------------------------------------------------------
-- Ventas, participaciones y pagos
-- ---------------------------------------------------------------------
create table public.lottery_sales (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.lottery_campaigns (id),
  reference         text not null unique,
  buyer_id          uuid not null references public.buyers (id),
  seller_id         uuid not null references public.profiles (id),
  quantity          int  not null check (quantity > 0),
  unit_price_cents  int  not null,
  total_cents       int  not null,
  paid_cents        int  not null default 0,
  payment_status    public.payment_status not null default 'pending',
  preferred_channel public.notification_channel,
  notes             text,
  created_by        uuid default auth.uid(),
  created_at        timestamptz not null default now(),
  cancelled_at      timestamptz,
  cancelled_by      uuid,
  cancel_reason     text
);
create index lottery_sales_campaign_idx on public.lottery_sales (campaign_id, created_at desc);
create index lottery_sales_seller_idx on public.lottery_sales (seller_id);
create index lottery_sales_buyer_idx on public.lottery_sales (buyer_id);

create table public.lottery_shares (
  id            bigint generated always as identity primary key,
  campaign_id   uuid not null references public.lottery_campaigns (id) on delete cascade,
  share_number  int  not null,
  status        public.lottery_share_status not null default 'available',
  booklet_id    uuid references public.lottery_booklets (id) on delete set null,
  sale_id       uuid references public.lottery_sales (id),
  updated_at    timestamptz not null default now(),
  unique (campaign_id, share_number),
  -- Integridad: una participación vendida siempre apunta a su venta y viceversa
  check ((status = 'sold') = (sale_id is not null))
);
create index lottery_shares_status_idx on public.lottery_shares (campaign_id, status, share_number);
create index lottery_shares_sale_idx on public.lottery_shares (sale_id);

create table public.lottery_payments (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid not null references public.lottery_sales (id),
  amount_cents  int not null check (amount_cents <> 0),   -- negativo = devolución
  method        public.payment_method not null default 'cash',
  paid_at       timestamptz not null default now(),
  notes         text,
  registered_by uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
create index lottery_payments_sale_idx on public.lottery_payments (sale_id);

-- Envíos de justificantes
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  sale_id       uuid references public.lottery_sales (id),
  channel       public.notification_channel not null,
  recipient     text not null,
  status        public.notification_status not null default 'pending',
  attempts      int not null default 0,
  provider_id   text,
  error         text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  sent_at       timestamptz
);
create index notifications_sale_idx on public.notifications (sale_id, created_at desc);

-- ---------------------------------------------------------------------
-- Generación de participaciones
-- ---------------------------------------------------------------------
create or replace function public.lottery_generate_shares()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.lottery_shares (campaign_id, share_number)
  select new.id, g from generate_series(1, new.total_shares) g;
  return new;
end;
$$;
create trigger lottery_campaign_shares after insert on public.lottery_campaigns
  for each row execute function public.lottery_generate_shares();

-- Ampliar o reducir el número de participaciones (solo quita las libres del final)
create or replace function public.lottery_campaign_shares_resize()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_blocked int;
begin
  if new.total_shares > old.total_shares then
    insert into public.lottery_shares (campaign_id, share_number)
    select new.id, g from generate_series(old.total_shares + 1, new.total_shares) g;
  elsif new.total_shares < old.total_shares then
    select count(*) into v_blocked from public.lottery_shares
     where campaign_id = new.id and share_number > new.total_shares and status <> 'available';
    if v_blocked > 0 then
      raise exception 'No se puede reducir: hay % participaciones vendidas, reservadas o anuladas por encima del nuevo total', v_blocked;
    end if;
    delete from public.lottery_shares where campaign_id = new.id and share_number > new.total_shares;
  end if;
  if new.price_cents <> old.price_cents and exists (select 1 from public.lottery_sales where campaign_id = new.id) then
    raise exception 'No se puede cambiar el precio de una campaña con ventas registradas';
  end if;
  return new;
end;
$$;
create trigger lottery_campaign_resize before update of total_shares, price_cents on public.lottery_campaigns
  for each row execute function public.lottery_campaign_shares_resize();

create trigger lottery_campaigns_touch before update on public.lottery_campaigns
  for each row execute function public.touch_updated_at();
create trigger buyers_touch before update on public.buyers
  for each row execute function public.touch_updated_at();
create trigger lottery_shares_touch before update on public.lottery_shares
  for each row execute function public.touch_updated_at();

-- Asignar talonario: marca las participaciones del rango
create or replace function public.lottery_booklet_assign()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_total int;
begin
  select total_shares into v_total from public.lottery_campaigns where id = new.campaign_id;
  if new.to_number > v_total then
    raise exception 'El talonario supera el total de participaciones (%)', v_total;
  end if;
  if exists (select 1 from public.lottery_shares
              where campaign_id = new.campaign_id
                and share_number between new.from_number and new.to_number
                and booklet_id is not null) then
    raise exception 'El rango %-% se solapa con otro talonario', new.from_number, new.to_number;
  end if;
  update public.lottery_shares set booklet_id = new.id
   where campaign_id = new.campaign_id and share_number between new.from_number and new.to_number;
  insert into public.lottery_campaign_sellers (campaign_id, user_id)
  values (new.campaign_id, new.seller_id) on conflict do nothing;
  return new;
end;
$$;
create trigger lottery_booklet_after_insert after insert on public.lottery_booklets
  for each row execute function public.lottery_booklet_assign();

-- ---------------------------------------------------------------------
-- Estado de pago derivado de los pagos registrados
-- ---------------------------------------------------------------------
create or replace function public.lottery_recalc_payment(p_sale_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_paid int;
begin
  select coalesce(sum(amount_cents), 0) into v_paid from public.lottery_payments where sale_id = p_sale_id;
  update public.lottery_sales s
     set paid_cents = v_paid,
         payment_status = case
           when s.cancelled_at is not null then 'cancelled'::public.payment_status
           when v_paid <= 0 then 'pending'
           when v_paid >= s.total_cents then 'paid'
           else 'partial' end
   where s.id = p_sale_id;
end;
$$;

create or replace function public.lottery_payments_after()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform public.lottery_recalc_payment(new.sale_id);
  return null;
end;
$$;
create trigger lottery_payments_recalc after insert on public.lottery_payments
  for each row execute function public.lottery_payments_after();

-- Los pagos no se modifican ni borran: se corrigen con un apunte negativo
create or replace function public.forbid_change()
returns trigger language plpgsql as $$
begin
  raise exception 'Operación no permitida: los registros económicos no se modifican ni se borran; registra una corrección';
end;
$$;
create trigger lottery_payments_immutable before update or delete on public.lottery_payments
  for each row execute function public.forbid_change();
create trigger lottery_sales_no_delete before delete on public.lottery_sales
  for each row execute function public.forbid_change();

-- ---------------------------------------------------------------------
-- RPC: registrar venta (transaccional, sin duplicados)
-- ---------------------------------------------------------------------
create or replace function public.lottery_register_sale(
  p_campaign_id        uuid,
  p_buyer_name         text,
  p_buyer_phone        text,
  p_buyer_email        text,
  p_quantity           int,
  p_share_numbers      int[] default null,     -- solo modo manual
  p_paid_cents         int default 0,
  p_payment_method     public.payment_method default 'cash',
  p_seller_id          uuid default null,      -- la directiva puede registrar en nombre de otro
  p_preferred_channel  public.notification_channel default null,
  p_notes              text default null,
  p_marketing_consent  boolean default false
)
returns public.lottery_sales
language plpgsql security definer set search_path = public
as $$
declare
  v_campaign  public.lottery_campaigns;
  v_seller    uuid := coalesce(p_seller_id, auth.uid());
  v_is_admin  boolean := public.has_perm('lottery_admin', 'create');
  v_buyer_id  uuid;
  v_sale      public.lottery_sales;
  v_ids       bigint[];
  v_seq       int;
  v_email     text := nullif(lower(trim(p_buyer_email)), '');
  v_phone     text := nullif(regexp_replace(coalesce(p_buyer_phone, ''), '[^0-9+]', '', 'g'), '');
begin
  if auth.uid() is null then
    raise exception 'Sesión no válida' using errcode = '42501';
  end if;
  if not (public.has_perm('lottery_sell', 'create') or v_is_admin) then
    raise exception 'No tienes permiso para registrar ventas' using errcode = '42501';
  end if;
  if v_seller <> auth.uid() and not v_is_admin then
    raise exception 'Solo la directiva puede registrar ventas a nombre de otro vendedor' using errcode = '42501';
  end if;
  if coalesce(trim(p_buyer_name), '') = '' then
    raise exception 'El nombre del comprador es obligatorio';
  end if;
  if v_email is null and v_phone is null then
    raise exception 'Indica un teléfono o un correo del comprador';
  end if;
  if p_quantity is null or p_quantity < 1 then
    raise exception 'La cantidad debe ser al menos 1';
  end if;

  -- Bloqueo de la campaña: serializa la numeración de referencias
  select * into v_campaign from public.lottery_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'Campaña no encontrada';
  end if;
  if v_campaign.status <> 'active' then
    raise exception 'La campaña no está activa';
  end if;
  if not v_is_admin and not exists (
    select 1 from public.lottery_campaign_sellers where campaign_id = p_campaign_id and user_id = v_seller
  ) then
    raise exception 'No estás asignado como vendedor en esta campaña' using errcode = '42501';
  end if;

  -- Selección y bloqueo de participaciones
  if v_campaign.numbering_mode = 'manual' then
    if p_share_numbers is null or cardinality(p_share_numbers) <> p_quantity then
      raise exception 'Indica exactamente % participaciones', p_quantity;
    end if;
    if (select count(distinct x) from unnest(p_share_numbers) x) <> p_quantity then
      raise exception 'Hay participaciones repetidas en la selección';
    end if;
    select array_agg(id order by share_number) into v_ids from (
      select id, share_number from public.lottery_shares
       where campaign_id = p_campaign_id and share_number = any (p_share_numbers) and status = 'available'
       for update
    ) s;
  elsif v_campaign.numbering_mode = 'booklet' then
    select array_agg(id order by share_number) into v_ids from (
      select sh.id, sh.share_number from public.lottery_shares sh
        join public.lottery_booklets b on b.id = sh.booklet_id
       where sh.campaign_id = p_campaign_id and sh.status = 'available' and b.seller_id = v_seller
       order by sh.share_number
       limit p_quantity
       for update of sh skip locked
    ) s;
  else
    select array_agg(id order by share_number) into v_ids from (
      select id, share_number from public.lottery_shares
       where campaign_id = p_campaign_id and status = 'available'
       order by share_number
       limit p_quantity
       for update skip locked
    ) s;
  end if;

  if coalesce(cardinality(v_ids), 0) < p_quantity then
    raise exception 'No hay suficientes participaciones disponibles (solicitadas %, disponibles %)',
      p_quantity, coalesce(cardinality(v_ids), 0) using errcode = 'P0001';
  end if;

  -- Comprador: reutiliza si ya existe con el mismo email o teléfono
  select id into v_buyer_id from public.buyers
   where (v_email is not null and lower(email) = v_email)
      or (v_phone is not null and phone = v_phone)
   order by created_at limit 1;
  if v_buyer_id is null then
    insert into public.buyers (full_name, phone, email, marketing_consent)
    values (trim(p_buyer_name), v_phone, v_email, coalesce(p_marketing_consent, false))
    returning id into v_buyer_id;
  else
    update public.buyers
       set full_name = trim(p_buyer_name),
           phone = coalesce(v_phone, phone),
           email = coalesce(v_email, email),
           marketing_consent = marketing_consent or coalesce(p_marketing_consent, false)
     where id = v_buyer_id;
  end if;

  update public.lottery_campaigns set sale_seq = sale_seq + 1 where id = p_campaign_id
  returning sale_seq into v_seq;

  insert into public.lottery_sales (
    campaign_id, reference, buyer_id, seller_id, quantity, unit_price_cents, total_cents,
    preferred_channel, notes
  ) values (
    p_campaign_id,
    format('%s-%s-%s', v_campaign.ref_prefix, v_campaign.year, lpad(v_seq::text, 4, '0')),
    v_buyer_id, v_seller, p_quantity, v_campaign.price_cents, v_campaign.price_cents * p_quantity,
    p_preferred_channel, nullif(trim(p_notes), '')
  ) returning * into v_sale;

  update public.lottery_shares set status = 'sold', sale_id = v_sale.id where id = any (v_ids);

  if coalesce(p_paid_cents, 0) > 0 then
    insert into public.lottery_payments (sale_id, amount_cents, method)
    values (v_sale.id, least(p_paid_cents, v_sale.total_cents), p_payment_method);
  end if;

  select * into v_sale from public.lottery_sales where id = v_sale.id;
  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: registrar cobro
-- ---------------------------------------------------------------------
create or replace function public.lottery_add_payment(
  p_sale_id uuid, p_amount_cents int, p_method public.payment_method default 'cash', p_notes text default null
)
returns public.lottery_sales
language plpgsql security definer set search_path = public
as $$
declare
  v_sale public.lottery_sales;
begin
  select * into v_sale from public.lottery_sales where id = p_sale_id for update;
  if not found then raise exception 'Venta no encontrada'; end if;
  if not (public.has_perm('lottery_admin', 'update')
          or (v_sale.seller_id = auth.uid() and public.has_perm('lottery_sell', 'update'))) then
    raise exception 'No tienes permiso para registrar cobros en esta venta' using errcode = '42501';
  end if;
  if v_sale.cancelled_at is not null and p_amount_cents > 0 then
    raise exception 'La venta está anulada';
  end if;
  if p_amount_cents < 0 and not public.has_perm('lottery_admin', 'update') then
    raise exception 'Solo la directiva puede registrar devoluciones' using errcode = '42501';
  end if;
  if v_sale.paid_cents + p_amount_cents > v_sale.total_cents then
    raise exception 'El cobro supera el importe pendiente (% céntimos)', v_sale.total_cents - v_sale.paid_cents;
  end if;
  if v_sale.paid_cents + p_amount_cents < 0 then
    raise exception 'La devolución supera lo cobrado';
  end if;
  insert into public.lottery_payments (sale_id, amount_cents, method, notes)
  values (p_sale_id, p_amount_cents, p_method, nullif(trim(p_notes), ''));
  select * into v_sale from public.lottery_sales where id = p_sale_id;
  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: anulación controlada de una venta
-- p_release = true  -> las participaciones vuelven a estar disponibles
-- p_release = false -> las participaciones quedan anuladas (p.ej. papeleta física extraviada)
-- ---------------------------------------------------------------------
create or replace function public.lottery_cancel_sale(p_sale_id uuid, p_reason text, p_release boolean default true)
returns public.lottery_sales
language plpgsql security definer set search_path = public
as $$
declare
  v_sale public.lottery_sales;
begin
  if not public.has_perm('lottery_admin', 'delete') then
    raise exception 'Solo la directiva autorizada puede anular ventas' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Indica el motivo de la anulación';
  end if;
  select * into v_sale from public.lottery_sales where id = p_sale_id for update;
  if not found then raise exception 'Venta no encontrada'; end if;
  if v_sale.cancelled_at is not null then raise exception 'La venta ya estaba anulada'; end if;

  update public.lottery_shares
     set status = case when p_release then 'available'::public.lottery_share_status else 'voided' end,
         sale_id = null
   where sale_id = p_sale_id;

  update public.lottery_sales
     set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = trim(p_reason),
         payment_status = 'cancelled'
   where id = p_sale_id
  returning * into v_sale;

  perform public.log_action('CANCEL_SALE', 'lottery_sales', p_sale_id::text,
    jsonb_build_object('reason', p_reason, 'release', p_release, 'paid_cents', v_sale.paid_cents));
  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: cambiar estado de participaciones libres (reservar / liberar / anular)
-- ---------------------------------------------------------------------
create or replace function public.lottery_set_share_status(
  p_campaign_id uuid, p_numbers int[], p_status public.lottery_share_status
)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_count int;
begin
  if not public.has_perm('lottery_admin', 'update') then
    raise exception 'No tienes permiso' using errcode = '42501';
  end if;
  if p_status = 'sold' then
    raise exception 'Para vender usa el registro de ventas';
  end if;
  update public.lottery_shares set status = p_status
   where campaign_id = p_campaign_id and share_number = any (p_numbers) and status <> 'sold';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Resúmenes
-- ---------------------------------------------------------------------
create or replace function public.lottery_campaign_summary(p_campaign_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_admin boolean := public.has_perm('lottery_admin', 'read');
  v jsonb;
begin
  if not (v_admin or public.has_perm('lottery_sell', 'read')) then
    raise exception 'No tienes permiso' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'total',     count(*),
    'available', count(*) filter (where status = 'available'),
    'reserved',  count(*) filter (where status = 'reserved'),
    'sold',      count(*) filter (where status = 'sold'),
    'voided',    count(*) filter (where status = 'voided')
  ) into v from public.lottery_shares where campaign_id = p_campaign_id;

  if v_admin then
    v := v || (
      select jsonb_build_object(
        'sales_count',   count(*),
        'sold_cents',    coalesce(sum(total_cents), 0),
        'paid_cents',    coalesce(sum(paid_cents), 0),
        'pending_cents', coalesce(sum(total_cents - paid_cents), 0),
        'pending_sales', count(*) filter (where payment_status in ('pending', 'partial')),
        'buyers',        count(distinct buyer_id)
      ) from public.lottery_sales where campaign_id = p_campaign_id and cancelled_at is null
    );
  end if;
  return v;
end;
$$;

create or replace function public.lottery_seller_ranking(p_campaign_id uuid)
returns table (seller_id uuid, full_name text, sales_count bigint, shares bigint, sold_cents bigint, paid_cents bigint, pending_cents bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_perm('lottery_admin', 'read') then
    raise exception 'No tienes permiso' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name,
           count(s.id),
           coalesce(sum(s.quantity), 0)::bigint,
           coalesce(sum(s.total_cents), 0)::bigint,
           coalesce(sum(s.paid_cents), 0)::bigint,
           coalesce(sum(s.total_cents - s.paid_cents), 0)::bigint
      from public.lottery_campaign_sellers cs
      join public.profiles p on p.id = cs.user_id
      left join public.lottery_sales s on s.seller_id = cs.user_id and s.campaign_id = cs.campaign_id and s.cancelled_at is null
     where cs.campaign_id = p_campaign_id
     group by p.id, p.full_name
     order by 4 desc, 5 desc;
end;
$$;

-- ---------------------------------------------------------------------
-- Auditoría de lotería
-- ---------------------------------------------------------------------
create trigger audit_lottery_campaigns after insert or update or delete on public.lottery_campaigns
  for each row execute function public.audit_trigger();
create trigger audit_lottery_sales after insert or update on public.lottery_sales
  for each row execute function public.audit_trigger();
create trigger audit_lottery_payments after insert on public.lottery_payments
  for each row execute function public.audit_trigger();
create trigger audit_lottery_booklets after insert or update or delete on public.lottery_booklets
  for each row execute function public.audit_trigger();
create trigger audit_lottery_campaign_sellers after insert or delete on public.lottery_campaign_sellers
  for each row execute function public.audit_trigger();
create trigger audit_buyers after update or delete on public.buyers
  for each row execute function public.audit_trigger();
-- Cambios de estado de participaciones fuera de una venta (reservas, anulaciones)
create trigger audit_lottery_shares after update of status on public.lottery_shares
  for each row when (old.status is distinct from new.status and new.status in ('reserved', 'voided'))
  execute function public.audit_trigger();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.lottery_campaigns enable row level security;
alter table public.lottery_campaign_sellers enable row level security;
alter table public.lottery_booklets enable row level security;
alter table public.buyers enable row level security;
alter table public.lottery_sales enable row level security;
alter table public.lottery_shares enable row level security;
alter table public.lottery_payments enable row level security;
alter table public.notifications enable row level security;

-- Campañas: visibles para directiva y vendedores; gestión solo directiva
create policy campaigns_select on public.lottery_campaigns for select to authenticated
  using (public.has_perm('lottery_admin', 'read') or public.has_perm('lottery_sell', 'read'));
create policy campaigns_insert on public.lottery_campaigns for insert to authenticated
  with check (public.has_perm('lottery_admin', 'create'));
create policy campaigns_update on public.lottery_campaigns for update to authenticated
  using (public.has_perm('lottery_admin', 'update')) with check (public.has_perm('lottery_admin', 'update'));
create policy campaigns_delete on public.lottery_campaigns for delete to authenticated
  using (public.has_perm('lottery_admin', 'delete') and status = 'draft'
         and not exists (select 1 from public.lottery_sales s where s.campaign_id = lottery_campaigns.id));

create policy campaign_sellers_select on public.lottery_campaign_sellers for select to authenticated
  using (user_id = auth.uid() or public.has_perm('lottery_admin', 'read'));
create policy campaign_sellers_write on public.lottery_campaign_sellers for all to authenticated
  using (public.has_perm('lottery_admin', 'update')) with check (public.has_perm('lottery_admin', 'update'));

create policy booklets_select on public.lottery_booklets for select to authenticated
  using (seller_id = auth.uid() or public.has_perm('lottery_admin', 'read'));
create policy booklets_write on public.lottery_booklets for all to authenticated
  using (public.has_perm('lottery_admin', 'update')) with check (public.has_perm('lottery_admin', 'update'));

-- Participaciones: sin datos personales; visibles para vendedores (necesitan disponibilidad).
-- Escritura solo mediante las funciones RPC.
create policy shares_select on public.lottery_shares for select to authenticated
  using (public.has_perm('lottery_admin', 'read') or public.has_perm('lottery_sell', 'read'));

-- Ventas: la directiva ve todas; cada vendedor solo las suyas. Escritura solo vía RPC.
create policy sales_select on public.lottery_sales for select to authenticated
  using (public.has_perm('lottery_admin', 'read') or seller_id = auth.uid());

-- Compradores: la directiva ve todos; el vendedor solo los de sus ventas
create policy buyers_select on public.buyers for select to authenticated
  using (public.has_perm('lottery_admin', 'read')
         or exists (select 1 from public.lottery_sales s where s.buyer_id = buyers.id and s.seller_id = auth.uid()));
create policy buyers_update on public.buyers for update to authenticated
  using (public.has_perm('lottery_admin', 'update')) with check (public.has_perm('lottery_admin', 'update'));

create policy payments_select on public.lottery_payments for select to authenticated
  using (public.has_perm('lottery_admin', 'read')
         or exists (select 1 from public.lottery_sales s where s.id = sale_id and s.seller_id = auth.uid()));

create policy notifications_select on public.notifications for select to authenticated
  using (public.has_perm('lottery_admin', 'read')
         or exists (select 1 from public.lottery_sales s where s.id = sale_id and s.seller_id = auth.uid()));
create policy notifications_insert on public.notifications for insert to authenticated
  with check (public.has_perm('lottery_admin', 'update')
         or exists (select 1 from public.lottery_sales s where s.id = sale_id and s.seller_id = auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (created_by = auth.uid() or public.has_perm('lottery_admin', 'update'));

create trigger audit_notifications after insert or update on public.notifications
  for each row execute function public.audit_trigger();

-- Las funciones RPC solo para usuarios autenticados
revoke execute on function public.lottery_register_sale from public, anon;
revoke execute on function public.lottery_add_payment from public, anon;
revoke execute on function public.lottery_cancel_sale from public, anon;
revoke execute on function public.lottery_set_share_status from public, anon;
revoke execute on function public.lottery_campaign_summary from public, anon;
revoke execute on function public.lottery_seller_ranking from public, anon;
revoke execute on function public.log_action from public, anon, authenticated;
revoke execute on function public.lottery_recalc_payment from public, anon, authenticated;
grant execute on function public.lottery_register_sale to authenticated;
grant execute on function public.lottery_add_payment to authenticated;
grant execute on function public.lottery_cancel_sale to authenticated;
grant execute on function public.lottery_set_share_status to authenticated;
grant execute on function public.lottery_campaign_summary to authenticated;
grant execute on function public.lottery_seller_ranking to authenticated;

-- Registro de exportaciones (datos personales de compradores)
create or replace function public.lottery_log_export(p_campaign_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_perm('lottery_admin', 'read') then
    raise exception 'No tienes permiso' using errcode = '42501';
  end if;
  perform public.log_action('EXPORT', 'lottery_campaigns', p_campaign_id::text, null);
end;
$$;
revoke execute on function public.lottery_log_export from public, anon;
grant execute on function public.lottery_log_export to authenticated;
