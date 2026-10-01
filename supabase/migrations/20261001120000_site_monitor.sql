-- Scheduled site monitor: once a day the database calls the app's /api/site-monitor route for
-- every FOCUS account (using the account's personal key). The route checks the sites that are
-- due (weekly by default, hourly while a site is down) and stores the results; the app shows
-- the alert next time it is opened. Idempotent, and never fails the migration.

do $$
begin
  create extension if not exists pg_net;
  create extension if not exists pg_cron;
exception when others then
  raise notice 'site_monitor: could not enable pg_net/pg_cron (%)', sqlerrm;
end $$;

create or replace function public.focus_run_site_monitor()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  base text := 'https://empty-canvas-studio-92.lovable.app/api/site-monitor';
begin
  for r in select webhook_token from public.focus_state loop
    perform net.http_post(
      url := base || '?key=' || r.webhook_token,
      body := '{}'::jsonb,
      headers := '{"content-type":"application/json"}'::jsonb,
      timeout_milliseconds := 55000
    );
  end loop;
end $$;

revoke all on function public.focus_run_site_monitor() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('focus-site-monitor')
    where exists (select 1 from cron.job where jobname = 'focus-site-monitor');
  perform cron.schedule('focus-site-monitor', '0 4 * * *', 'select public.focus_run_site_monitor()');
exception when others then
  raise notice 'site_monitor: could not schedule the job (%)', sqlerrm;
end $$;
