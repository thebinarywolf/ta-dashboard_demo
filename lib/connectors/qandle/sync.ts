import { randomUUID } from "node:crypto";
import { WRITE_BACKEND } from "@/lib/data-source/config";
import type { SyncResult } from "../types";
import { fetchAllQandleUsers, getQandleConfig } from "./client";
import { mapQandleEmployee } from "./normalize";

const SOURCE_NAME = "qandle-hrms:employees";
const BATCH_SIZE = 500;

/**
 * Pulls employees from Qandle into the `employees` table (Supabase or the
 * local SQLite file, whichever WRITE_BACKEND says). Does nothing — returns
 * no results — when Qandle credentials aren't configured, so the Google
 * Sheets sync keeps working on its own. Never throws: a Qandle failure comes
 * back as an error result so it can't hide the sheet sync's own results.
 */
export async function syncQandle(): Promise<SyncResult[]> {
  const config = getQandleConfig();
  if (!config) return [];

  const startedAt = new Date().toISOString();
  const runId = randomUUID();

  try {
    const users = await fetchAllQandleUsers(config);
    const rows = users.map(mapQandleEmployee);

    let count: number;
    if (WRITE_BACKEND === "sqlite") {
      // Dynamic import keeps node:sqlite out of the Supabase deployment path.
      const local = await import("@/lib/local-db/employees");
      count = local.replaceEmployeesLocal(rows);
      local.logQandleRunLocal({ runId, startedAt, rows: count, error: null });
    } else {
      count = await replaceEmployeesSupabase(rows, startedAt);
    }
    return [{ sourceName: SOURCE_NAME, rowsSynced: count, status: "success" }];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (WRITE_BACKEND === "sqlite") {
      try {
        const local = await import("@/lib/local-db/employees");
        local.logQandleRunLocal({ runId, startedAt, rows: 0, error: message });
      } catch {
        // logging the failure must not mask the failure itself
      }
    }
    return [{ sourceName: SOURCE_NAME, rowsSynced: 0, status: "error", error: message }];
  }
}

async function replaceEmployeesSupabase(
  rows: ReturnType<typeof mapQandleEmployee>[],
  startedAt: string
): Promise<number> {
  const { createServiceRoleClient } = await import("@/lib/supabase/service");
  const supabase = createServiceRoleClient();

  const { data: run } = await supabase
    .from("sync_runs")
    .insert({ source_name: "qandle-hrms", status: "running", started_at: startedAt })
    .select()
    .single();

  const finish = async (status: "success" | "error", rowsSynced: number, error: string | null) => {
    if (!run) return;
    await supabase
      .from("sync_runs")
      .update({ finished_at: new Date().toISOString(), status, rows_synced: rowsSynced, error })
      .eq("id", run.id);
  };

  try {
    const { error: deleteError } = await supabase.from("employees").delete().not("id", "is", null);
    if (deleteError) throw new Error(`Failed clearing employees: ${deleteError.message}`);

    let inserted = 0;
    // Until migration 0008 adds employees.full_name, retry without the name so
    // the sync keeps working (names just won't show yet).
    let includeName = true;
    const withoutName = (batch: typeof rows) => batch.map(({ full_name: _name, ...rest }) => rest);
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      let { error } = await supabase.from("employees").insert(includeName ? batch : withoutName(batch));
      if (error && includeName && /full_name/.test(error.message)) {
        includeName = false;
        ({ error } = await supabase.from("employees").insert(withoutName(batch)));
      }
      if (error) throw new Error(`Failed inserting into employees: ${error.message}`);
      inserted += batch.length;
    }
    await finish("success", inserted, null);
    return inserted;
  } catch (err) {
    await finish("error", 0, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
