import { randomUUID } from "node:crypto";
import { getLocalDb } from "./client";
import { getSpreadsheetId, type GoogleSheetsTabConfig } from "@/config/data-sources";
import { fetchTabRowsViaCsv } from "@/lib/connectors/google-sheets/csv-client";
import {
  mapCandidateFeedbackRow,
  mapDropOutRow,
  mapPositionRow,
  mapUpcomingJoinerRow,
} from "@/lib/connectors/google-sheets/normalize";
import type { GoogleSheetsSourceConfig } from "@/config/data-sources";
import type { SyncResult } from "@/lib/connectors/types";

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

function boolToInt(v: boolean | null): number | null {
  return v === null ? null : v ? 1 : 0;
}

/**
 * Full replace per target table on every sync, same rationale as the
 * Supabase connector (lib/connectors/google-sheets/sync.ts): the sheet is
 * the source of truth and rows have no stable natural key to upsert on.
 */
function replaceTable(
  targetTable: GoogleSheetsTabConfig["targetTable"],
  rows: Record<string, unknown>[]
): number {
  const db = getLocalDb();
  const syncedAt = new Date().toISOString();

  db.exec(`DELETE FROM ${targetTable}`);
  if (rows.length === 0) return 0;

  const columns = Object.keys(rows[0]);
  const placeholders = columns.map(() => "?").join(", ");
  const insert = db.prepare(
    `INSERT INTO ${targetTable} (id, ${columns.join(", ")}, synced_at) VALUES (?, ${placeholders}, ?)`
  );

  for (const row of rows) {
    const values = columns.map((c) => {
      const v = (row as Record<string, unknown>)[c];
      // SQLite bindings reject JS booleans outright — store as 0/1.
      if (typeof v === "boolean") return boolToInt(v);
      return v ?? null;
    });
    insert.run(randomUUID(), ...(values as (string | number | null)[]), syncedAt);
  }

  return rows.length;
}

export async function syncGoogleSheetsToLocalDb(
  source: GoogleSheetsSourceConfig
): Promise<SyncResult[]> {
  const db = getLocalDb();
  const spreadsheetId = getSpreadsheetId(source);
  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  db.prepare(
    "INSERT INTO sync_runs (id, source_name, started_at, status) VALUES (?, ?, ?, 'running')"
  ).run(runId, source.name, startedAt);

  const results: SyncResult[] = [];
  let totalRows = 0;
  let failure: string | undefined;

  for (const tab of source.tabs) {
    try {
      const rawRows = await fetchTabRowsViaCsv(spreadsheetId, tab.tabName);
      const mapped = mapRowsForTable(tab.targetTable, rawRows);
      const count = replaceTable(tab.targetTable, mapped);
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

  db.prepare(
    "UPDATE sync_runs SET finished_at = ?, status = ?, rows_synced = ?, error = ? WHERE id = ?"
  ).run(
    new Date().toISOString(),
    failure ? "error" : "success",
    totalRows,
    failure ?? null,
    runId
  );

  return results;
}
