-- 4.20.3 · Avisos del asesor de Supabase (Advisors → Security / Performance)
--
-- Nada de esto cambia lo que cada persona puede ver o hacer en la app:
--   1. Dos funciones internas de disparador se podían llamar desde fuera (también sin sesión). No sirve de
--      nada llamarlas así (Postgres lo rechaza), pero se cierran como el resto de disparadores.
--   2. member_list() no la usa la app y dejaba a cualquier jugador con sesión ver la lista de usuarios con su
--      perfil. Se cierra (solo el servidor).
--   3. player_public_name() con search_path fijo, como las demás funciones.
--   4. Rendimiento: las políticas que miran auth.uid() lo calculan una vez por consulta, no fila a fila.
--   5. Rendimiento: las políticas «_write» (FOR ALL) se parten en insert/update/delete para que la lectura
--      solo pase por una política. La de lectura suma la condición de escritura, así que quien podía leer
--      algo gracias a la de escritura lo sigue pudiendo leer.
--
-- Se quedan a propósito (no son fallos):
--   · news_public, news_public_list, raffle_public, raffle_public_check: abiertas sin sesión porque son las
--     noticias y la rifa públicas. Solo devuelven lo publicado.
--   · El resto de funciones SECURITY DEFINER que llama la app: cada una comprueba dentro quién llama
--     (has_perm, is_superadmin o auth.uid()), y las de permisos (has_perm, is_my_player…) las usan las políticas.

-- 1. Disparadores: nadie los llama directamente
revoke execute on function public.player_ratings_sync_candidates() from public, anon, authenticated;
revoke execute on function public.raffle_log_status() from public, anon, authenticated;

-- 2. member_list(): sin uso en la app
revoke execute on function public.member_list() from public, anon, authenticated;

-- 3. search_path fijo (solo usa funciones de pg_catalog)
alter function public.player_public_name(public.players) set search_path = '';

-- 4. auth.uid() una vez por consulta
alter policy birthday_wishes_delete on public.birthday_wishes
  using ((user_id = (select auth.uid())));
alter policy birthday_wishes_insert on public.birthday_wishes
  with check (((user_id = (select auth.uid())) AND has_perm('squad'::app_module, 'read'::app_action)));
alter policy buyers_select on public.buyers
  using ((has_perm('lottery_admin'::app_module, 'read'::app_action) OR (EXISTS ( SELECT 1
   FROM lottery_sales s
  WHERE ((s.buyer_id = buyers.id) AND (s.seller_id = (select auth.uid())))))));
alter policy fin_movements_insert on public.finance_movements
  with check ((has_perm('finances'::app_module, 'create'::app_action) AND (created_by = (select auth.uid())) AND (voided_at IS NULL)));
alter policy handovers_select on public.lottery_handovers
  using ((has_perm('lottery_admin'::app_module, 'read'::app_action) OR (seller_id = (select auth.uid()))));
alter policy payments_select on public.lottery_payments
  using ((has_perm('lottery_admin'::app_module, 'read'::app_action) OR (EXISTS ( SELECT 1
   FROM lottery_sales s
  WHERE ((s.id = lottery_payments.sale_id) AND (s.seller_id = (select auth.uid())))))));
alter policy sales_select on public.lottery_sales
  using ((has_perm('lottery_admin'::app_module, 'read'::app_action) OR (seller_id = (select auth.uid()))));
alter policy match_predictions_select on public.match_predictions
  using (((user_id = (select auth.uid())) OR (NOT porra_open(match_id))));
alter policy mvp_votes_select on public.mvp_votes
  using ((voter_id = (select auth.uid())));
alter policy news_delete on public.news_articles
  using ((has_perm('news'::app_module, 'delete'::app_action) OR ((created_by = (select auth.uid())) AND (status = 'draft'::text))));
alter policy news_insert on public.news_articles
  with check ((has_perm('news'::app_module, 'create'::app_action) AND (created_by = (select auth.uid()))));
alter policy news_update on public.news_articles
  using ((has_perm('news'::app_module, 'update'::app_action) OR ((created_by = (select auth.uid())) AND has_perm('news'::app_module, 'create'::app_action))))
  with check ((has_perm('news'::app_module, 'update'::app_action) OR ((created_by = (select auth.uid())) AND has_perm('news'::app_module, 'create'::app_action))));
alter policy news_reactions_delete on public.news_reactions
  using ((user_id = (select auth.uid())));
