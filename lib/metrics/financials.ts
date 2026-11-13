import { financeSheetSource, getFinanceSheetId } from "@/config/data-sources";
import { fetchTabGridViaCsv } from "@/lib/connectors/google-sheets/csv-client";
import { fetchFinanceGridViaAppsScript, financeAppsScriptConfigured } from "@/lib/connectors/google-sheets/apps-script-client";
import { parseFinancials, type FinancialsData } from "./financials-parse";
import { SHOWCASE } from "@/lib/showcase/flag";
import { buildShowcaseFinanceGrid } from "@/lib/showcase/generate";

export type FinancialsResult =
  | { ok: true; data: FinancialsData; fetchedAt: string; via: "apps-script" | "share-link" | "sample" }
  | { ok: false; error: string };

// The sheet is read straight from Google rather than copied into the database,
// so the numbers are always what is in the sheet. Reading takes about a second,
// so a copy is kept in memory for a few minutes per server instance.
const CACHE_MS = 5 * 60 * 1000;
let cached: { at: number; result: Extract<FinancialsResult, { ok: true }> } | null = null;

export async function getFinancials(opts: { fresh?: boolean } = {}): Promise<FinancialsResult> {
  if (SHOWCASE) {
    // Never read the real finance sheet in the showcase: it holds payroll.
    return { ok: true, data: parseFinancials(buildShowcaseFinanceGrid()), fetchedAt: new Date().toISOString(), via: "sample" };
  }
  if (!opts.fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.result;
  try {
    const viaScript = financeAppsScriptConfigured();
    const grid = viaScript
      ? await fetchFinanceGridViaAppsScript(financeSheetSource.tabName)
      : await fetchTabGridViaCsv(getFinanceSheetId(), financeSheetSource.tabName);
    const result = {
      ok: true as const,
      data: parseFinancials(grid),
      fetchedAt: new Date().toISOString(),
      via: viaScript ? ("apps-script" as const) : ("share-link" as const),
    };
    cached = { at: Date.now(), result };
    return result;
  } catch (e) {
    // Keep showing the last good copy if Google is briefly unreachable.
    if (cached) return cached.result;
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
