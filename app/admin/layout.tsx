import { requireAdminProfile } from "@/lib/auth/guards";
import AppShell from "@/components/app-shell";

// Same reasoning as app/dashboard/layout.tsx — pending approvals and last
// sync status must never be served from a stale cached fetch.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAdminProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}
