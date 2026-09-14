create index if not exists model_engine_readiness_snapshots_field_id_idx
  on public.model_engine_readiness_snapshots(field_id);

drop policy if exists "read own model readiness snapshots" on public.model_engine_readiness_snapshots;
create policy "read own model readiness snapshots"
  on public.model_engine_readiness_snapshots
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