alter policy news_reactions_insert on public.news_reactions
  with check (((user_id = (select auth.uid())) AND has_perm('news'::app_module, 'read'::app_action) AND (EXISTS ( SELECT 1
   FROM news_articles a
  WHERE ((a.id = news_reactions.article_id) AND (a.status = 'published'::text))))));
alter policy news_reactions_update on public.news_reactions
  using ((user_id = (select auth.uid())))
  with check (((user_id = (select auth.uid())) AND has_perm('news'::app_module, 'read'::app_action)));
alter policy notifications_insert on public.notifications
  with check ((has_perm('lottery_admin'::app_module, 'update'::app_action) OR (EXISTS ( SELECT 1
   FROM lottery_sales s
  WHERE ((s.id = notifications.sale_id) AND (s.seller_id = (select auth.uid())))))));
alter policy notifications_select on public.notifications
  using ((has_perm('lottery_admin'::app_module, 'read'::app_action) OR (EXISTS ( SELECT 1
   FROM lottery_sales s
  WHERE ((s.id = notifications.sale_id) AND (s.seller_id = (select auth.uid())))))));
alter policy notifications_update on public.notifications
  using (((created_by = (select auth.uid())) OR has_perm('lottery_admin'::app_module, 'update'::app_action)));
alter policy player_documents_delete on public.player_documents
  using ((has_perm('squad_private'::app_module, 'delete'::app_action) OR (is_my_player(player_id) AND (uploaded_by = (select auth.uid())))));
alter policy player_documents_insert on public.player_documents
  with check (((has_perm('squad_private'::app_module, 'create'::app_action) OR is_my_player(player_id)) AND (uploaded_by = (select auth.uid()))));
alter policy player_ratings_select on public.player_ratings
  using ((voter_id = (select auth.uid())));
alter policy poll_votes_select on public.poll_votes
  using ((user_id = (select auth.uid())));
alter policy profiles_select on public.profiles
  using (((id = (select auth.uid())) OR has_perm('users'::app_module, 'read'::app_action)));
alter policy profiles_update_self on public.profiles
  using (((id = (select auth.uid())) OR has_perm('users'::app_module, 'update'::app_action)))
  with check (((id = (select auth.uid())) OR has_perm('users'::app_module, 'update'::app_action)));
alter policy push_own_delete on public.push_subscriptions
  using ((user_id = (select auth.uid())));
alter policy push_own_insert on public.push_subscriptions
  with check ((user_id = (select auth.uid())));
alter policy push_own_select on public.push_subscriptions
  using ((user_id = (select auth.uid())));
alter policy push_own_update on public.push_subscriptions
  using ((user_id = (select auth.uid())))
  with check ((user_id = (select auth.uid())));

-- 5. Una sola política permisiva por acción (y auth.uid() una vez por consulta en las de lectura)
-- custom_role_permissions
drop policy custom_role_permissions_write on public.custom_role_permissions;
create policy custom_role_permissions_insert on public.custom_role_permissions for insert to authenticated with check (is_superadmin());
create policy custom_role_permissions_update on public.custom_role_permissions for update to authenticated using (is_superadmin()) with check (is_superadmin());
create policy custom_role_permissions_delete on public.custom_role_permissions for delete to authenticated using (is_superadmin());

-- custom_roles
drop policy custom_roles_write on public.custom_roles;
create policy custom_roles_insert on public.custom_roles for insert to authenticated with check (is_superadmin());
create policy custom_roles_update on public.custom_roles for update to authenticated using (is_superadmin()) with check (is_superadmin());
create policy custom_roles_delete on public.custom_roles for delete to authenticated using (is_superadmin());

-- league_competitions
alter policy league_competitions_select on public.league_competitions
  using ((has_perm('matches'::app_module, 'read'::app_action)) OR (has_perm('matches'::app_module, 'update'::app_action)));
drop policy league_competitions_write on public.league_competitions;
create policy league_competitions_insert on public.league_competitions for insert to authenticated with check (has_perm('matches'::app_module, 'update'::app_action));
create policy league_competitions_update on public.league_competitions for update to authenticated using (has_perm('matches'::app_module, 'update'::app_action)) with check (has_perm('matches'::app_module, 'update'::app_action));
create policy league_competitions_delete on public.league_competitions for delete to authenticated using (has_perm('matches'::app_module, 'update'::app_action));

