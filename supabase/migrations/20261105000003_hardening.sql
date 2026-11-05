-- Endurecimiento según los avisos de seguridad de Supabase.
-- Los avisos restantes ("Signed-In Users Can Execute SECURITY DEFINER Function")
-- son intencionados: esas RPC comprueban los permisos por dentro.

alter function public.touch_updated_at() set search_path = public;

-- Funciones de trigger e internas: no se pueden llamar por la API
revoke execute on function public.audit_trigger() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;
revoke execute on function public.lottery_generate_shares() from public, anon, authenticated;
revoke execute on function public.lottery_campaign_shares_resize() from public, anon, authenticated;
revoke execute on function public.lottery_booklet_assign() from public, anon, authenticated;
revoke execute on function public.lottery_payments_after() from public, anon, authenticated;
revoke execute on function public.forbid_change() from public, anon, authenticated;
revoke execute on function public.log_action(text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.lottery_recalc_payment(uuid) from public, anon, authenticated;

-- Resto: solo usuarios con sesión
revoke execute on function public.current_role_name() from public, anon;
revoke execute on function public.has_perm(public.app_module, public.app_action) from public, anon;
revoke execute on function public.is_superadmin() from public, anon;
revoke execute on function public.my_permissions() from public, anon;
revoke execute on function public.lottery_register_sale from public, anon;
revoke execute on function public.lottery_add_payment from public, anon;
revoke execute on function public.lottery_cancel_sale from public, anon;
revoke execute on function public.lottery_set_share_status from public, anon;
revoke execute on function public.lottery_campaign_summary from public, anon;
revoke execute on function public.lottery_seller_ranking from public, anon;
revoke execute on function public.lottery_log_export from public, anon;

grant execute on function public.current_role_name() to authenticated;
grant execute on function public.has_perm(public.app_module, public.app_action) to authenticated;
grant execute on function public.is_superadmin() to authenticated;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.lottery_register_sale to authenticated;
grant execute on function public.lottery_add_payment to authenticated;
grant execute on function public.lottery_cancel_sale to authenticated;
grant execute on function public.lottery_set_share_status to authenticated;
grant execute on function public.lottery_campaign_summary to authenticated;
grant execute on function public.lottery_seller_ranking to authenticated;
grant execute on function public.lottery_log_export to authenticated;

-- Directorio de miembros (solo nombre y rol) mediante función, para que la vista
-- no sea SECURITY DEFINER
create or replace function public.member_list()
returns table (id uuid, full_name text, role public.app_role, active boolean)
language sql stable security definer set search_path = public
as $$
  select p.id, p.full_name, p.role, p.active from public.profiles p where auth.uid() is not null
$$;
revoke execute on function public.member_list() from public, anon;
grant execute on function public.member_list() to authenticated;

create or replace view public.member_directory
with (security_invoker = true) as
  select id, full_name, role, active from public.member_list();
revoke all on public.member_directory from anon;
grant select on public.member_directory to authenticated;
