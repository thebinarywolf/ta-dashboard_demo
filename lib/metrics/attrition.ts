import { createServerSupabaseClient } from "@/lib/supabase/server";
import { selectRows } from "@/lib/supabase/select-rows";
import { resolveDataBackend } from "@/lib/data-source/resolve";
import { demoEmployees, demoExitEmployees } from "@/lib/demo/fixtures";
import { getQandleConfig } from "@/lib/connectors/qandle/client";
import { SHOWCASE } from "@/lib/showcase/flag";
import { getRawEmployees } from "@/lib/local-db/employees";
import { getRawExitEmployees } from "@/lib/local-db/exit-employees";
import type { EmployeeRow, ExitEmployeeRow } from "@/lib/supabase/types";
import { computeAttrition } from "@/lib/metrics/attrition-calc";
import { scopeToGroup } from "@/lib/metrics/attrition-scope";

export interface EmployeesSnapshot {
  employees: EmployeeRow[];
  /** "demo" = made-up sample data; "live" = synced from Qandle. */
  mode: "demo" | "live";
  /** Latest sync time among the rows, or null if none. */
  syncedAt: string | null;
  qandleConfigured: boolean;
}

/**
 * People hired in a period: the same "New joiners" number the Attrition tab
 * shows for Employees (Company employees only, by Qandle joining date), so
 * the two screens always agree.
 */
export function countPeopleHired(
  employees: EmployeeRow[],
  period: { from: string; to: string }
): number {
  const today = new Date().toISOString().slice(0, 10);
  const entity = scopeToGroup(employees, "employees", new Set(), period);
  return computeAttrition(entity.employees, { ...period, infantDays: 90 }, today).overall.joiners;
}

export async function getEmployeesSnapshot(): Promise<EmployeesSnapshot> {
  const backend = resolveDataBackend();
  const qandleConfigured = SHOWCASE || getQandleConfig() !== null;

  let employees: EmployeeRow[];
  let mode: "demo" | "live" = "live";

  if (backend === "fixtures") {
    employees = demoEmployees;
    mode = "demo";
  } else if (backend === "sqlite") {
    employees = getRawEmployees();
  } else {
    const supabase = createServerSupabaseClient();
    employees = await selectRows("employees", () => supabase.from("employees").select("*"));
  }

  const syncedAt =
    employees.map((e) => e.synced_at).sort().reverse()[0] ?? null;
  return { employees, mode, syncedAt, qandleConfigured };
}

/**
 * Who left and why, from the HR exits sheet. Returns an empty list (rather
 * than failing the page) if the table does not exist yet or has not been
 * synced, so the Attrition tab still works without it.
 */
export async function getExitEmployees(): Promise<ExitEmployeeRow[]> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") return demoExitEmployees;
  try {
    if (backend === "sqlite") return getRawExitEmployees();
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.from("exit_employees").select("*");
    return error ? [] : data ?? [];
  } catch {
    return [];
  }
}
