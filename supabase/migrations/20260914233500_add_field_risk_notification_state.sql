create table if not exists public.field_risk_notification_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  last_threat text,
  last_score numeric(6,2),
  last_level text check (last_level is null or last_level in ('low', 'moderate', 'high', 'critical')),
  last_peak_score numeric(6,2),
  last_peak_date date,
  last_checked_at timestamptz,
  last_notified_at timestamptz,
  last_notified_threat text,
  last_notified_score numeric(6,2),
  last_notified_level text check (last_notified_level is null or last_notified_level in ('low', 'moderate', 'high', 'critical')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, field_id)
);

create index if not exists field_risk_notification_state_checked_idx
  on public.field_risk_notification_state(last_checked_at);

create index if not exists field_risk_notification_state_notified_idx
  on public.field_risk_notification_state(last_notified_at);

alter table public.field_risk_notification_state enable row level security;

drop policy if exists "Users can view own risk notification state"
  on public.field_risk_notification_state;
create policy "Users can view own risk notification state"
  on public.field_risk_notification_state
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.field_risk_notification_state
  from anon, authenticated;
grant select on public.field_risk_notification_state to authenticated;
