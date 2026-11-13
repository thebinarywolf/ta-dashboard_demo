// Single source of truth for every external data source this app syncs.
// Adding the next module (e.g. Qandle HRMS) means adding one entry here and
// one connector under lib/connectors/<type>/ that implements the Connector
// interface (lib/connectors/types.ts) — the metrics layer and UI never
// change. See docs/join-keys.md for how sources link to each other.

export type DataSourceType = "google_sheets" | "qandle_hrms";

export interface GoogleSheetsTabConfig {
  /** Exact tab name as it appears in the spreadsheet. */
  tabName: string;
  /** Postgres table this tab's rows are upserted into. */
  targetTable:
    | "positions"
    | "candidate_feedback"
    | "upcoming_joiners"
    | "drop_outs";
}

export interface GoogleSheetsSourceConfig {
  name: string;
  type: "google_sheets";
  /** Spreadsheet ID from its URL, or GOOGLE_SHEETS_SPREADSHEET_ID if unset. */
  spreadsheetId?: string;
  keyColumn: "Position ID";
  tabs: GoogleSheetsTabConfig[];
}

export type DataSourceConfig = GoogleSheetsSourceConfig;

export const dataSources: DataSourceConfig[] = [
  {
    name: "ta-tracker-sheet",
    type: "google_sheets",
    // From https://docs.google.com/spreadsheets/d/YOUR_TA_TRACKER_SPREADSHEET_ID/edit
    // Override via GOOGLE_SHEETS_SPREADSHEET_ID if this ever needs to point
    // elsewhere (e.g. a per-environment copy).
    spreadsheetId: "YOUR_TA_TRACKER_SPREADSHEET_ID",
    keyColumn: "Position ID",
    tabs: [
      { tabName: "Dash - Position Tracker", targetTable: "positions" },
      {
        tabName: "Dash - Daily Candidate Feedback",
        targetTable: "candidate_feedback",
      },
      {
        tabName: "Dash - Overall Upcoming joiner",
        targetTable: "upcoming_joiners",
      },
      { tabName: "Dash - Drop Outs", targetTable: "drop_outs" },
    ],
  },
];

export function getSpreadsheetId(source: GoogleSheetsSourceConfig): string {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? source.spreadsheetId;
  if (!id) {
    throw new Error(
      `No spreadsheetId configured for source "${source.name}" and GOOGLE_SHEETS_SPREADSHEET_ID is not set`
    );
  }
  return id;
}

// HR exits spreadsheet: the "Exit Employees" tab has the reasons people gave for
// leaving. It is a different spreadsheet from the TA tracker, read through its
// "Anyone with the link can view" share link. Override the ID with
// EXIT_SHEET_SPREADSHEET_ID if it ever moves.
export const exitSheetSource = {
  name: "exit-employees-sheet",
  spreadsheetId: "YOUR_EXIT_SHEET_SPREADSHEET_ID",
  tabName: "Exit Employees",
};

export function getExitSheetId(): string {
  return process.env.EXIT_SHEET_SPREADSHEET_ID ?? exitSheetSource.spreadsheetId;
}

// Finance spreadsheet: the "Real OG" tab has people cost and headcount with one
// column per month. Read through its own Apps Script when FINANCE_APPS_SCRIPT_*
// is set, otherwise through the sheet's public share link. Override the ID with
// FINANCE_SHEET_SPREADSHEET_ID if it ever moves.
export const financeSheetSource = {
  name: "finance-sheet",
  spreadsheetId: "YOUR_FINANCE_SPREADSHEET_ID",
  tabName: "Real OG",
};

export function getFinanceSheetId(): string {
  return process.env.FINANCE_SHEET_SPREADSHEET_ID ?? financeSheetSource.spreadsheetId;
}
