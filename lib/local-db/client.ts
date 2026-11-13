import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_SQL } from "./schema";
import { SHOWCASE } from "@/lib/showcase/flag";
import { seedShowcaseDb } from "@/lib/showcase/generate";

const DB_DIR = path.join(process.cwd(), "local-data");
const DB_PATH = path.join(DB_DIR, "ta-dashboard.sqlite");

let db: DatabaseSync | null = null;

/**
 * A single SQLite connection reused for the life of the Node process (both
 * `next dev`/`next start` and the `npm run sync` CLI). Stored on globalThis
 * so it survives Next.js dev-server hot-reload module re-evaluation rather
 * than reopening the file (and re-running CREATE TABLE IF NOT EXISTS) on
 * every edit.
 */
declare global {
  // eslint-disable-next-line no-var
  var __localDb: DatabaseSync | undefined;
}

export function getLocalDb(): DatabaseSync {
  if (globalThis.__localDb) return globalThis.__localDb;
  if (db) return db;

  if (SHOWCASE) {
    // Made-up data in memory only: nothing is read from or written to disk.
    db = new DatabaseSync(":memory:");
    db.exec(SCHEMA_SQL);
    seedShowcaseDb(db);
    globalThis.__localDb = db;
    return db;
  }

  fs.mkdirSync(DB_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA_SQL);
  // CREATE TABLE IF NOT EXISTS does not add columns to a file created earlier.
  const employeeColumns = db.prepare("PRAGMA table_info(employees)").all() as { name: string }[];
  if (!employeeColumns.some((c) => c.name === "full_name")) {
    db.exec("ALTER TABLE employees ADD COLUMN full_name TEXT");
  }
  globalThis.__localDb = db;
  return db;
}
