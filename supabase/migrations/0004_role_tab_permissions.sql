-- Per-role dashboard tab visibility, admin-configurable from /admin. Admins
-- always see every tab regardless of this table — it only governs viewer
-- and recruiter. Seeded with every tab visible for both roles so nothing
-- changes until an admin edits it.

create table public.role_tab_permissions (
  role text not null check (role in ('viewer', 'recruiter')),
  tab_key text not null,
  primary key (role, tab_key)
);

insert into public.role_tab_permissions (role, tab_key)
select role, tab_key
from unnest(array['viewer', 'recruiter']) as role
cross join unnest(array['positions', 'funnel', 'recruiters', 'dropouts', 'sources']) as tab_key;

alter table public.role_tab_permissions enable row level security;

-- Just config, not sensitive — any approved user can read it (they need to
-- know their own visible tabs), only admins write it via the service-role
-- client in app/api/admin/tab-permissions.
create policy "role_tab_permissions: approved users read"
  on public.role_tab_permissions for select
  using (public.is_approved());

grant select on public.role_tab_permissions to authenticated;
