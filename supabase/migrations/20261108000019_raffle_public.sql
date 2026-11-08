-- =====================================================================
-- v3.11.0 · Página pública de la rifa y transparencia del sorteo
--
-- · Cada rifa puede tener una página pública (sin iniciar sesión), apagada por defecto.
-- · Al cerrar las ventas se congela la lista de números vendidos y se guarda su huella
--   (SHA-256 de los números separados por comas, de menor a mayor).
-- · Acta pública: cierres, reaperturas y sorteo quedan apuntados y no se pueden editar.
-- · La página nunca muestra nombres, teléfonos ni vendedores: solo números.
-- =====================================================================

alter table public.lottery_campaigns
  add column public_enabled boolean not null default false,
  add column public_slug    text unique check (public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(public_slug) between 4 and 60),
  add column prize_text     text check (length(prize_text) <= 300),
  add column public_purpose text check (length(public_purpose) <= 600);

-- ---------------------------------------------------------------------
-- Acta de la rifa (solo se escribe desde el trigger; nadie puede editarla)
-- ---------------------------------------------------------------------
create table public.lottery_raffle_events (
  id             bigint generated always as identity primary key,
  campaign_id    uuid not null references public.lottery_campaigns (id) on delete cascade,
  kind           text not null check (kind in ('closed', 'reopened', 'drawn')),
  sold_count     int,
  sold_numbers   int[],
  fingerprint    text,
  winning_number int,
  draw_mode      text check (draw_mode in ('random', 'manual')),
  actor_name     text,
  created_at     timestamptz not null default now()
);
create index lottery_raffle_events_campaign_idx on public.lottery_raffle_events (campaign_id, id);

alter table public.lottery_raffle_events enable row level security;
revoke all on public.lottery_raffle_events from anon, authenticated;
grant select on public.lottery_raffle_events to authenticated;
create policy raffle_events_select on public.lottery_raffle_events for select to authenticated
  using (public.has_perm('lottery_admin', 'read'));

-- Huella de una lista de números: sha256("1,4,7") en hexadecimal.
create or replace function public.raffle_fingerprint(p_numbers int[])
returns text
language sql immutable set search_path = public
as $$
  select encode(sha256(convert_to(coalesce(array_to_string(p_numbers, ','), ''), 'UTF8')), 'hex')
$$;

create or replace function public.raffle_sold_numbers(p_campaign_id uuid)
returns int[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array_agg(share_number order by share_number), '{}')
    from public.lottery_shares where campaign_id = p_campaign_id and status = 'sold'
$$;
revoke execute on function public.raffle_sold_numbers(uuid) from public, anon, authenticated;

create or replace function public.raffle_log_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_actor   text := (select nullif(full_name, '') from public.profiles where id = auth.uid());
  v_numbers int[];
begin
  if new.kind <> 'raffle' or new.status = old.status then return new; end if;

  -- Cierre de ventas (también si se sortea sin haber cerrado antes)
  if old.status = 'active' and new.status in ('closed', 'drawn') then
    v_numbers := public.raffle_sold_numbers(new.id);
    insert into public.lottery_raffle_events (campaign_id, kind, sold_count, sold_numbers, fingerprint, actor_name)
    values (new.id, 'closed', cardinality(v_numbers), v_numbers, public.raffle_fingerprint(v_numbers), v_actor);
  elsif old.status = 'closed' and new.status = 'active' then
    insert into public.lottery_raffle_events (campaign_id, kind, actor_name) values (new.id, 'reopened', v_actor);
  end if;

  if new.status = 'drawn' then
    insert into public.lottery_raffle_events (campaign_id, kind, winning_number, draw_mode, actor_name)
    values (new.id, 'drawn', new.winning_number, nullif(current_setting('rayo.draw_mode', true), ''), v_actor);
  end if;
  return new;
end;
$$;
create trigger lottery_campaign_raffle_log after update of status on public.lottery_campaigns
  for each row execute function public.raffle_log_status();

-- El sorteo deja dicho si fue al azar o con número indicado, para el acta.
create or replace function public.lottery_draw_winner(p_campaign_id uuid, p_number int default null)
returns table (winning_number int, reference text, buyer_name text, buyer_phone text, seller_name text)
language plpgsql security definer set search_path = public
as $$
declare
  v_campaign public.lottery_campaigns;
  v_number   int := p_number;
begin
  if not public.has_perm('lottery_admin', 'update') then
    raise exception 'No tienes permiso para realizar el sorteo' using errcode = '42501';
  end if;
  select * into v_campaign from public.lottery_campaigns where id = p_campaign_id for update;
  if not found then raise exception 'Campaña no encontrada'; end if;
  if v_campaign.kind <> 'raffle' then raise exception 'El sorteo automático solo existe para rifas'; end if;
  if v_campaign.winning_number is not null then
    raise exception 'La rifa ya tiene número ganador (%)', v_campaign.winning_number;
  end if;

  if v_number is null then
    select share_number into v_number from public.lottery_shares
     where campaign_id = p_campaign_id and status = 'sold'
     order by random() limit 1;
    if v_number is null then raise exception 'No hay números vendidos'; end if;
  elsif v_number < 1 or v_number > v_campaign.total_shares then
    raise exception 'El número debe estar entre 1 y %', v_campaign.total_shares;
  end if;

  perform set_config('rayo.draw_mode', case when p_number is null then 'random' else 'manual' end, true);
  update public.lottery_campaigns set winning_number = v_number, status = 'drawn' where id = p_campaign_id;
  perform public.log_action('DRAW', 'lottery_campaigns', p_campaign_id::text,
    jsonb_build_object('winning_number', v_number, 'random', p_number is null));

  return query
    select v_number, s.reference, b.full_name, b.phone, p.full_name
      from (select 1) x
      left join public.lottery_shares sh on sh.campaign_id = p_campaign_id and sh.share_number = v_number
      left join public.lottery_sales s on s.id = sh.sale_id
      left join public.buyers b on b.id = s.buyer_id
      left join public.profiles p on p.id = s.seller_id;
