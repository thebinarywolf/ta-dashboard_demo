-- Employees synced from Qandle HRMS, for the Attrition tab. Only the fields
-- attrition needs — no names, contact details, addresses or PAN numbers
-- (the Qandle API returns them; the connector drops them before storing).

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text,
  department text,
  location text,
  designation text,
  date_of_joining date,
  date_of_birth date,
  relieving_date date,
  employee_status text,
  synced_at timestamptz not null default now()
);

alter table public.employees enable row level security;

-- Stricter than the other synced tables: date of birth and exit dates are
-- sensitive HR data, so enforce the Attrition tab's visibility in the
-- database itself, not just in the app. Admins always; viewers/recruiters
-- only if an admin has ticked "Attrition" for their role in the Admin
-- panel's tab matrix (role_tab_permissions) — which is NOT ticked by
-- default, since this migration deliberately seeds no 'attrition' rows.
create or replace function public.can_view_attrition()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_admin() or exists (
    select 1
    from public.profiles p
    join public.role_tab_permissions t on t.role = p.role::text
    where p.id = auth.uid()
      and p.status = 'approved'
      and t.tab_key = 'attrition'
  );
$$;

create policy "employees: attrition viewers read"
  on public.employees for select
  using (public.can_view_attrition());

-- Writes happen only through the service-role sync job.
grant select on public.employees to authenticated;
