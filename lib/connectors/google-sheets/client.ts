import { google } from "googleapis";

export type SheetRow = Record<string, string>;

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
    );
  }
  // .env files can't hold real newlines, so the key is stored with \n
  // escapes and needs to be unescaped here.
  const privateKey = rawKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

/**
 * Fetches a tab's data as an array of objects keyed by its header row.
 * Blank trailing columns/rows from the sheet are ignored.
 */
export async function fetchTabRows(
  spreadsheetId: string,
  tabName: string
): Promise<SheetRow[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const range = `'${tabName}'!A1:ZZ`;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });

  const values = res.data.values ?? [];
  if (values.length === 0) return [];

  const [headerRow, ...dataRows] = values;
  const headers = headerRow.map((h) => String(h ?? "").trim());

  return dataRows
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
