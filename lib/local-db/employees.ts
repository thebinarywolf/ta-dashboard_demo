import { randomUUID } from "node:crypto";
import { getLocalDb } from "./client";
import type { EmployeeRow } from "@/lib/supabase/types";

export function getRawEmployees(): EmployeeRow[] {
  return getLocalDb().prepare("SELECT * FROM employees").all() as EmployeeRow[];
}

/** Full replace, same as the other synced tables. Returns the row count. */
export function replaceEmployeesLocal(rows: Omit<EmployeeRow, "id" | "synced_at">[]): number {
  const db = getLocalDb();
  const syncedAt = new Date().toISOString();

  db.exec("DELETE FROM employees");
  const insert = db.prepare(
    `INSERT INTO employees
       (id, employee_code, full_name, department, location, designation,
        date_of_joining, date_of_birth, relieving_date, employee_status, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const r of rows) {
    insert.run(
      randomUUID(),
      r.employee_code,
      r.full_name,
      r.department,
      r.location,
      r.designation,
      r.date_of_joining,
      r.date_of_birth,
      r.relieving_date,
      r.employee_status,
      syncedAt
    );
  }
  return rows.length;
}

export function logQandleRunLocal(args: {
  runId: string;
  startedAt: string;
  rows: number;
  error: string | null;
}): void {
  const db = getLocalDb();
  db.prepare(
    "INSERT INTO sync_runs (id, source_name, started_at, finished_at, status, rows_synced, error) VALUES (?, 'qandle-hrms', ?, ?, ?, ?, ?)"
  ).run(
    args.runId,
    args.startedAt,
    new Date().toISOString(),
    args.error ? "error" : "success",
    args.rows,
    args.error
  );
}
