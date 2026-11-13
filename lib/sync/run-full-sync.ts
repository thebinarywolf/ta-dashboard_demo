import { dataSources } from "@/config/data-sources";
import { WRITE_BACKEND } from "@/lib/data-source/config";
import { createGoogleSheetsConnector } from "@/lib/connectors/google-sheets/sync";
import { syncGoogleSheetsToLocalDb } from "@/lib/local-db/sync";
import { syncQandle } from "@/lib/connectors/qandle/sync";
import { syncExitSheet } from "@/lib/connectors/exit-sheet/sync";
import type { SyncResult } from "@/lib/connectors/types";
import { pruneSyncRuns } from "./prune-sync-runs";
import { SHOWCASE } from "@/lib/showcase/flag";

export const SHOWCASE_SYNC_OFF = "Sync is switched off in this showcase copy: all data here is made up.";

/**
 * One full sync: every Google Sheets tab, then Qandle, then the HR exits
 * sheet. Used by both the Admin "Sync now" button and the automatic sync, so
 * the two always do exactly the same thing.
 */
export async function runFullSync(): Promise<SyncResult[]> {
  // The showcase must never pull real data in (see lib/showcase/flag.ts).
  if (SHOWCASE) throw new Error(SHOWCASE_SYNC_OFF);
  const allResults: SyncResult[] = [];
  for (const source of dataSources) {
    if (source.type !== "google_sheets") continue;
    const results =
      WRITE_BACKEND === "sqlite"
        ? await syncGoogleSheetsToLocalDb(source)
        : await createGoogleSheetsConnector(source).sync();
    allResults.push(...results);
  }
  // No-op unless Qandle credentials are configured.
  allResults.push(...(await syncQandle()));
  // Exit reasons for the Attrition tab (separate HR exits sheet).
  allResults.push(...(await syncExitSheet()));
  // Housekeeping: drop sync log entries older than 90 days. Never let this
  // fail the sync itself.
  try {
    await pruneSyncRuns();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
  }
  return allResults;
}