-- league_sync
alter policy league_sync_select on public.league_sync
  using ((has_perm('matches'::app_module, 'read'::app_action)) OR (has_perm('matches'::app_module, 'update'::app_action)));
drop policy league_sync_write on public.league_sync;
create policy league_sync_insert on public.league_sync for insert to authenticated with check (has_perm('matches'::app_module, 'update'::app_action));
create policy league_sync_update on public.league_sync for update to authenticated using (has_perm('matches'::app_module, 'update'::app_action)) with check (has_perm('matches'::app_module, 'update'::app_action));
create policy league_sync_delete on public.league_sync for delete to authenticated using (has_perm('matches'::app_module, 'update'::app_action));

-- lottery_booklets
alter policy booklets_select on public.lottery_booklets
  using ((((seller_id = (select auth.uid())) OR has_perm('lottery_admin'::app_module, 'read'::app_action))) OR (has_perm('lottery_admin'::app_module, 'update'::app_action)));
drop policy booklets_write on public.lottery_booklets;
create policy booklets_insert on public.lottery_booklets for insert to authenticated with check (has_perm('lottery_admin'::app_module, 'update'::app_action));
create policy booklets_update on public.lottery_booklets for update to authenticated using (has_perm('lottery_admin'::app_module, 'update'::app_action)) with check (has_perm('lottery_admin'::app_module, 'update'::app_action));
create policy booklets_delete on public.lottery_booklets for delete to authenticated using (has_perm('lottery_admin'::app_module, 'update'::app_action));

-- lottery_campaign_sellers
alter policy campaign_sellers_select on public.lottery_campaign_sellers
  using ((((user_id = (select auth.uid())) OR has_perm('lottery_admin'::app_module, 'read'::app_action))) OR (has_perm('lottery_admin'::app_module, 'update'::app_action)));
drop policy campaign_sellers_write on public.lottery_campaign_sellers;
create policy campaign_sellers_insert on public.lottery_campaign_sellers for insert to authenticated with check (has_perm('lottery_admin'::app_module, 'update'::app_action));
create policy campaign_sellers_update on public.lottery_campaign_sellers for update to authenticated using (has_perm('lottery_admin'::app_module, 'update'::app_action)) with check (has_perm('lottery_admin'::app_module, 'update'::app_action));
create policy campaign_sellers_delete on public.lottery_campaign_sellers for delete to authenticated using (has_perm('lottery_admin'::app_module, 'update'::app_action));

-- match_appearances
alter policy match_appearances_select on public.match_appearances
  using ((has_perm('matches'::app_module, 'read'::app_action)) OR (has_perm('matches'::app_module, 'update'::app_action)));
drop policy match_appearances_write on public.match_appearances;
create policy match_appearances_insert on public.match_appearances for insert to authenticated with check (has_perm('matches'::app_module, 'update'::app_action));
create policy match_appearances_update on public.match_appearances for update to authenticated using (has_perm('matches'::app_module, 'update'::app_action)) with check (has_perm('matches'::app_module, 'update'::app_action));
create policy match_appearances_delete on public.match_appearances for delete to authenticated using (has_perm('matches'::app_module, 'update'::app_action));

-- match_goals
alter policy match_goals_select on public.match_goals
  using ((has_perm('matches'::app_module, 'read'::app_action)) OR (has_perm('matches'::app_module, 'update'::app_action)));
drop policy match_goals_write on public.match_goals;
create policy match_goals_insert on public.match_goals for insert to authenticated with check (has_perm('matches'::app_module, 'update'::app_action));
create policy match_goals_update on public.match_goals for update to authenticated using (has_perm('matches'::app_module, 'update'::app_action)) with check (has_perm('matches'::app_module, 'update'::app_action));
create policy match_goals_delete on public.match_goals for delete to authenticated using (has_perm('matches'::app_module, 'update'::app_action));

-- match_live_events
alter policy match_live_events_select on public.match_live_events
  using ((has_perm('matches'::app_module, 'read'::app_action)) OR (has_perm('matches'::app_module, 'update'::app_action)));
drop policy match_live_events_write on public.match_live_events;
create policy match_live_events_insert on public.match_live_events for insert to authenticated with check (has_perm('matches'::app_module, 'update'::app_action));
create policy match_live_events_update on public.match_live_events for update to authenticated using (has_perm('matches'::app_module, 'update'::app_action)) with check (has_perm('matches'::app_module, 'update'::app_action));
create policy match_live_events_delete on public.match_live_events for delete to authenticated using (has_perm('matches'::app_module, 'update'::app_action));

