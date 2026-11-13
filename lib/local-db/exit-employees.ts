import { randomUUID } from "node:crypto";
import { getLocalDb } from "./client";
import type { ExitEmployeeRow } from "@/lib/supabase/types";

export function getRawExitEmployees(): ExitEmployeeRow[] {
  return getLocalDb().prepare("SELECT * FROM exit_employees").all() as ExitEmployeeRow[];
}

/** Full replace, same as the other synced tables. Returns the row count. */
export function replaceExitEmployeesLocal(rows: Omit<ExitEmployeeRow, "id" | "synced_at">[]): number {
  const db = getLocalDb();
  const syncedAt = new Date().toISOString();

  db.exec("DELETE FROM exit_employees");
  const insert = db.prepare(
    `INSERT INTO exit_employees
       (id, emp_code, emp_name, department, designation, location_type, category,
        branch_name, state, reporting_manager, date_of_joining, resignation_date,
        exit_date, actual_reason, reason_detail, regrettable, talent, voluntary, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const r of rows) {
    insert.run(
      randomUUID(),
      r.emp_code,
      r.emp_name,
      r.department,
      r.designation,
      r.location_type,
      r.category,
      r.branch_name,
      r.state,
      r.reporting_manager,
      r.date_of_joining,
      r.resignation_date,
      r.exit_date,
      r.actual_reason,
      r.reason_detail,
      r.regrettable,
      r.talent,
      r.voluntary,
      syncedAt
    );
  }
  return rows.length;
}
