import { NextResponse } from "next/server";
import { getCurrentProfile } from "./current-user";

/**
 * Route-handler admin check. Unlike lib/auth/guards.ts (which redirects
 * Server Components), API routes must return a JSON error instead — this
 * re-checks admin status on every call rather than trusting anything the
 * client sends.
 */
export async function requireAdminOrResponse(): Promise<
  { ok: true; adminId: string } | { ok: false; response: NextResponse }
> {
  const profile = await getCurrentProfile();

  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }

  if (profile.role !== "admin" || profile.status !== "approved") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }

  return { ok: true, adminId: profile.id };
}
