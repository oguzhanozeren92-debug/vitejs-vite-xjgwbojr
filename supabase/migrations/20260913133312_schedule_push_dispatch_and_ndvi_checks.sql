create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create schema if not exists private;

create table if not exists private.scheduler_secrets (
  name text primary key,
  secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into private.scheduler_secrets(name, secret)
values ('push_dispatch', encode(gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

create or replace function public.verify_push_dispatch_secret(p_secret text)
returns boolean
language sql
security definer
set search_path = private, public
as $$
  select exists (
    select 1
    from private.scheduler_secrets
    where name = 'push_dispatch'
      and secret = coalesce(p_secret, '')
  );
$$;

revoke all on function public.verify_push_dispatch_secret(text) from public, anon, authenticated;
grant execute on function public.verify_push_dispatch_secret(text) to service_role;

do $$
declare
  v_job_id bigint;
  v_command text := $cmd$
    select net.http_post(
      url := 'https://xwyfidtktauxivsosmex.supabase.co/functions/v1/send-due-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select secret
          from private.scheduler_secrets
          where name = 'push_dispatch'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $cmd$;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'tarlapusula-push-dispatch'
  limit 1;

  if v_job_id is null then
    perform cron.schedule(
      'tarlapusula-push-dispatch',
      '*/15 * * * *',
      v_command
    );
  else
    perform cron.alter_job(
      job_id := v_job_id,
      schedule := '*/15 * * * *',
      command := v_command,
      active := true
    );
  end if;
end;
$$;
