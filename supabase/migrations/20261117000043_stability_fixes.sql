-- =====================================================================
-- v4.20.1 · Dos arreglos que han sacado las pruebas automáticas
-- Solo se cambian funciones: no se tocan datos ni ventas ya hechas.
--
-- 1) Referencias de venta que no chocan entre sorteos.
-- La referencia de cada venta es PREFIJO-AÑO-NNNN y es única en todo el club.
-- Cada sorteo lleva su propio contador, así que dos sorteos del mismo año con
-- el mismo prefijo (el «RV» que viene puesto) daban la misma referencia a su
-- primera venta y la segunda fallaba con «duplicate key ... reference_key».
-- Ahora, si la referencia ya existe, se salta al siguiente número libre, y las
-- ventas de sorteos con el mismo prefijo y año se apuntan de una en una.
--
-- 2) Eliminar un sorteo que ya se había pasado a Finanzas.
-- Sus movimientos se conservan y solo pierden el enlace con el sorteo, pero
-- la comprobación de los movimientos comparaba también la temporada, que en
-- ese momento todavía viene vacía (es una columna calculada), y paraba el
-- borrado con «Ese dato del movimiento no se puede cambiar».
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

-- ---------------------------------------------------------------------
-- 2) Comprobación de los movimientos de Finanzas
-- ---------------------------------------------------------------------
create or replace function public.finance_movement_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_kind public.finance_kind;
begin
  select kind into v_kind from public.finance_categories where id = new.category_id;
  if v_kind is distinct from new.kind then
    raise exception 'La categoría no corresponde a un %', case new.kind when 'income' then 'ingreso' else 'gasto' end;
  end if;
  if tg_op = 'UPDATE' then
    -- Al eliminar un sorteo, sus movimientos se conservan y solo pierden el enlace
    -- («season» es una columna generada: en este momento todavía viene vacía)
    if new.campaign_id is null and old.campaign_id is not null
       and (to_jsonb(new) - 'campaign_id' - 'season') = (to_jsonb(old) - 'campaign_id' - 'season') then
      return new;
    end if;
    -- Al borrar un plazo de patrocinio con cobros anulados, esos cobros solo pierden el enlace
    -- («season» es una columna generada: en este momento todavía viene vacía)
    if new.sponsor_installment_id is null and old.sponsor_installment_id is not null
       and (to_jsonb(new) - 'sponsor_installment_id' - 'season') = (to_jsonb(old) - 'sponsor_installment_id' - 'season') then
      return new;
    end if;
    if current_setting('rv.finance_void', true) is distinct from '1' then
      if old.voided_at is not null then
        raise exception 'Un movimiento anulado no se puede modificar' using errcode = '42501';
      end if;
      if new.voided_at is distinct from old.voided_at or new.voided_by is distinct from old.voided_by
         or new.void_reason is distinct from old.void_reason then
        raise exception 'Para anular un movimiento usa la opción Anular' using errcode = '42501';
      end if;
    end if;
    if new.kind <> old.kind or new.created_by <> old.created_by or new.created_at <> old.created_at
       or new.campaign_id is distinct from old.campaign_id
       or new.sponsor_installment_id is distinct from old.sponsor_installment_id then
      raise exception 'Ese dato del movimiento no se puede cambiar' using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
