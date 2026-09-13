do $$
declare
  v_job_id bigint;
  v_command text;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'tarlapusula-push-dispatch'
  limit 1;

  if v_job_id is null then
    raise notice 'tarlapusula-push-dispatch cron job not found; scheduler migration will create it.';
    return;
  end if;

  v_command := $cmd$
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

  perform cron.alter_job(
    job_id := v_job_id,
    schedule := '*/15 * * * *',
    command := v_command,
    active := true
  );
end;
$$;
