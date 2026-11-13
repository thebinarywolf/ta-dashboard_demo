import { requireApprovedProfile } from "@/lib/auth/guards";
import AppShell from "@/components/app-shell";

// Every dashboard page reads live Supabase data that changes on every sync
// and on every filter combination — without this, Next.js's fetch Data
// Cache can serve a stale snapshot of a previous request for a moment
// before the fresh one replaces it (seen as "briefly wrong, then corrects
// itself" right after applying a filter).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireApprovedProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}
