-- =====================================================================
-- v4.20.0 · Cuentas de cada vendedor (Sorteos)
-- Lo que cada vendedor ha cobrado a sus compradores y todavía no ha
-- entregado al club. Cada entrega se apunta aquí (quién, cuánto, cómo).
-- Las entregas NO crean movimientos en Finanzas: la recaudación se sigue
-- pasando con «Pasar a Finanzas» como hasta ahora, para no contarla dos veces.
-- =====================================================================

create table if not exists public.lottery_handovers (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.lottery_campaigns (id) on delete cascade,
  seller_id     uuid not null references public.profiles (id),
  amount_cents  int not null check (amount_cents > 0),
  method        public.payment_method not null default 'cash',
  handed_on     date not null default ((now() at time zone 'Europe/Madrid')::date),
  notes         text check (notes is null or length(notes) <= 300),
  registered_by uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  voided_at     timestamptz,
  voided_by     uuid
);
create index if not exists lottery_handovers_campaign_idx on public.lottery_handovers (campaign_id, seller_id);

alter table public.lottery_handovers enable row level security;
drop policy if exists handovers_select on public.lottery_handovers;
create policy handovers_select on public.lottery_handovers for select to authenticated
  using (public.has_perm('lottery_admin', 'read') or seller_id = auth.uid());
-- Escritura solo con las funciones de abajo
revoke insert, update, delete on public.lottery_handovers from anon, authenticated;

drop trigger if exists audit_lottery_handovers on public.lottery_handovers;
create trigger audit_lottery_handovers after insert or update or delete on public.lottery_handovers
  for each row execute function public.audit_trigger();

-- Cuentas por vendedor: la directiva ve a todos; cada vendedor, solo lo suyo
create or replace function public.lottery_seller_accounts(p_campaign_id uuid)
returns table (seller_id uuid, full_name text, shares bigint, sold_cents bigint, paid_cents bigint, handed_cents bigint)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_admin boolean := public.has_perm('lottery_admin', 'read');
begin
  if not (v_admin or public.has_perm('lottery_sell', 'read')) then
    raise exception 'No tienes permiso' using errcode = '42501';
  end if;
  return query
    with sellers as (
      select cs.user_id as id from public.lottery_campaign_sellers cs where cs.campaign_id = p_campaign_id
      union
      select s.seller_id from public.lottery_sales s where s.campaign_id = p_campaign_id and s.cancelled_at is null
    ),
    sales as (
      select s.seller_id, sum(s.quantity)::bigint q, sum(s.total_cents)::bigint t, sum(s.paid_cents)::bigint p
        from public.lottery_sales s where s.campaign_id = p_campaign_id and s.cancelled_at is null group by s.seller_id
    ),
    handed as (
      select h.seller_id, sum(h.amount_cents)::bigint a
        from public.lottery_handovers h where h.campaign_id = p_campaign_id and h.voided_at is null group by h.seller_id
    )
    select x.id, p.full_name, coalesce(sa.q, 0), coalesce(sa.t, 0), coalesce(sa.p, 0), coalesce(h.a, 0)
      from sellers x
      join public.profiles p on p.id = x.id
      left join sales sa on sa.seller_id = x.id
      left join handed h on h.seller_id = x.id
     where v_admin or x.id = auth.uid()
     order by coalesce(sa.p, 0) - coalesce(h.a, 0) desc, p.full_name;
end;
$$;

-- Apunta una entrega de un vendedor al club
create or replace function public.lottery_add_handover(
  p_campaign_id uuid, p_seller_id uuid, p_amount_cents int, p_method public.payment_method default 'cash',
  p_handed_on date default null, p_notes text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.has_perm('lottery_admin', 'update') then
    raise exception 'No tienes permiso para apuntar entregas' using errcode = '42501';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'La cantidad tiene que ser mayor que cero';
  end if;
  if not exists (select 1 from public.lottery_campaigns where id = p_campaign_id) then
    raise exception 'El sorteo no existe';
  end if;
  insert into public.lottery_handovers (campaign_id, seller_id, amount_cents, method, handed_on, notes)
  values (p_campaign_id, p_seller_id, p_amount_cents, coalesce(p_method, 'cash'),
          coalesce(p_handed_on, (now() at time zone 'Europe/Madrid')::date), nullif(left(trim(p_notes), 300), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Anula una entrega apuntada por error
create or replace function public.lottery_void_handover(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_perm('lottery_admin', 'update') then
    raise exception 'No tienes permiso' using errcode = '42501';
  end if;
  update public.lottery_handovers set voided_at = now(), voided_by = auth.uid() where id = p_id and voided_at is null;
end;
$$;

revoke execute on function public.lottery_seller_accounts(uuid) from public, anon;
revoke execute on function public.lottery_add_handover(uuid, uuid, int, public.payment_method, date, text) from public, anon;
revoke execute on function public.lottery_void_handover(uuid) from public, anon;
grant execute on function public.lottery_seller_accounts(uuid) to authenticated;
grant execute on function public.lottery_add_handover(uuid, uuid, int, public.payment_method, date, text) to authenticated;
grant execute on function public.lottery_void_handover(uuid) to authenticated;
