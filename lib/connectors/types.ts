/**
 * Every data source connector (Google Sheets today, Qandle HRMS later)
 * implements this shape: pull from the external system, normalize into
 * rows matching the target Postgres tables, and report what happened.
 * Connectors only ever write to the raw/normalized tables — never to
 * metrics views, and they are never imported from app/**.
 */
export interface SyncResult {
  sourceName: string;
  rowsSynced: number;
  status: "success" | "error";
  error?: string;
}

export interface Connector {
  name: string;
  sync(): Promise<SyncResult[]>;
}
