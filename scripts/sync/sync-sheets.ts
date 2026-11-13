// CLI entry point: `npm run sync`. Loads .env.local (Next.js doesn't do
// this for standalone scripts run outside `next dev`/`next build`), then
// runs every configured Google Sheets source through whichever storage
// backend is configured (Supabase if set up, otherwise the local SQLite
// store, fetched via the public CSV export — see lib/data-source/config.ts).
import { config } from "dotenv";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { WRITE_BACKEND } = await import("../../lib/data-source/config");
  const { dataSources } = await import("../../config/data-sources");

  for (const source of dataSources) {
    if (source.type !== "google_sheets") continue;
    console.log(`Syncing "${source.name}" (${WRITE_BACKEND})...`);

    const results =
      WRITE_BACKEND === "sqlite"
        ? await (
            await import("../../lib/local-db/sync")
          ).syncGoogleSheetsToLocalDb(source)
        : await (
            await import("../../lib/connectors/google-sheets/sync")
          ).createGoogleSheetsConnector(source).sync();

    for (const result of results) {
      if (result.status === "success") {
        console.log(`  OK  ${result.sourceName}: ${result.rowsSynced} rows`);
      } else {
        console.error(`  FAIL ${result.sourceName}: ${result.error}`);
      }
    }

    if (results.some((r) => r.status === "error")) {
      process.exitCode = 1;
    }
  }

  // Qandle HRMS employees (for the Attrition tab). Skipped silently unless
  // QANDLE_CLIENT_ID / QANDLE_CLIENT_SECRET are set.
  const { syncQandle } = await import("../../lib/connectors/qandle/sync");
  // Exit reasons (who left and why) from the separate HR exits sheet.
  const { syncExitSheet } = await import("../../lib/connectors/exit-sheet/sync");
  const qandleResults = [...(await syncQandle()), ...(await syncExitSheet())];
  for (const result of qandleResults) {
    if (result.status === "success") {
      console.log(`  OK  ${result.sourceName}: ${result.rowsSynced} rows`);
    } else {
      console.error(`  FAIL ${result.sourceName}: ${result.error}`);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exitCode = 1;
});
