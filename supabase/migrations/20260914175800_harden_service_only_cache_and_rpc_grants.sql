-- Make the existing service-only cache posture explicit. RLS already blocked
-- client access because there were no policies; this deny policy preserves that behavior.
drop policy if exists "Client access denied" on public.weather_cache;
create policy "Client access denied"
on public.weather_cache
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

-- SECURITY DEFINER RPCs below are intentionally callable only by signed-in users
-- and service_role. Make the absence of PUBLIC/anon execution explicit.
revoke execute on function public.consume_ai_access() from public, anon;
grant execute on function public.consume_ai_access() to authenticated, service_role;

revoke execute on function public.get_ai_access_status() from public, anon;
grant execute on function public.get_ai_access_status() to authenticated, service_role;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

revoke execute on function public.refund_ai_access(bigint) from public, anon;
grant execute on function public.refund_ai_access(bigint) to authenticated, service_role;

revoke execute on function public.tp_award_points(text, text, jsonb) from public, anon;
grant execute on function public.tp_award_points(text, text, jsonb) to authenticated, service_role;

revoke execute on function public.tp_complete_field_task(uuid) from public, anon;
grant execute on function public.tp_complete_field_task(uuid) to authenticated, service_role;

revoke execute on function public.tp_create_field_operation(uuid, text, date, text, numeric, text, numeric, text, text, jsonb, timestamptz, uuid) from public, anon;
grant execute on function public.tp_create_field_operation(uuid, text, date, text, numeric, text, numeric, text, text, jsonb, timestamptz, uuid) to authenticated, service_role;

revoke execute on function public.tp_delete_field_operation(uuid) from public, anon;
grant execute on function public.tp_delete_field_operation(uuid) to authenticated, service_role;

revoke execute on function public.tp_get_gamification_state() from public, anon;
grant execute on function public.tp_get_gamification_state() to authenticated, service_role;

revoke execute on function public.tp_sync_field_tasks(uuid) from public, anon;
grant execute on function public.tp_sync_field_tasks(uuid) to authenticated, service_role;

revoke execute on function public.tp_sync_model_readiness_tasks(uuid) from public, anon;
grant execute on function public.tp_sync_model_readiness_tasks(uuid) to authenticated, service_role;
