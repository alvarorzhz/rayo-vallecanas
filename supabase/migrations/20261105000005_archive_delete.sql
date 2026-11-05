-- =====================================================================
-- Archivar y eliminar campañas (solo superadministradores)
-- =====================================================================

alter table public.lottery_campaigns add column archived_at timestamptz;

-- Solo un superadministrador puede archivar o desarchivar.
-- Una campaña archivada no puede estar con ventas abiertas.
create or replace function public.guard_campaign_archive()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.archived_at is distinct from old.archived_at and not public.is_superadmin() then
    raise exception 'Solo un superadministrador puede archivar campañas' using errcode = '42501';
  end if;
  if new.archived_at is not null and new.status = 'active' then
    raise exception 'Cierra las ventas antes de archivar la campaña';
  end if;
  return new;
end;
$$;
create trigger lottery_campaigns_archive_guard before update on public.lottery_campaigns
  for each row execute function public.guard_campaign_archive();

-- Los registros económicos siguen sin poder borrarse, salvo dentro de
-- lottery_delete_campaign (marca de transacción + superadministrador).
create or replace function public.forbid_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and current_setting('rayo.purge_campaign', true) = 'on' and public.is_superadmin() then
    return old;
  end if;
  raise exception 'Operación no permitida: los registros económicos no se modifican ni se borran; registra una corrección';
end;
$$;

-- ---------------------------------------------------------------------
-- Eliminación definitiva. Hay que escribir el nombre exacto para confirmar.
-- Deja en auditoría una copia de la campaña y el resumen de sus ventas.
-- ---------------------------------------------------------------------
create or replace function public.lottery_delete_campaign(p_campaign_id uuid, p_confirm_name text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_campaign public.lottery_campaigns;
  v_summary  jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'Solo un superadministrador puede eliminar campañas' using errcode = '42501';
  end if;
  select * into v_campaign from public.lottery_campaigns where id = p_campaign_id for update;
  if not found then raise exception 'Campaña no encontrada'; end if;
  if trim(coalesce(p_confirm_name, '')) <> trim(v_campaign.name) then
    raise exception 'El nombre escrito no coincide con el de la campaña';
  end if;

  select jsonb_build_object(
           'sales', count(*),
           'sold_cents', coalesce(sum(total_cents) filter (where cancelled_at is null), 0),
           'paid_cents', coalesce(sum(paid_cents), 0))
    into v_summary
    from public.lottery_sales where campaign_id = p_campaign_id;

  perform public.log_action('DELETE_CAMPAIGN', 'lottery_campaigns', p_campaign_id::text,
    jsonb_build_object('campaign', to_jsonb(v_campaign), 'summary', v_summary));

  perform set_config('rayo.purge_campaign', 'on', true);
  delete from public.notifications n using public.lottery_sales s
   where n.sale_id = s.id and s.campaign_id = p_campaign_id;
  delete from public.lottery_shares where campaign_id = p_campaign_id;
  delete from public.lottery_payments p using public.lottery_sales s
   where p.sale_id = s.id and s.campaign_id = p_campaign_id;
  delete from public.lottery_sales where campaign_id = p_campaign_id;
  delete from public.lottery_campaigns where id = p_campaign_id;
  perform set_config('rayo.purge_campaign', 'off', true);
end;
$$;
revoke execute on function public.lottery_delete_campaign(uuid, text) from public, anon;
grant execute on function public.lottery_delete_campaign(uuid, text) to authenticated;
