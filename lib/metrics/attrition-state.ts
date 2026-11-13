// State-wise view of Branch Sales. Qandle gives every employee a `location`
// that starts with a state code ("KA-KORAMANGALA", "KL-VARKALA",
// "AP-VIJAYAWADA"), so the state is read from there. That covers people who
// are still here as well as leavers, which is what attrition % needs.

import type { AttritionInput } from "./attrition-calc";

export const BRANCH_SALES_DEPARTMENT = "Branch Sales";
export const STATE_UNKNOWN = "State not set";

const STATE_NAMES: Record<string, string> = {
  KA: "Karnataka",
  KL: "Kerala",
  AP: "Andhra Pradesh",
  TS: "Telangana",
  TG: "Telangana",
  TN: "Tamil Nadu",
  MH: "Maharashtra",
  GA: "Goa",
  PY: "Puducherry",
};

/** "KA-HASSAN" -> "Karnataka". Unknown codes come back as the code itself. */
export function stateFromLocation(location: string | null | undefined): string {
  const match = (location ?? "").match(/^([A-Za-z]{2,3})\s*-/);
  if (!match) return STATE_UNKNOWN;
  const code = match[1].toUpperCase();
  return STATE_NAMES[code] ?? code;
}

export function isBranchSales(department: string | null | undefined): boolean {
  return (department ?? "").trim().toLowerCase() === BRANCH_SALES_DEPARTMENT.toLowerCase();
}

/** Branch Sales employees with `department` replaced by their state, so the
 *  normal attrition maths groups (and scopes) them by state. */
export function branchSalesByState<T extends AttritionInput>(employees: T[]): T[] {
  return employees
    .filter((e) => isBranchSales(e.department))
    .map((e) => ({ ...e, department: stateFromLocation(e.location) }));
}
