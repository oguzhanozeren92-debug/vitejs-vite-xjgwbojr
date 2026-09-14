alter policy inventory_delete_own on public.farm_inventory_products using ((select auth.uid()) = user_id);
alter policy inventory_insert_own on public.farm_inventory_products with check ((select auth.uid()) = user_id);
alter policy inventory_select_own on public.farm_inventory_products using ((select auth.uid()) = user_id);
alter policy inventory_update_own on public.farm_inventory_products using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy "field snapshots insert own" on public.field_data_snapshots with check ((select auth.uid()) = user_id);
alter policy "field snapshots select own" on public.field_data_snapshots using ((select auth.uid()) = user_id);

alter policy pusula_daily_brief_select_own on public.pusula_daily_brief using ((select auth.uid()) = user_id);

alter policy users_insert_own_pusula_feedback on public.pusula_feedback with check ((select auth.uid()) = user_id);
alter policy users_read_own_pusula_feedback on public.pusula_feedback using ((select auth.uid()) = user_id);
alter policy users_update_own_pusula_feedback on public.pusula_feedback using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy pusula_context_delete_own on public.pusula_field_context_snapshots using ((select auth.uid()) = user_id);
alter policy pusula_context_insert_own on public.pusula_field_context_snapshots with check ((select auth.uid()) = user_id);
alter policy pusula_context_select_own on public.pusula_field_context_snapshots using ((select auth.uid()) = user_id);
alter policy pusula_context_update_own on public.pusula_field_context_snapshots using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter policy users_insert_own_pusula_insights on public.pusula_insights with check ((select auth.uid()) = user_id);
alter policy users_read_own_pusula_insights on public.pusula_insights using ((select auth.uid()) = user_id);
