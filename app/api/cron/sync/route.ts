import { NextResponse, type NextRequest } from "next/server";
import { runFullSync } from "@/lib/sync/run-full-sync";
import {
  getAutoSyncSettings,
  isSyncDue,
  isValidCronToken,
  recordAutoRun,
} from "@/lib/sync/auto-sync";

export const dynamic = "force-dynamic";

/**
 * Called once an hour by Supabase's timer (see 0011_auto_sync.sql). Runs a
 * full sync only when auto sync is switched on in the Admin panel and the last
 * sync is older than the chosen frequency; otherwise it does nothing.
 */
async function handle(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!(await isValidCronToken(token))) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  const settings = await getAutoSyncSettings();
  if (!settings.enabled) {
    return NextResponse.json({ ran: false, reason: "Auto sync is off" });
  }
  if (!isSyncDue(settings.lastSyncFinishedAt, settings.everyHours)) {
    return NextResponse.json({ ran: false, reason: `Not due yet (every ${settings.everyHours}h)` });
  }

  try {
    const results = await runFullSync();
    const failed = results.filter((r) => r.status === "error");
    const rows = results.reduce((n, r) => n + r.rowsSynced, 0);
    await recordAutoRun(
      failed.length ? "error" : "success",
      failed.length
        ? `${failed.length} of ${results.length} parts failed: ${failed.map((f) => f.sourceName).join(", ")}`
        : `${rows} rows synced`
    );
    return NextResponse.json({ ran: true, results }, { status: failed.length ? 207 : 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    await recordAutoRun("error", message);
    return NextResponse.json({ ran: true, error: message }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
