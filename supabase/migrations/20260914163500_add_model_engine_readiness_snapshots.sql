create table if not exists public.model_engine_readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  engine text not null check (engine in ('pcse','aquacrop')),
  rollout text not null default 'pilot' check (rollout in ('off','shadow','pilot','production')),
  ready boolean not null default false,
  available_inputs text[] not null default '{}',
  missing_inputs text[] not null default '{}',
  evidence jsonb not null default '{}'::jsonb,
  context jsonb not null default '{}'::jsonb,
  input_authority text not null default 'server-derived' check (input_authority = 'server-derived'),
  checked_at timestamptz not null default now(),
  unique (user_id, field_id, engine)
);

create index if not exists model_engine_readiness_snapshots_user_field_idx
  on public.model_engine_readiness_snapshots(user_id, field_id, checked_at desc);

alter table public.model_engine_readiness_snapshots enable row level security;

drop policy if exists "read own model readiness snapshots" on public.model_engine_readiness_snapshots;
create policy "read own model readiness snapshots"
  on public.model_engine_readiness_snapshots
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.model_engine_readiness_snapshots from anon, authenticated;
grant select on public.model_engine_readiness_snapshots to authenticated;
