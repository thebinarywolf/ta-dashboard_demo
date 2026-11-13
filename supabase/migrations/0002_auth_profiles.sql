-- Auth/role layer. Every Google-OAuth signup gets an auto-created 'pending'
-- profile; an admin must approve it (status -> 'approved') before the user
-- can read any dashboard data, and assign a role while doing so.

create type public.user_role as enum ('pending', 'viewer', 'recruiter', 'admin');
create type public.user_status as enum ('pending', 'approved', 'revoked');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'pending',
  status public.user_status not null default 'pending',
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles (id)
);

-- Auto-create a pending profile on first Google sign-in.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- security definer helpers used by RLS policies below (and by app code).
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$;

create or replace function public.is_approved()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'approved'
  );
$$;

alter table public.profiles enable row level security;

create policy "profiles: read own row"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles: admins read all"
  on public.profiles for select
  using (public.is_admin());

-- Regular users never write profiles directly (no insert/update policy for
-- them); approve/revoke/role changes go through the service-role client in
-- app/api/admin/users, which re-checks is_admin() server-side first.

alter table public.positions enable row level security;
alter table public.candidate_feedback enable row level security;
alter table public.upcoming_joiners enable row level security;
alter table public.drop_outs enable row level security;
alter table public.sync_runs enable row level security;

create policy "positions: approved users read" on public.positions for select using (public.is_approved());
create policy "candidate_feedback: approved users read" on public.candidate_feedback for select using (public.is_approved());
create policy "upcoming_joiners: approved users read" on public.upcoming_joiners for select using (public.is_approved());
create policy "drop_outs: approved users read" on public.drop_outs for select using (public.is_approved());
create policy "sync_runs: approved users read" on public.sync_runs for select using (public.is_approved());

-- Writes to positions/candidate_feedback/upcoming_joiners/drop_outs/sync_runs
-- happen only via the service-role client (sync job) — no policies grant
-- regular users insert/update/delete, so RLS denies those by default.

grant select on public.profiles to authenticated;
grant select on public.positions, public.candidate_feedback, public.upcoming_joiners, public.drop_outs, public.sync_runs to authenticated;
