-- Automatic sync, controlled from the Admin panel ("Auto sync": on/off and
-- how often).
--
-- How it works:
--   * Supabase's built-in timer (pg_cron) wakes up once an hour and calls the
--     dashboard's /api/cron/sync address (pg_net sends the request).
--   * That address reads the settings below and only runs a sync when auto
--     sync is on AND the last sync is older than the chosen frequency. So
--     changing the frequency in the Admin panel never needs this timer edited.
--   * The timer proves who it is with a random token created right here in
--     the database. It never leaves the database, so there is no key to copy.
--
-- Run this whole file once in the Supabase SQL Editor.
-- If the site's address ever changes from your-app.vercel.app, edit the url
-- below and run the cron.schedule part again.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- One row (id = 1) holding the setting and what the last automatic run did.
create table if not exists public.auto_sync (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  every_hours int not null default 6 check (every_hours in (1, 2, 3, 6, 12, 24)),
  token uuid not null default gen_random_uuid(),
  updated_by text,
  updated_at timestamptz not null default now(),
  last_auto_run_at timestamptz,
  last_auto_status text,
  last_auto_message text
);

insert into public.auto_sync (id) values (1) on conflict (id) do nothing;

-- No read/write policies: only the server (service role) and the timer touch
-- this table, never a signed-in user directly.
alter table public.auto_sync enable row level security;

-- Every hour at :05. (Scheduling again under the same name just updates it.)
select cron.schedule(
  'ta-dashboard-auto-sync',
  '5 * * * *',
  $job$
    select net.http_post(
      url := 'https://your-app.vercel.app/api/cron/sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select token::text from public.auto_sync where id = 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 280000
    );
  $job$
);
