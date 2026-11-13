-- Full name of each employee, taken from Qandle (first + middle + last name),
-- so the Attrition tab can show WHO left even when the person is not yet in the
-- HR exits sheet. public.employees is already restricted to people allowed to
-- see the Attrition tab (see can_view_attrition() in 0006), so names carry the
-- same protection as dates of birth and exit dates.
-- Contact details, addresses and PAN numbers are still NOT stored.

alter table public.employees add column if not exists full_name text;
