import { NextResponse, type NextRequest } from "next/server";
import { requireAdminOrResponse } from "@/lib/auth/api-guards";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { AUTO_SYNC_FREQUENCIES, saveAutoSyncSettings } from "@/lib/sync/auto-sync";

/** Admin only: switch auto sync on/off and choose how often it runs. */
export async function POST(request: NextRequest) {
  const admin = await requireAdminOrResponse();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null);
  const enabled = body?.enabled;
  const everyHours = Number(body?.everyHours);
  if (typeof enabled !== "boolean" || !(AUTO_SYNC_FREQUENCIES as readonly number[]).includes(everyHours)) {
    return NextResponse.json(
      { error: `enabled (boolean) and everyHours (${AUTO_SYNC_FREQUENCIES.join(", ")}) are required` },
      { status: 400 }
    );
  }

  const profile = await getCurrentProfile();
  try {
    await saveAutoSyncSettings(enabled, everyHours, profile?.email ?? "admin");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
