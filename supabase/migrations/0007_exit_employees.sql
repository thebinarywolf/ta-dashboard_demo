-- Exit interviews / reasons, synced from the "Exit Employees" tab of the HR
-- exits spreadsheet. One row per person who left, keyed by Emp Code (which
-- matches employees.employee_code from Qandle). Used by the Attrition tab to
-- show WHO left and WHY.
--
-- Includes names and the reasons people gave, so it is protected exactly like
-- public.employees: admins always, viewers/recruiters only if an admin has
-- ticked "Attrition" for their role in the Admin panel.

create table public.exit_employees (
  id uuid primary key default gen_random_uuid(),
  emp_code text not null unique,
  emp_name text,
  department text,
  designation text,
  -- "HO" or "Branch"
  location_type text,
  category text,
  branch_name text,
  state text,
  reporting_manager text,
  date_of_joining date,
  resignation_date date,
  exit_date date,
  -- The standard reason (e.g. "Better opportunity") and the free-text detail.
  actual_reason text,
  reason_detail text,
  regrettable text,
  talent text,
  voluntary text,
  synced_at timestamptz not null default now()
);

alter table public.exit_employees enable row level security;

create policy "exit_employees: attrition viewers read"
  on public.exit_employees for select
  using (public.can_view_attrition());

-- Writes happen only through the service-role sync job.
grant select on public.exit_employees to authenticated;
