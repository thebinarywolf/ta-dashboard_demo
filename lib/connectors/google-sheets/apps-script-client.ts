import type { SheetRow } from "./client";

/**
 * Fetches a tab via a Google Apps Script Web App bound to the spreadsheet —
 * an alternative to the service-account Sheets API (client.ts) that needs no
 * Google Cloud Console project, no service account, and no `googleapis`
 * dependency at all. The script (pasted into the sheet's own
 * Extensions -> Apps Script editor, see docs/google-apps-script-setup.md)
 * runs as whoever deployed it and only returns data to callers who supply
 * the shared secret below — unlike csv-client.ts, the spreadsheet itself is
 * never made public.
 */
export async function fetchTabRowsViaAppsScript(tabName: string): Promise<SheetRow[]> {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;
  if (!url || !secret) {
    throw new Error("Missing GOOGLE_APPS_SCRIPT_URL / GOOGLE_APPS_SCRIPT_SECRET");
  }

  const endpoint = new URL(url);
  endpoint.searchParams.set("tab", tabName);
  endpoint.searchParams.set("key", secret);

  const res = await fetch(endpoint.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Apps Script request for "${tabName}" failed (HTTP ${res.status}). Make sure the Web App is deployed with access "Anyone with the link".`
    );
  }

  let data: { headers?: string[]; rows?: string[][]; error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error(
      `Apps Script for "${tabName}" didn't return JSON — check the deployed script matches docs/google-apps-script-setup.md.`
    );
  }
  if (data.error) {
    throw new Error(`Apps Script error for "${tabName}": ${data.error}`);
  }

  const headers = (data.headers ?? []).map((h) => String(h ?? "").trim());
  const rows = data.rows ?? [];

  return rows
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => {
      const obj: SheetRow = {};
      headers.forEach((header, i) => {
        if (!header) return;
        obj[header] = String(row[i] ?? "").trim();
      });
      return obj;
    });
}

/** True when the exit sheet has its own Apps Script Web App configured. */
export function exitAppsScriptConfigured(): boolean {
  return !!(process.env.EXIT_APPS_SCRIPT_URL && process.env.EXIT_APPS_SCRIPT_SECRET);
}

/**
 * The raw grid (header row first) of a tab served by the EXIT sheet's own Apps
 * Script Web App (EXIT_APPS_SCRIPT_URL / EXIT_APPS_SCRIPT_SECRET). That sheet is
 * a different spreadsheet from the TA tracker, so it needs its own script and
 * secret. The grid is returned as-is because some of its headers are blank.
 */
export async function fetchExitGridViaAppsScript(tabName: string): Promise<string[][]> {
  const url = process.env.EXIT_APPS_SCRIPT_URL;
  const secret = process.env.EXIT_APPS_SCRIPT_SECRET;
  if (!url || !secret) {
    throw new Error("Missing EXIT_APPS_SCRIPT_URL / EXIT_APPS_SCRIPT_SECRET");
  }
  return fetchGridFromScript("Exit sheet", url, secret, tabName);
}

/** True when the finance sheet has its own Apps Script Web App configured. */
export function financeAppsScriptConfigured(): boolean {
  return !!(process.env.FINANCE_APPS_SCRIPT_URL && process.env.FINANCE_APPS_SCRIPT_SECRET);
}

/** The raw grid (header row first) of a tab served by the FINANCE sheet's own
 *  Apps Script Web App (FINANCE_APPS_SCRIPT_URL / FINANCE_APPS_SCRIPT_SECRET). */
export async function fetchFinanceGridViaAppsScript(tabName: string): Promise<string[][]> {
  const url = process.env.FINANCE_APPS_SCRIPT_URL;
  const secret = process.env.FINANCE_APPS_SCRIPT_SECRET;
  if (!url || !secret) {
    throw new Error("Missing FINANCE_APPS_SCRIPT_URL / FINANCE_APPS_SCRIPT_SECRET");
  }
  return fetchGridFromScript("Finance sheet", url, secret, tabName);
}

async function fetchGridFromScript(label: string, url: string, secret: string, tabName: string): Promise<string[][]> {
  const endpoint = new URL(url);
  endpoint.searchParams.set("tab", tabName);
  endpoint.searchParams.set("key", secret);

  const res = await fetch(endpoint.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `${label} Apps Script request for "${tabName}" failed (HTTP ${res.status}). Make sure the Web App is deployed with access "Anyone".`
    );
  }

  let data: { headers?: unknown[]; rows?: unknown[][]; error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error(
      `The ${label.toLowerCase()} Apps Script for "${tabName}" didn't return JSON — check it matches docs/google-apps-script-setup.md.`
    );
  }
  if (data.error) throw new Error(`${label} Apps Script error for "${tabName}": ${data.error}`);

  const headers = (data.headers ?? []).map((h) => String(h ?? ""));
  const rows = (data.rows ?? []).map((r) => r.map((c) => String(c ?? "")));
  return [headers, ...rows];
}
