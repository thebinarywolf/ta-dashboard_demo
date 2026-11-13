// Pure "attrition analysis" for one scope (everyone, one department or one age
// group): the headline numbers, who left, and why. The numbers come straight
// from computeAttrition so they always match the tables; the reasons come from
// the HR exits sheet, matched to Qandle leavers by employee code.

import type { AttritionRow, LeaverRecord } from "./attrition-calc";

export interface ExitInput {
  emp_code: string;
  emp_name: string | null;
  designation: string | null;
  location_type: string | null;
  branch_name: string | null;
  state: string | null;
  reporting_manager: string | null;
  exit_date: string | null;
  actual_reason: string | null;
  reason_detail: string | null;
  regrettable: string | null;
  voluntary: string | null;
}

export interface LeaverDetail {
  employeeCode: string | null;
  /** From the exits sheet; Qandle names are deliberately not stored. */
  name: string | null;
  designation: string | null;
  /** Branch name from the exits sheet, else the Qandle location. */
  place: string | null;
  state: string | null;
  manager: string | null;
  joined: string | null;
  left: string;
  tenureDays: number | null;
  infant: boolean;
  /** Standard reason, e.g. "Better opportunity". */
  reason: string | null;
  /** The detailed free text behind it. */
  detail: string | null;
  regrettable: string | null;
  voluntary: string | null;
  /** Found in the exits sheet at all. */
  hasExitRecord: boolean;
}

export interface ReasonCount {
  reason: string;
  count: number;
  /** Share of everyone who left in this scope. */
  pct: number;
}

export interface TenureBucket {
  label: string;
  count: number;
}

export interface AttritionAnalysis {
  /** The same row the breakdown tables show, so the numbers always agree. */
  metrics: AttritionRow;
  leavers: LeaverDetail[];
  reasons: ReasonCount[];
  /** Leavers with no standard reason (no exits-sheet record, or blank reason). */
  noReason: number;
  /** Leavers found in the exits sheet. */
  withExitRecord: number;
  regrettable: { regrettable: number; nonRegrettable: number; notMarked: number };
  voluntary: { voluntary: number; involuntary: number; notMarked: number };
  tenure: TenureBucket[];
}

const TENURE_BUCKETS: { label: string; max: number }[] = [
  { label: "Up to 3 months", max: 90 },
  { label: "3–6 months", max: 182 },
  { label: "6–12 months", max: 365 },
  { label: "1–2 years", max: 730 },
  { label: "Over 2 years", max: Infinity },
];
export const TENURE_UNKNOWN = "Joining date not known";

const codeKey = (code: string | null | undefined) => (code ?? "").trim().toUpperCase();

export function buildAttritionAnalysis(
  metrics: AttritionRow,
  leavers: LeaverRecord[],
  exits: ExitInput[]
): AttritionAnalysis {
  const exitByCode = new Map<string, ExitInput>();
  for (const x of exits) exitByCode.set(codeKey(x.emp_code), x);

  const details: LeaverDetail[] = leavers
    .map((l) => {
      const x = l.employeeCode ? exitByCode.get(codeKey(l.employeeCode)) : undefined;
      return {
        employeeCode: l.employeeCode,
        // Qandle is the system of record for names; the exits sheet is the fallback.
        name: l.name ?? x?.emp_name ?? null,
        designation: x?.designation ?? l.designation,
        place: x?.branch_name ?? l.location,
        state: x?.state ?? null,
        manager: x?.reporting_manager ?? null,
        joined: l.joined,
        left: l.left,
        tenureDays: l.tenureDays,
        infant: l.infant,
        reason: x?.actual_reason ?? null,
        detail: x?.reason_detail ?? null,
        regrettable: x?.regrettable ?? null,
        voluntary: x?.voluntary ?? null,
        hasExitRecord: !!x,
      };
    })
    .sort((a, b) => b.left.localeCompare(a.left) || (a.employeeCode ?? "").localeCompare(b.employeeCode ?? ""));

  const total = details.length;
  const reasonCounts = new Map<string, number>();
  let noReason = 0;
  const regrettable = { regrettable: 0, nonRegrettable: 0, notMarked: 0 };
  const voluntary = { voluntary: 0, involuntary: 0, notMarked: 0 };
  const tenureCounts = new Map<string, number>();

  for (const d of details) {
    if (d.reason) reasonCounts.set(d.reason, (reasonCounts.get(d.reason) ?? 0) + 1);
    else noReason++;

    if (d.regrettable === "Regrettable") regrettable.regrettable++;
    else if (d.regrettable === "Non-regrettable") regrettable.nonRegrettable++;
    else regrettable.notMarked++;

    if (d.voluntary === "Voluntary") voluntary.voluntary++;
    else if (d.voluntary === "Involuntary") voluntary.involuntary++;
    else voluntary.notMarked++;

    const bucket =
      d.tenureDays === null
        ? TENURE_UNKNOWN
        : TENURE_BUCKETS.find((b) => d.tenureDays! <= b.max)!.label;
    tenureCounts.set(bucket, (tenureCounts.get(bucket) ?? 0) + 1);
  }

  const reasons: ReasonCount[] = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count, pct: total > 0 ? (count / total) * 100 : 0 }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

  const tenure: TenureBucket[] = [...TENURE_BUCKETS.map((b) => b.label), TENURE_UNKNOWN]
    .map((label) => ({ label, count: tenureCounts.get(label) ?? 0 }))
    .filter((b) => b.count > 0 || b.label !== TENURE_UNKNOWN);

  return {
    metrics,
    leavers: details,
    reasons,
    noReason,
    withExitRecord: details.filter((d) => d.hasExitRecord).length,
    regrettable,
    voluntary,
    tenure,
  };
}
