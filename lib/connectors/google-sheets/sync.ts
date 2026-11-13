import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  getSpreadsheetId,
  type GoogleSheetsSourceConfig,
  type GoogleSheetsTabConfig,
} from "@/config/data-sources";
import type { Connector, SyncResult } from "../types";
import { fetchTabRows } from "./client";
import { fetchTabRowsViaAppsScript } from "./apps-script-client";
import {
  mapCandidateFeedbackRow,
  mapDropOutRow,
  mapPositionRow,
  mapUpcomingJoinerRow,
} from "./normalize";

const BATCH_SIZE = 500;

/**
 * Two ways to read a tab in production, picked by which credentials are
 * configured — GOOGLE_APPS_SCRIPT_URL takes priority since it needs no
 * Google Cloud Console project (see docs/google-apps-script-setup.md);
 * otherwise falls back to the authenticated Sheets API service account.
 */
function fetchTab(
  spreadsheetId: string,
  tabName: string
): Promise<Record<string, string>[]> {
  if (process.env.GOOGLE_APPS_SCRIPT_URL) {
    return fetchTabRowsViaAppsScript(tabName);
  }
  return fetchTabRows(spreadsheetId, tabName);
}

function mapRowsForTable(
  targetTable: GoogleSheetsTabConfig["targetTable"],
  rows: Record<string, string>[]
) {
  switch (targetTable) {
    case "positions":
      return rows.map(mapPositionRow);
    case "candidate_feedback":
      return rows.map(mapCandidateFeedbackRow);
    case "upcoming_joiners":
      return rows.map(mapUpcomingJoinerRow);
    case "drop_outs":
      return rows.map(mapDropOutRow);
  }
}

/**
 * Full replace per target table on every sync: the sheet is the source of
 * truth and rows have no stable natural key we can safely upsert on, so we
 * clear the table and re-insert rather than risk stale/duplicate rows.
 */
async function replaceTable(
  supabase: ReturnType<typeof createServiceRoleClient>,
  targetTable: GoogleSheetsTabConfig["targetTable"],
  rows: Record<string, unknown>[]
): Promise<number> {
  const { error: deleteError } = await supabase
    .from(targetTable)
    .delete()
    .not("id", "is", null);
  if (deleteError) {
    throw new Error(`Failed clearing ${targetTable}: ${deleteError.message}`);
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    if (batch.length === 0) continue;
    const { error: insertError } = await supabase.from(targetTable).insert(batch);
    if (insertError) {
      throw new Error(`Failed inserting into ${targetTable}: ${insertError.message}`);
    }
    inserted += batch.length;
  }
  return inserted;
}

export function createGoogleSheetsConnector(
  source: GoogleSheetsSourceConfig
): Connector {
  return {
    name: source.name,
    async sync(): Promise<SyncResult[]> {
      const supabase = createServiceRoleClient();
      const spreadsheetId = getSpreadsheetId(source);

      const { data: run, error: runError } = await supabase
        .from("sync_runs")
        .insert({ source_name: source.name, status: "running" })
        .select()
        .single();
      if (runError || !run) {
        throw new Error(`Failed to create sync_runs row: ${runError?.message}`);
      }

      const results: SyncResult[] = [];
      let totalRows = 0;
      let failure: string | undefined;

      for (const tab of source.tabs) {
        try {
          const rawRows = await fetchTab(spreadsheetId, tab.tabName);
          const mapped = mapRowsForTable(tab.targetTable, rawRows);
          const count = await replaceTable(supabase, tab.targetTable, mapped);
          totalRows += count;
          results.push({
            sourceName: `${source.name}:${tab.tabName}`,
            rowsSynced: count,
            status: "success",
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          failure = message;
          results.push({
            sourceName: `${source.name}:${tab.tabName}`,
            rowsSynced: 0,
            status: "error",
            error: message,
          });
        }
      }

      await supabase
        .from("sync_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: failure ? "error" : "success",
          rows_synced: totalRows,
          error: failure ?? null,
        })
        .eq("id", run.id);

      return results;
    },
  };
}
