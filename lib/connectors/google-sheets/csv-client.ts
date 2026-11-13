import type { SheetRow } from "./client";

/**
 * Fetches a tab via Google Sheets' public CSV export endpoint — works with
 * zero credentials as long as the sheet is shared as "Anyone with the link
 * can view". This is a deliberate, less-secure alternative to the
 * authenticated Sheets API client in client.ts (see README.md for the
 * tradeoffs): it exposes the WHOLE spreadsheet, not just these 4 tabs, to
 * anyone who has the spreadsheet ID. Used for the local-sync path only —
 * the Supabase/production sync path (lib/connectors/google-sheets/sync.ts)
 * still uses the scoped, authenticated service account.
 */
export async function fetchTabRowsViaCsv(
  spreadsheetId: string,
  tabName: string
): Promise<SheetRow[]> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch "${tabName}" (HTTP ${res.status}). Make sure the sheet is shared as "Anyone with the link can view".`
    );
  }

  const text = await res.text();
  // A sheet that isn't actually publicly viewable still returns HTTP 200,
  // but with an HTML sign-in/error page instead of CSV — detect that rather
  // than silently parsing garbage as data.
  if (text.trimStart().startsWith("<")) {
    throw new Error(
      `"${tabName}" isn't publicly readable yet — share the sheet as "Anyone with the link can view" first.`
    );
  }

  return parseCsv(text);
}

/** The raw grid (header row included) of a publicly readable tab, for sheets
 *  whose headers are blank or unusual and so cannot be read by name. */
export async function fetchTabGridViaCsv(spreadsheetId: string, tabName: string): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Failed to fetch "${tabName}" (HTTP ${res.status}). Make sure the sheet is shared as "Anyone with the link can view".`
    );
  }
  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    throw new Error(
      `"${tabName}" isn't publicly readable yet — share the sheet as "Anyone with the link can view" first.`
    );
  }
  return parseCsvRows(text);
}

function parseCsv(text: string): SheetRow[] {
  const table = parseCsvRows(text);
  if (table.length === 0) return [];

  const headers = table[0].map((h) => h.trim());
  return table
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => {
      const obj: SheetRow = {};
      headers.forEach((header, i) => {
        if (!header) return;
        obj[header] = (row[i] ?? "").trim();
      });
      return obj;
    });
}

/** Minimal RFC4180 CSV parser: handles quoted fields, embedded commas/newlines, "" escapes. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // handled by the following \n
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
