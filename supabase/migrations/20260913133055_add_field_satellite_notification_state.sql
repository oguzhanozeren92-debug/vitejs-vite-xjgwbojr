create table if not exists public.field_satellite_notification_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  last_scene_date date,
  last_scene_id text,
  last_notified_scene_date date,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, field_id)
);

alter table public.field_satellite_notification_state enable row level security;

drop policy if exists "Users can view own satellite notification state"
  on public.field_satellite_notification_state;
create policy "Users can view own satellite notification state"
  on public.field_satellite_notification_state
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.field_satellite_notification_state from anon, authenticated;
grant select on public.field_satellite_notification_state to authenticated;
