-- New role "Pro Viewer": sees the same tabs as a viewer (admin-configurable in
-- the Admin panel's tab matrix) and can also mark hot positions on the
-- Positions tab.
--
-- Run this whole file once in the Supabase SQL Editor.

-- 1. Allow the new role on user accounts.
alter type public.user_role add value if not exists 'pro_viewer';

-- 2. Let the tab matrix hold rows for it.
alter table public.role_tab_permissions drop constraint if exists role_tab_permissions_role_check;
alter table public.role_tab_permissions
  add constraint role_tab_permissions_role_check
  check (role in ('viewer', 'pro_viewer', 'recruiter'));

-- 3. Start Pro Viewers with exactly the tabs viewers have today.
insert into public.role_tab_permissions (role, tab_key)
select 'pro_viewer', tab_key
from public.role_tab_permissions
where role = 'viewer'
on conflict do nothing;
