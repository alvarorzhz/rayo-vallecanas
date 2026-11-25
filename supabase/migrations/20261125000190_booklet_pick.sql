-- =====================================================================
-- v4.31.1 · Talonarios mejores
-- 1) Con talonarios, el vendedor puede elegir números sueltos o un rango
--    DENTRO de su talonario. Si no elige, se le asignan solos como antes.
-- 2) Corregir (rango, vendedor, nombre) o quitar un talonario, sin dejar
--    números vendidos fuera de su talonario.
-- Solo se cambian funciones: no se tocan datos ni ventas ya hechas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Registrar venta
-- ---------------------------------------------------------------------
create or replace function public.lottery_register_sale(
  p_campaign_id        uuid,
  p_buyer_name         text,
  p_buyer_phone        text,
  p_buyer_email        text,
  p_quantity           int,
  p_share_numbers      int[] default null,     -- modo manual, o talonario si el vendedor elige
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
  v_ref       text;
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
  elsif v_campaign.numbering_mode = 'booklet' and p_share_numbers is not null and cardinality(p_share_numbers) > 0 then
    -- 4.31.1 · El vendedor elige dentro de SU talonario
    if cardinality(p_share_numbers) <> p_quantity then
      raise exception 'Indica exactamente % números', p_quantity;
    end if;
    if (select count(distinct x) from unnest(p_share_numbers) x) <> p_quantity then
      raise exception 'Hay números repetidos en la selección';
    end if;
    if exists (
      select 1 from unnest(p_share_numbers) x
       where not exists (
         select 1 from public.lottery_shares sh join public.lottery_booklets b on b.id = sh.booklet_id
          where sh.campaign_id = p_campaign_id and sh.share_number = x and b.seller_id = v_seller)
    ) then
      raise exception 'Solo puedes vender números de tu talonario (%)', (
        select string_agg(x::text, ', ' order by x) from unnest(p_share_numbers) x
         where not exists (
           select 1 from public.lottery_shares sh join public.lottery_booklets b on b.id = sh.booklet_id
            where sh.campaign_id = p_campaign_id and sh.share_number = x and b.seller_id = v_seller));
    end if;
    select array_agg(id order by share_number) into v_ids from (
      select sh.id, sh.share_number from public.lottery_shares sh
       where sh.campaign_id = p_campaign_id and sh.share_number = any (p_share_numbers) and sh.status = 'available'
       order by sh.share_number
       for update of sh
    ) s;
    if coalesce(cardinality(v_ids), 0) < p_quantity then
      raise exception 'Alguno de esos números ya está vendido: %', (
        select string_agg(sh.share_number::text, ', ' order by sh.share_number) from public.lottery_shares sh
         where sh.campaign_id = p_campaign_id and sh.share_number = any (p_share_numbers) and sh.status <> 'available');
    end if;
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

  -- La referencia es única en todo el club: sorteos con el mismo prefijo y año se esperan
  -- unos a otros y, si el número ya lo usó otro sorteo, se pasa al siguiente libre.
  perform pg_advisory_xact_lock(hashtext('lottery_sale_ref:' || v_campaign.ref_prefix || '-' || v_campaign.year));
  loop
    update public.lottery_campaigns set sale_seq = sale_seq + 1 where id = p_campaign_id
    returning sale_seq into v_seq;
    v_ref := format('%s-%s-%s', v_campaign.ref_prefix, v_campaign.year, lpad(v_seq::text, 4, '0'));
    exit when not exists (select 1 from public.lottery_sales where reference = v_ref);
  end loop;

  insert into public.lottery_sales (
    campaign_id, reference, buyer_id, seller_id, quantity, unit_price_cents, total_cents,
    preferred_channel, notes
  ) values (
    p_campaign_id,
    v_ref,
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

revoke execute on function public.lottery_register_sale from public, anon;
grant execute on function public.lottery_register_sale to authenticated;

-- ---------------------------------------------------------------------
-- 2) Corregir o quitar un talonario
-- ---------------------------------------------------------------------
create or replace function public.lottery_update_booklet(
  p_id uuid, p_seller_id uuid, p_from int, p_to int, p_label text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_b      public.lottery_booklets;
  v_total  int;
  v_sold   int;
  v_out    text;
begin
  if not public.has_perm('lottery_admin', 'update') then
    raise exception 'No tienes permiso para cambiar talonarios' using errcode = '42501';
  end if;
  select * into v_b from public.lottery_booklets where id = p_id for update;
  if not found then raise exception 'El talonario no existe'; end if;
  select total_shares into v_total from public.lottery_campaigns where id = v_b.campaign_id for update;
  if p_from is null or p_to is null or p_from < 1 or p_to < p_from then
    raise exception 'El rango no es válido';
  end if;
  if p_to > v_total then
    raise exception 'El talonario supera el total de números (%)', v_total;
  end if;

  select count(*) into v_sold from public.lottery_shares where booklet_id = p_id and status = 'sold';
  if v_sold > 0 and p_seller_id is distinct from v_b.seller_id then
    raise exception 'Ya tiene % vendidos: no se puede pasar a otro vendedor (anula esas ventas antes)', v_sold;
  end if;
  select string_agg(share_number::text, ', ' order by share_number) into v_out
    from public.lottery_shares where booklet_id = p_id and status = 'sold' and share_number not between p_from and p_to;
  if v_out is not null then
    raise exception 'Hay números vendidos que se quedarían fuera del talonario: %', v_out;
  end if;
  if exists (select 1 from public.lottery_shares
              where campaign_id = v_b.campaign_id and share_number between p_from and p_to
                and booklet_id is not null and booklet_id <> p_id) then
    raise exception 'El rango %-% se solapa con otro talonario', p_from, p_to;
  end if;

  update public.lottery_shares set booklet_id = null
   where booklet_id = p_id and share_number not between p_from and p_to;
  update public.lottery_shares set booklet_id = p_id
   where campaign_id = v_b.campaign_id and share_number between p_from and p_to;
  update public.lottery_booklets
     set seller_id = p_seller_id, from_number = p_from, to_number = p_to, label = nullif(left(trim(p_label), 80), '')
   where id = p_id;
  insert into public.lottery_campaign_sellers (campaign_id, user_id)
  values (v_b.campaign_id, p_seller_id) on conflict do nothing;
  perform public.log_action('UPDATE', 'lottery_booklets', p_id::text, jsonb_build_object(
    'antes', jsonb_build_object('vendedor', v_b.seller_id, 'desde', v_b.from_number, 'hasta', v_b.to_number),
    'ahora', jsonb_build_object('vendedor', p_seller_id, 'desde', p_from, 'hasta', p_to)));
end;
$$;

create or replace function public.lottery_delete_booklet(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_sold int;
begin
  if not public.has_perm('lottery_admin', 'update') then
    raise exception 'No tienes permiso para quitar talonarios' using errcode = '42501';
  end if;
  select count(*) into v_sold from public.lottery_shares where booklet_id = p_id and status = 'sold';
  if v_sold > 0 then
    raise exception 'Este talonario ya tiene % vendidos: no se puede quitar (puedes recortarlo o anular esas ventas)', v_sold;
  end if;
  update public.lottery_shares set booklet_id = null where booklet_id = p_id;
  perform public.log_action('DELETE', 'lottery_booklets', p_id::text,
    (select jsonb_build_object('vendedor', seller_id, 'desde', from_number, 'hasta', to_number) from public.lottery_booklets where id = p_id));
  delete from public.lottery_booklets where id = p_id;
end;
$$;

revoke execute on function public.lottery_update_booklet(uuid, uuid, int, int, text) from public, anon;
revoke execute on function public.lottery_delete_booklet(uuid) from public, anon;
grant execute on function public.lottery_update_booklet(uuid, uuid, int, int, text) to authenticated;
grant execute on function public.lottery_delete_booklet(uuid) to authenticated;
