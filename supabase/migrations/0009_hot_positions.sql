-- "Hot" positions: open roles an admin has marked as urgent (the flame icon on
-- the Positions tab). Kept in its own table, keyed by the sheet's Job ID, so
-- a sync (which replaces the positions table) never wipes the markings.
--
-- Everyone who is approved can see which positions are hot; admins and recruiters change
-- it, through the service-role client in app/api/hot-positions.

create table public.hot_positions (
  position_id text primary key,
  marked_by text,
  marked_at timestamptz not null default now()
);

alter table public.hot_positions enable row level security;

create policy "hot_positions: approved users read"
  on public.hot_positions for select
  using (public.is_approved());

grant select on public.hot_positions to authenticated;
