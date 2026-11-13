import { timingSafeEqual } from "node:crypto";
import { WRITE_BACKEND } from "@/lib/data-source/config";
import { createServiceRoleClient } from "@/lib/supabase/service";

// Automatic sync. Supabase's hourly timer calls /api/cron/sync; this file
// decides whether that call should actually run a sync (see
// supabase/migrations/0011_auto_sync.sql for the timer itself).

/** The choices offered in the Admin panel, in hours. */
export const AUTO_SYNC_FREQUENCIES = [1, 2, 3, 6, 12, 24] as const;

/** The timer fires at :05 every hour, so allow a little slack: a sync that
 *  finished 5h52m ago counts as due for "every 6 hours". */
const DUE_SLACK_MS = 10 * 60 * 1000;

export interface AutoSyncSettings {
  /** False when auto sync cannot run here: the local/demo setup, or the
   *  database step (0011_auto_sync.sql) has not been run yet. */
  available: boolean;
  reason?: "local" | "not-set-up";
  enabled: boolean;
  everyHours: number;
  updatedBy: string | null;
  updatedAt: string | null;
  lastAutoRunAt: string | null;
  lastAutoStatus: string | null;
  lastAutoMessage: string | null;
  /** When the most recent sync of any kind (manual or automatic) finished. */
  lastSyncFinishedAt: string | null;
}

const UNAVAILABLE = (reason: "local" | "not-set-up"): AutoSyncSettings => ({
  available: false,
  reason,
  enabled: false,
  everyHours: 6,
  updatedBy: null,
  updatedAt: null,
  lastAutoRunAt: null,
  lastAutoStatus: null,
  lastAutoMessage: null,
  lastSyncFinishedAt: null,
});

async function lastSyncFinishedAt(): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("sync_runs")
    .select("finished_at")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.finished_at ?? null;
}

export async function getAutoSyncSettings(): Promise<AutoSyncSettings> {
  if (WRITE_BACKEND !== "supabase") return UNAVAILABLE("local");
  try {
    const supabase = createServiceRoleClient();
    const [{ data, error }, lastFinished] = await Promise.all([
      supabase.from("auto_sync").select("*").eq("id", 1).maybeSingle(),
      lastSyncFinishedAt(),
    ]);
    if (error || !data) return UNAVAILABLE("not-set-up");
    return {
      available: true,
      enabled: data.enabled,
      everyHours: data.every_hours,
      updatedBy: data.updated_by,
      updatedAt: data.updated_at,
      lastAutoRunAt: data.last_auto_run_at,
      lastAutoStatus: data.last_auto_status,
      lastAutoMessage: data.last_auto_message,
      lastSyncFinishedAt: lastFinished,
    };
  } catch {
    return UNAVAILABLE("not-set-up");
  }
}

export async function saveAutoSyncSettings(enabled: boolean, everyHours: number, by: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("auto_sync")
    .update({ enabled, every_hours: everyHours, updated_by: by, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) {
    throw new Error(
      /relation|does not exist|schema cache/i.test(error.message)
        ? "Auto sync is not set up in the database yet. Run supabase/migrations/0011_auto_sync.sql in the Supabase SQL Editor."
        : error.message
    );
  }
}

/** Checks the timer's token against the one stored in the database. */
export async function isValidCronToken(token: string | null): Promise<boolean> {
  if (!token) return false;
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("auto_sync").select("token").eq("id", 1).maybeSingle();
  if (!data?.token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(data.token);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Is a sync due, given when the last one finished and the chosen frequency? */
export function isSyncDue(lastFinishedAt: string | null, everyHours: number, now = Date.now()): boolean {
  if (!lastFinishedAt) return true;
  return now - Date.parse(lastFinishedAt) >= everyHours * 3600 * 1000 - DUE_SLACK_MS;
}

/** Roughly when the next automatic sync will happen: the first hourly tick
 *  (at :05) after the last sync plus the frequency. */
export function nextAutoSyncAt(lastFinishedAt: string | null, everyHours: number, now = Date.now()): Date {
  const earliest = lastFinishedAt
    ? Math.max(now, Date.parse(lastFinishedAt) + everyHours * 3600 * 1000 - DUE_SLACK_MS)
    : now;
  const tick = new Date(earliest);
  tick.setUTCMinutes(5, 0, 0);
  if (tick.getTime() < earliest) tick.setUTCHours(tick.getUTCHours() + 1);
  return tick;
}

export async function recordAutoRun(status: "success" | "error" | "skipped", message: string): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase
    .from("auto_sync")
    .update({ last_auto_run_at: new Date().toISOString(), last_auto_status: status, last_auto_message: message })
    .eq("id", 1);
}