end;
$$;
revoke execute on function public.lottery_draw_winner(uuid, int) from public, anon;
grant execute on function public.lottery_draw_winner(uuid, int) to authenticated;

-- Un sorteo ya hecho no se puede «deshacer» cambiando el estado o el número a mano.
create or replace function public.raffle_lock_drawn()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if old.kind = 'raffle' and old.status = 'drawn'
     and (new.status <> 'drawn' or new.winning_number is distinct from old.winning_number) then
    raise exception 'La rifa ya está sorteada: el resultado no se puede cambiar';
  end if;
  return new;
end;
$$;
create trigger lottery_campaign_raffle_lock before update of status, winning_number on public.lottery_campaigns
  for each row execute function public.raffle_lock_drawn();

-- ---------------------------------------------------------------------
-- Lectura pública (anon): solo campos de una lista cerrada
-- ---------------------------------------------------------------------
create or replace function public.raffle_public(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  c        public.lottery_campaigns;
  v_closed public.lottery_raffle_events;
  v_sold   int[];
begin
  select * into c from public.lottery_campaigns
   where public_slug = lower(trim(p_slug)) and public_enabled and kind = 'raffle' and status <> 'draft';
  if not found then return null; end if;

  -- Con las ventas cerradas manda la lista congelada; en venta, la actual.
  if c.status in ('closed', 'drawn') then
    select * into v_closed from public.lottery_raffle_events
     where campaign_id = c.id and kind = 'closed' order by id desc limit 1;
  end if;
  v_sold := coalesce(v_closed.sold_numbers, public.raffle_sold_numbers(c.id));

  return jsonb_build_object(
    'name', c.name,
    'year', c.year,
    'draw_date', c.draw_date,
    'price_cents', c.price_cents,
    'total', c.total_shares,
    'status', c.status,
    'prize', c.prize_text,
    'purpose', c.public_purpose,
    'sold_numbers', to_jsonb(v_sold),
    'voided_numbers', (select coalesce(jsonb_agg(share_number order by share_number), '[]')
                         from public.lottery_shares where campaign_id = c.id and status = 'voided'),
    'winning_number', c.winning_number,
    'raised_cents', case when c.status = 'drawn' then
                      (select coalesce(sum(paid_cents), 0) from public.lottery_sales
                        where campaign_id = c.id and cancelled_at is null) end,
    'events', (select coalesce(jsonb_agg(jsonb_build_object(
                  'kind', e.kind, 'at', e.created_at, 'sold_count', e.sold_count,
                  'sold_numbers', e.sold_numbers, 'fingerprint', e.fingerprint,
                  'winning_number', e.winning_number, 'draw_mode', e.draw_mode,
                  'actor', e.actor_name) order by e.id), '[]')
                 from public.lottery_raffle_events e where e.campaign_id = c.id)
  );
end;
$$;
revoke execute on function public.raffle_public(text) from public;
grant execute on function public.raffle_public(text) to anon, authenticated;

-- «Comprueba tu número»: hace falta el número y la referencia del justificante.
-- No devuelve datos personales: solo si está registrado, pagado y en la lista cerrada.
create or replace function public.raffle_public_check(p_slug text, p_number int, p_reference text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  c        public.lottery_campaigns;
  v_sale   public.lottery_sales;
  v_frozen int[];
begin
  select * into c from public.lottery_campaigns
   where public_slug = lower(trim(p_slug)) and public_enabled and kind = 'raffle' and status <> 'draft';
  if not found then return null; end if;

  select s.* into v_sale
    from public.lottery_shares sh join public.lottery_sales s on s.id = sh.sale_id
   where sh.campaign_id = c.id and sh.share_number = p_number and sh.status = 'sold'
     and s.cancelled_at is null
     and upper(replace(s.reference, ' ', '')) = upper(replace(trim(p_reference), ' ', ''));
  if not found then return jsonb_build_object('found', false); end if;

  select sold_numbers into v_frozen from public.lottery_raffle_events
   where campaign_id = c.id and kind = 'closed' order by id desc limit 1;

  return jsonb_build_object(
    'found', true,
    'number', p_number,
    'sold_on', (v_sale.created_at at time zone 'Europe/Madrid')::date,
    'paid', v_sale.payment_status = 'paid',
    'in_frozen_list', case when c.status in ('closed', 'drawn') and v_frozen is not null then p_number = any (v_frozen) end,
    'winner', c.winning_number is not null and c.winning_number = p_number
  );
end;
$$;
revoke execute on function public.raffle_public_check(text, int, text) from public;
grant execute on function public.raffle_public_check(text, int, text) to anon, authenticated;
