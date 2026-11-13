import { redirect } from "next/navigation";
import { getCurrentProfile } from "./current-user";
import { getVisibleTabKeys } from "@/lib/access/permissions";
import type { Profile } from "@/lib/supabase/types";

/**
 * Server Component guard: redirects to /login or /pending as needed,
 * otherwise returns the caller's own profile row. Middleware already does
 * similar routing on every request, but pages call this too so a page is
 * never one bug away from rendering without the check (and, in demo mode,
 * this is the ONLY place doing status/role checks — see middleware.ts).
 */
export async function requireApprovedProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "approved") redirect("/pending");
  return profile;
}

export async function requireAdminProfile(): Promise<Profile> {
  const profile = await requireApprovedProfile();
  if (profile.role !== "admin") redirect("/dashboard");
  return profile;
}

/**
 * Per-tab access check for the 5 configurable dashboard pages. Doesn't
 * redirect on denial (unlike the guards above) — an admin could hide every
 * tab for a role, and redirecting to another gated page would loop. Callers
 * render an inline "no access" message instead; see components/access-restricted.tsx.
 */
export async function requireTabAccess(
  tabKey: string
): Promise<{ allowed: boolean; profile: Profile }> {
  const profile = await requireApprovedProfile();
  if (profile.role === "admin") return { allowed: true, profile };
  const visible = await getVisibleTabKeys(profile.role);
  return { allowed: visible.includes(tabKey), profile };
}
