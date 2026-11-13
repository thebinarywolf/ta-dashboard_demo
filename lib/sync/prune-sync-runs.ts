import { WRITE_BACKEND } from "@/lib/data-source/config";
import { getLocalDb } from "@/lib/local-db/client";
import { createServiceRoleClient } from "@/lib/supabase/service";

/** How long the sync log keeps entries. */
export const SYNC_LOG_KEEP_DAYS = 90;

/**
 * Deletes sync log entries (sync_runs) older than 90 days, so the log doesn't
 * grow forever with every automatic sync. The most recent finished entry is
 * always kept, even if it is older, so "Last sync" still has something to show
 * if syncing stopped for a long time. Returns how many entries were removed.
 */
export async function pruneSyncRuns(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SYNC_LOG_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();

  if (WRITE_BACKEND === "sqlite") {
    const db = getLocalDb();
    const latest = db
      .prepare(
        "SELECT id FROM sync_runs WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1"
      )
      .get() as { id: string } | undefined;
    const info = db
      .prepare("DELETE FROM sync_runs WHERE started_at < ? AND id IS NOT ?")
      .run(cutoff, latest?.id ?? null);
    return Number(info.changes);
  }

  const supabase = createServiceRoleClient();
  const { data: latest } = await supabase
    .from("sync_runs")
    .select("id")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let query = supabase.from("sync_runs").delete({ count: "exact" }).lt("started_at", cutoff);
  if (latest?.id) query = query.neq("id", latest.id);
  const { error, count } = await query;
  if (error) throw new Error(`Failed cleaning the sync log: ${error.message}`);
  return count ?? 0;
}
