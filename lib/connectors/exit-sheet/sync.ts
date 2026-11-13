import { randomUUID } from "node:crypto";
import { WRITE_BACKEND } from "@/lib/data-source/config";
import { exitSheetSource, getExitSheetId } from "@/config/data-sources";
import { fetchTabGridViaCsv } from "@/lib/connectors/google-sheets/csv-client";
import {
  exitAppsScriptConfigured,
  fetchExitGridViaAppsScript,
} from "@/lib/connectors/google-sheets/apps-script-client";
import type { SyncResult } from "../types";
import { mapExitGrid, type ExitRowDraft } from "./normalize";

const SOURCE_NAME = `${exitSheetSource.name}:${exitSheetSource.tabName}`;
const BATCH_SIZE = 200;

/**
 * Pulls the "Exit Employees" tab (who left, and the reasons they gave) into
 * the `exit_employees` table, replacing what was there. Never throws: a
 * failure comes back as an error result so it can't hide the other syncs.
 */
export async function syncExitSheet(): Promise<SyncResult[]> {
  const startedAt = new Date().toISOString();
  try {
    // Prefer the exit sheet's own Apps Script (the sheet stays private); fall back
    // to its public share link while that is not set up yet.
    const grid = exitAppsScriptConfigured()
      ? await fetchExitGridViaAppsScript(exitSheetSource.tabName)
      : await fetchTabGridViaCsv(getExitSheetId(), exitSheetSource.tabName);
    const rows = mapExitGrid(grid);

    let count: number;
    if (WRITE_BACKEND === "sqlite") {
      const local = await import("@/lib/local-db/exit-employees");
      count = local.replaceExitEmployeesLocal(rows);
    } else {
      count = await replaceExitEmployeesSupabase(rows, startedAt);
    }
    return [{ sourceName: SOURCE_NAME, rowsSynced: count, status: "success" }];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return [{ sourceName: SOURCE_NAME, rowsSynced: 0, status: "error", error: message }];
  }
}

async function replaceExitEmployeesSupabase(rows: ExitRowDraft[], startedAt: string): Promise<number> {
  const { createServiceRoleClient } = await import("@/lib/supabase/service");
  const supabase = createServiceRoleClient();

  const { data: run } = await supabase
    .from("sync_runs")
    .insert({ id: randomUUID(), source_name: SOURCE_NAME, status: "running", started_at: startedAt })
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
    const { error: deleteError } = await supabase.from("exit_employees").delete().not("id", "is", null);
    if (deleteError) throw new Error(`Failed clearing exit_employees: ${deleteError.message}`);

    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("exit_employees").insert(batch);
      if (error) throw new Error(`Failed inserting into exit_employees: ${error.message}`);
      inserted += batch.length;
    }
    await finish("success", inserted, null);
    return inserted;
  } catch (err) {
    await finish("error", 0, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
