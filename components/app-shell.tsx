import { resolveDataBackend } from "@/lib/data-source/resolve";
import { getVisibleTabKeys } from "@/lib/access/permissions";
import { DASHBOARD_TABS } from "@/lib/access/tabs";
import SignOutButton from "@/components/sign-out-button";
import SideMenu from "@/components/side-menu";
import NavigationProgress from "@/components/navigation-progress";
import WipBadge from "@/components/wip-badge";
import ProfileMenu from "@/components/profile-menu";
import type { Profile } from "@/lib/supabase/types";
import { SHOWCASE } from "@/lib/showcase/flag";

export default async function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const backend = resolveDataBackend();
  const visibleTabKeys =
    profile.role === "admin" ? null : await getVisibleTabKeys(profile.role);
  const navItems = DASHBOARD_TABS.filter(
    (tab) => visibleTabKeys === null || visibleTabKeys.includes(tab.key)
  );
  const allNavItems =
    profile.role === "admin"
      ? [...navItems, { href: "/admin", label: "Admin" }, { href: "/admin/data-source", label: "Data source" }]
      : navItems;

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-[#dbe8fb] via-[#eef4fd] to-white">
      <SideMenu
        items={allNavItems}
        footer={
          <>
            <ProfileMenu fullName={profile.full_name} email={profile.email} role={profile.role} placement="sidebar" />
            <div className="min-w-0 text-xs leading-tight">
              <p className="truncate font-bold text-[#0e1b3d]">{profile.full_name || profile.email}</p>
              <SignOutButton />
            </div>
          </>
        }
      />
      <div className="min-w-0 flex-1 overflow-x-hidden">
      {!SHOWCASE && backend === "fixtures" && (
        <div className="mx-auto mt-4 max-w-6xl px-3 sm:px-6">
          <div className="rounded-full bg-amber-50/80 backdrop-blur px-5 py-2 text-center text-xs font-medium text-amber-700 border border-amber-100">
            Demo mode — showing sample data. Sync your Google Sheet from the
            Admin panel to see real data.
          </div>
        </div>
      )}
      {!SHOWCASE && backend === "sqlite" && (
        <div className="mx-auto mt-4 max-w-6xl px-3 sm:px-6">
          <div className="rounded-full bg-white/50 backdrop-blur px-5 py-2 text-center text-xs font-medium text-brand-blue-dark border border-white/70">
            Showing data synced from your Google Sheet into a local database.
            Connect Supabase (see README.md) for shared, production hosting.
          </div>
        </div>
      )}

      <NavigationProgress />
      <WipBadge />
      <main className="mx-auto max-w-6xl px-3 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
