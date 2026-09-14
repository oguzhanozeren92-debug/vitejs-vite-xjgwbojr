create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  v_job_id bigint;
  v_command text := $cmd$
    select net.http_post(
      url := 'https://xwyfidtktauxivsosmex.supabase.co/functions/v1/risk-radar-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          select secret
          from private.scheduler_secrets
          where name = 'push_dispatch'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 50000
    );
  $cmd$;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'tarlapusula-risk-radar-dispatch'
  limit 1;

  if v_job_id is null then
    perform cron.schedule(
      'tarlapusula-risk-radar-dispatch',
      '17 * * * *',
      v_command
    );
  else
    perform cron.alter_job(
      job_id := v_job_id,
      schedule := '17 * * * *',
      command := v_command,
      active := true
    );
  end if;
end;
$$;