-- role_permissions
drop policy role_permissions_write on public.role_permissions;
create policy role_permissions_insert on public.role_permissions for insert to authenticated with check (is_superadmin());
create policy role_permissions_update on public.role_permissions for update to authenticated using (is_superadmin()) with check (is_superadmin());
create policy role_permissions_delete on public.role_permissions for delete to authenticated using (is_superadmin());

-- season_goals
alter policy season_goals_select on public.season_goals
  using ((has_perm('matches'::app_module, 'read'::app_action)) OR (has_perm('matches'::app_module, 'update'::app_action)));
drop policy season_goals_write on public.season_goals;
create policy season_goals_insert on public.season_goals for insert to authenticated with check (has_perm('matches'::app_module, 'update'::app_action));
create policy season_goals_update on public.season_goals for update to authenticated using (has_perm('matches'::app_module, 'update'::app_action)) with check (has_perm('matches'::app_module, 'update'::app_action));
create policy season_goals_delete on public.season_goals for delete to authenticated using (has_perm('matches'::app_module, 'update'::app_action));

-- sponsor_installments
alter policy sponsor_installments_select on public.sponsor_installments
  using ((has_perm('sponsors'::app_module, 'read'::app_action)) OR (has_perm('sponsors'::app_module, 'update'::app_action)));
drop policy sponsor_installments_write on public.sponsor_installments;
create policy sponsor_installments_insert on public.sponsor_installments for insert to authenticated with check (has_perm('sponsors'::app_module, 'update'::app_action));
create policy sponsor_installments_update on public.sponsor_installments for update to authenticated using (has_perm('sponsors'::app_module, 'update'::app_action)) with check (has_perm('sponsors'::app_module, 'update'::app_action));
create policy sponsor_installments_delete on public.sponsor_installments for delete to authenticated using (has_perm('sponsors'::app_module, 'update'::app_action));

-- squad_fee_overrides
alter policy squad_fee_overrides_select on public.squad_fee_overrides
  using ((has_perm('finances'::app_module, 'read'::app_action)) OR (has_perm('finances'::app_module, 'update'::app_action)));
drop policy squad_fee_overrides_write on public.squad_fee_overrides;
create policy squad_fee_overrides_insert on public.squad_fee_overrides for insert to authenticated with check (has_perm('finances'::app_module, 'update'::app_action));
create policy squad_fee_overrides_update on public.squad_fee_overrides for update to authenticated using (has_perm('finances'::app_module, 'update'::app_action)) with check (has_perm('finances'::app_module, 'update'::app_action));
create policy squad_fee_overrides_delete on public.squad_fee_overrides for delete to authenticated using (has_perm('finances'::app_module, 'update'::app_action));

-- squad_fee_plans
alter policy squad_fee_plans_select on public.squad_fee_plans
  using ((has_perm('finances'::app_module, 'read'::app_action)) OR (has_perm('finances'::app_module, 'update'::app_action)));
drop policy squad_fee_plans_write on public.squad_fee_plans;
create policy squad_fee_plans_insert on public.squad_fee_plans for insert to authenticated with check (has_perm('finances'::app_module, 'update'::app_action));
create policy squad_fee_plans_update on public.squad_fee_plans for update to authenticated using (has_perm('finances'::app_module, 'update'::app_action)) with check (has_perm('finances'::app_module, 'update'::app_action));
create policy squad_fee_plans_delete on public.squad_fee_plans for delete to authenticated using (has_perm('finances'::app_module, 'update'::app_action));

-- user_permissions
alter policy user_permissions_select on public.user_permissions
  using ((((user_id = (select auth.uid())) OR has_perm('users'::app_module, 'read'::app_action))) OR (has_perm('users'::app_module, 'update'::app_action)));
drop policy user_permissions_write on public.user_permissions;
create policy user_permissions_insert on public.user_permissions for insert to authenticated with check (has_perm('users'::app_module, 'update'::app_action));
create policy user_permissions_update on public.user_permissions for update to authenticated using (has_perm('users'::app_module, 'update'::app_action)) with check (has_perm('users'::app_module, 'update'::app_action));
create policy user_permissions_delete on public.user_permissions for delete to authenticated using (has_perm('users'::app_module, 'update'::app_action));

