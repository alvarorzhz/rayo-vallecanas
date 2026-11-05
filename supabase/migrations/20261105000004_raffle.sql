-- =====================================================================
-- Modo rifa: números del 1 al N, cada uno vendido a una persona.
-- Reutiliza lottery_shares (cada participación = un número de la rifa).
-- =====================================================================

create type public.campaign_kind as enum ('lottery', 'raffle');

alter table public.lottery_campaigns
  add column kind public.campaign_kind not null default 'lottery',
  add column winning_number int;

-- En una rifa no hay número de lotería
alter table public.lottery_campaigns alter column lottery_number drop not null;
alter table public.lottery_campaigns
  add constraint lottery_campaigns_number_by_kind
  check (kind = 'raffle' or lottery_number is not null);

-- ---------------------------------------------------------------------
-- Sorteo de la rifa: número indicado o al azar entre los vendidos.
-- Devuelve el ganador (número, referencia, comprador y vendedor).
-- ---------------------------------------------------------------------
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
