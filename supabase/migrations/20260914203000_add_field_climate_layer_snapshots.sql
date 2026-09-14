create table if not exists public.field_climate_layer_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  layer_key text not null check (layer_key in ('lst','et0','rain','frost')),
  source_key text not null,
  data_date date not null,
  value numeric,
  unit text not null,
  quality text not null default 'observed' check (quality in ('observed','reanalysis','derived','unavailable')),
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, field_id, layer_key, source_key, data_date)
);

create index if not exists field_climate_layer_snapshots_field_date_idx
  on public.field_climate_layer_snapshots(field_id, layer_key, data_date desc);

create index if not exists field_climate_layer_snapshots_user_field_idx
  on public.field_climate_layer_snapshots(user_id, field_id, data_date desc);

alter table public.field_climate_layer_snapshots enable row level security;

revoke all on public.field_climate_layer_snapshots from anon;
revoke insert, update, delete on public.field_climate_layer_snapshots from authenticated;
grant select on public.field_climate_layer_snapshots to authenticated;
grant all on public.field_climate_layer_snapshots to service_role;

drop policy if exists field_climate_layer_snapshots_select_own on public.field_climate_layer_snapshots;
create policy field_climate_layer_snapshots_select_own
  on public.field_climate_layer_snapshots
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.touch_field_climate_layer_snapshots_updated_at()
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

drop trigger if exists trg_field_climate_layer_snapshots_updated_at on public.field_climate_layer_snapshots;
create trigger trg_field_climate_layer_snapshots_updated_at
before update on public.field_climate_layer_snapshots
for each row execute function public.touch_field_climate_layer_snapshots_updated_at();
