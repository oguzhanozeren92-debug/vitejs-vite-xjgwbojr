create index if not exists model_engine_runs_field_id_idx
  on public.model_engine_runs (field_id);

create index if not exists field_irrigation_kc_snapshots_field_id_date_idx
  on public.field_irrigation_kc_snapshots (field_id, snapshot_date desc);

drop policy if exists model_engine_runs_select_own on public.model_engine_runs;
create policy model_engine_runs_select_own
  on public.model_engine_runs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
