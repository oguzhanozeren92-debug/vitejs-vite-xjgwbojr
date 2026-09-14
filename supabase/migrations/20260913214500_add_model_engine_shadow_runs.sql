create table if not exists public.model_engine_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  engine text not null check (engine in ('pyfao56','pcse','aquacrop')),
  mode text not null check (mode in ('shadow','pilot','readiness')),
  status text not null check (status in ('queued','running','completed','blocked','failed')),
  input_fingerprint text not null,
  input_summary jsonb not null default '{}'::jsonb,
  source_versions jsonb not null default '{}'::jsonb,
  missing_inputs text[] not null default '{}'::text[],
  engine_version text,
  adapter_version integer not null default 1,
  output jsonb,
  comparison jsonb,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, field_id, engine, mode, input_fingerprint)
);

create index if not exists model_engine_runs_user_field_idx
  on public.model_engine_runs (user_id, field_id, created_at desc);
create index if not exists model_engine_runs_engine_status_idx
  on public.model_engine_runs (engine, status, created_at desc);

alter table public.model_engine_runs enable row level security;

revoke all on public.model_engine_runs from anon;
revoke insert, update, delete on public.model_engine_runs from authenticated;
grant select on public.model_engine_runs to authenticated;
grant all on public.model_engine_runs to service_role;

drop policy if exists model_engine_runs_select_own on public.model_engine_runs;
create policy model_engine_runs_select_own
  on public.model_engine_runs
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.touch_model_engine_runs_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_model_engine_runs_updated_at on public.model_engine_runs;
create trigger trg_model_engine_runs_updated_at
before update on public.model_engine_runs
for each row execute function public.touch_model_engine_runs_updated_at();
