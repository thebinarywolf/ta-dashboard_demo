// Who counts in each Attrition view.
//
// The Qandle account holds several kinds of people, told apart by Emp code:
//   - The company employees ........ "WG" + digits   (WG00555)
//   - Company interns ................ "WG-INT-..."
//   - Company consultants ............. "WG-CON-..."
//   - other companies, e.g. White Projects ("WP…", "WPCON…"), board members and
//     anything else .................... left out of every view
// Each of the first three is shown on its own, never mixed into the others.
//
// Leavers are counted from Qandle's leaving dates. The HR exits sheet then adds
// the reasons; anyone who left per Qandle but has no exits-sheet row is listed
// in a note so the sheet can be completed. Set REQUIRE_EXIT_RECORD_FOR_LEAVERS
// to true to count only people who are in the exits sheet.

export type PeopleGroup = "employees" | "interns" | "contractors";

export const PEOPLE_GROUPS: { key: PeopleGroup; label: string }[] = [
  { key: "employees", label: "Employees" },
  { key: "interns", label: "Interns" },
  { key: "contractors", label: "Consultants" },
];

export const REQUIRE_EXIT_RECORD_FOR_LEAVERS = false;

export interface ScopableEmployee {
  employee_code: string | null;
  date_of_joining: string | null;
  relieving_date: string | null;
  department: string | null;
}

export interface MissingFromExitSheet {
  code: string;
  department: string | null;
  relieving_date: string;
}

export const codeKey = (code: string | null | undefined) => (code ?? "").trim().toUpperCase();

export function groupOfCode(code: string | null | undefined): PeopleGroup | "other" {
  const c = codeKey(code);
  if (c.startsWith("WG-INT")) return "interns";
  if (c.startsWith("WG-CON")) return "contractors";
  if (/^WG\d/.test(c)) return "employees";
  return "other";
}

export function parseGroup(value: string | undefined): PeopleGroup {
  return PEOPLE_GROUPS.some((g) => g.key === value) ? (value as PeopleGroup) : "employees";
}

export interface GroupScope<T extends ScopableEmployee> {
  employees: T[];
  /** People in Qandle that belong to none of the three groups (other companies…). */
  otherCount: number;
  /** How many people each group has in Qandle (for the switch buttons). */
  groupSizes: Record<PeopleGroup, number>;
  /** People in this group with a leaving date in the period but no exits-sheet
   *  row (no reason on record). */
  missingFromExitSheet: MissingFromExitSheet[];
  /** False when the exits sheet has no rows at all (not synced yet). */
  exitSheetLoaded: boolean;
}

export function scopeToGroup<T extends ScopableEmployee>(
  employees: T[],
  group: PeopleGroup,
  exitCodes: Set<string>,
  period: { from: string; to: string }
): GroupScope<T> {
  const exitSheetLoaded = exitCodes.size > 0;
  const kept: T[] = [];
  const missing: MissingFromExitSheet[] = [];
  const groupSizes: Record<PeopleGroup, number> = { employees: 0, interns: 0, contractors: 0 };
  let otherCount = 0;

  for (const e of employees) {
    const g = groupOfCode(e.employee_code);
    if (g === "other") {
      otherCount++;
      continue;
    }
    groupSizes[g]++;
    if (g !== group) continue;

    const inExitSheet = exitCodes.has(codeKey(e.employee_code));
    if (e.relieving_date && exitSheetLoaded && !inExitSheet) {
      if (e.relieving_date >= period.from && e.relieving_date <= period.to) {
        missing.push({
          code: codeKey(e.employee_code),
          department: e.department,
          relieving_date: e.relieving_date,
        });
      }
      if (REQUIRE_EXIT_RECORD_FOR_LEAVERS) continue;
    }
    kept.push(e);
  }

  missing.sort((a, b) => b.relieving_date.localeCompare(a.relieving_date));
  return { employees: kept, otherCount, groupSizes, missingFromExitSheet: missing, exitSheetLoaded };
}
