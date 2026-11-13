import type { ExitEmployeeRow } from "@/lib/supabase/types";

export type ExitRowDraft = Omit<ExitEmployeeRow, "id" | "synced_at">;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  agu: 8, // a typo that appears in the sheet ("13-Agu-2024")
};

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1) return null;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > lastDay) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** The exits sheet mixes "09-Apr-2025", "9-Jan-2026", "09-Jun-26" and day-first "10-01-2025". */
export function parseExitDate(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  let m = value.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ,]+(\d{2}|\d{4})$/);
  if (m) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return month ? isoDate(year, month, Number(m[1])) : null;
  }
  m = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return isoDate(Number(m[3]), Number(m[2]), Number(m[1])); // day first
  m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

const clean = (v: string | undefined): string | null => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t ? t : null;
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Most common spelling wins, so "Pre Sales" / "Pre sales" become one value. */
function canonicalCase(values: (string | null)[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const v of values) {
    if (!v) continue;
    const key = v.toLowerCase();
    const spellings = counts.get(key) ?? new Map<string, number>();
    spellings.set(v, (spellings.get(v) ?? 0) + 1);
    counts.set(key, spellings);
  }
  const out = new Map<string, string>();
  for (const [key, spellings] of counts) {
    out.set(key, [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }
  return out;
}

function normaliseRegrettable(v: string | null): string | null {
  if (!v) return null;
  return /^non/i.test(v) ? "Non-regrettable" : /regret/i.test(v) ? "Regrettable" : null;
}

function normaliseVoluntary(v: string | null): string | null {
  if (!v) return null;
  if (/^vol/i.test(v)) return "Voluntary";
  if (/^inv/i.test(v)) return "Involuntary"; // the sheet has the typo "Invountary"
  return null;
}

/**
 * Turns the raw grid of the "Exit Employees" tab into rows. Three date
 * columns have no usable header (two are blank, one holds a date), so they are
 * found by label when one exists and otherwise by position: the three columns
 * right after "Reporting Manager" are joining date, resignation date and
 * last working day, in that order.
 */
export function mapExitGrid(grid: string[][]): ExitRowDraft[] {
  if (grid.length < 2) return [];
  const headers = grid[0].map((h) => (h ?? "").trim());
  const find = (...needles: string[]) =>
    headers.findIndex((h) => needles.some((n) => norm(h).includes(norm(n))));

  const iCode = find("Emp Code");
  const iManager = find("Reporting Manager");
  if (iCode === -1 || iManager === -1) {
    throw new Error(
      `The "Exit Employees" tab doesn't look right: couldn't find the "Emp Code" and "Reporting Manager" columns.`
    );
  }
  const iName = find("Emp Name");
  const iDept = find("Department");
  const iDesig = find("Designation");
  const iLocType = headers.findIndex((h) => norm(h) === "location");
  const iCategory = find("Category");
  const iBranch = find("Branch Name");
  const iState = headers.findIndex((h) => norm(h) === "state");
  const iActual = find("Actual Reason");
  const iDetail = headers.findIndex((h) => norm(h) === "reasons");
  const iRegret = find("Regrettable");
  const iTalent = find("Critical talent");
  const iVoluntary = find("Voluntary");

  const labelled = (re: RegExp) => headers.findIndex((h) => re.test(h));
  const iJoin = labelled(/join|doj/i) !== -1 ? labelled(/join|doj/i) : iManager + 1;
  const iResign = labelled(/resign/i) !== -1 ? labelled(/resign/i) : iManager + 2;
  const iExit =
    labelled(/last working|lwd|exit date|relieving/i) !== -1
      ? labelled(/last working|lwd|exit date|relieving/i)
      : iManager + 3;

  const body = grid.slice(1).filter((r) => r.some((c) => (c ?? "").trim() !== ""));
  const cell = (r: string[], i: number) => (i >= 0 ? clean(r[i]) : null);

  const rawDepts = body.map((r) => cell(r, iDept));
  const rawReasons = body.map((r) => cell(r, iActual));
  const deptCase = canonicalCase(rawDepts);
  const reasonCase = canonicalCase(rawReasons);

  const seen = new Set<string>();
  const rows: ExitRowDraft[] = [];
  for (const r of body) {
    const code = cell(r, iCode)?.toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);

    const dept = cell(r, iDept);
    const reason = cell(r, iActual);
    rows.push({
      emp_code: code,
      emp_name: cell(r, iName),
      department: dept ? deptCase.get(dept.toLowerCase()) ?? dept : null,
      designation: cell(r, iDesig),
      location_type: cell(r, iLocType),
      category: cell(r, iCategory),
      branch_name: cell(r, iBranch),
      state: cell(r, iState),
      reporting_manager: cell(r, iManager),
      date_of_joining: parseExitDate(r[iJoin]),
      resignation_date: parseExitDate(r[iResign]),
      exit_date: parseExitDate(r[iExit]),
      actual_reason: reason ? reasonCase.get(reason.toLowerCase()) ?? reason : null,
      reason_detail: cell(r, iDetail),
      regrettable: normaliseRegrettable(cell(r, iRegret)),
      talent: cell(r, iTalent),
      voluntary: normaliseVoluntary(cell(r, iVoluntary)),
    });
  }
  return rows;
}
