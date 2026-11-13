// Pure attrition maths over Qandle employee rows — no database access, so it
// runs the same against demo data, the local SQLite file and Supabase rows.
//
// Definitions (also spelled out on the Attrition page):
//  - Headcount on a day D: joined on or before D, and not yet relieved
//    (no relieving date, or a relieving date after D).
//  - Leaver: relieving date falls inside the period.
//  - Attrition %: leavers / average headcount x 100, where average headcount
//    is (headcount at the start + headcount at the end) / 2. It's the rate
//    for the chosen period, not annualised.
//  - Infant leaver: a leaver who left within `infantDays` days of joining.
//  - Infant attrition %: infant leavers / people who joined in the period.

export interface AttritionInput {
  /** Optional extras, only used to list who left. */
  employee_code?: string | null;
  full_name?: string | null;
  designation?: string | null;
  location?: string | null;
  department: string | null;
  date_of_joining: string | null;
  date_of_birth: string | null;
  relieving_date: string | null;
}

export interface AttritionPeriod {
  from: string;
  to: string;
  infantDays: number;
}

export interface AttritionRow {
  label: string;
  headcountStart: number;
  headcountEnd: number;
  averageHeadcount: number;
  joiners: number;
  leavers: number;
  /** leavers / average headcount, as a percentage. null if no headcount. */
  attritionPct: number | null;
  infantLeavers: number;
  /** infant leavers / leavers, as a percentage. null if nobody left. */
  infantShareOfExitsPct: number | null;
  /** infant leavers / joiners, as a percentage. null if nobody joined. */
  infantPctOfJoiners: number | null;
}

export interface AttritionQuality {
  employeesTotal: number;
  /** Rows with a relieving date at all — if 0, the API may not return leavers. */
  withRelievingDate: number;
  /** Not joined yet (no joining date, or a future one). */
  notYetJoined: number;
  /** Leavers in the period with no joining date (can't tell tenure). */
  leaversWithoutJoinDate: number;
  /** In headcount or leavers, but no date of birth (age group unknown). */
  missingDateOfBirth: number;
  /** In headcount or leavers, but no department. */
  missingDepartment: number;
}

/** Narrow the maths to one department and/or one age group. */
export interface AttritionScope {
  department?: string;
  ageGroup?: string;
}

/** One person who left inside the period (only those inside the scope). */
export interface LeaverRecord {
  employeeCode: string | null;
  /** From Qandle. */
  name: string | null;
  department: string;
  designation: string | null;
  location: string | null;
  joined: string | null;
  left: string;
  /** Days between joining and leaving; null if no joining date. */
  tenureDays: number | null;
  ageGroup: string;
  /** Left within the infant window. */
  infant: boolean;
}

export interface AttritionResult {
  period: AttritionPeriod;
  overall: AttritionRow;
  byDepartment: AttritionRow[];
  byAgeGroup: AttritionRow[];
  quality: AttritionQuality;
  /** Everyone who left in the period (within the scope, if one was given). */
  leavers: LeaverRecord[];
}

export const AGE_BAND_UNKNOWN = "Age not recorded";
export const DEPARTMENT_UNKNOWN = "Department not set";

const AGE_BANDS: { label: string; min: number; max: number }[] = [
  { label: "Under 25", min: 0, max: 24 },
  { label: "25–29", min: 25, max: 29 },
  { label: "30–34", min: 30, max: 34 },
  { label: "35–39", min: 35, max: 39 },
  { label: "40–49", min: 40, max: 49 },
  { label: "50 and above", min: 50, max: 200 },
];
export const AGE_BAND_LABELS = [...AGE_BANDS.map((b) => b.label), AGE_BAND_UNKNOWN];

const DAY_MS = 86_400_000;

function toMs(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getTime();
}

export function addDays(iso: string, days: number): string {
  return new Date(toMs(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Same day-of-month N months away, clamped to the month's last day. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toMs(toIso) - toMs(fromIso)) / DAY_MS);
}

/** Whole years between a date of birth and `on`. */
export function ageOn(dob: string, on: string): number {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [oy, om, od] = on.split("-").map(Number);
  let age = oy - by;
  if (om < bm || (om === bm && od < bd)) age--;
  return age;
}

export function ageBandFor(dob: string | null, on: string): string {
  if (!dob) return AGE_BAND_UNKNOWN;
  const age = ageOn(dob, on);
  if (age < 0) return AGE_BAND_UNKNOWN;
  return AGE_BANDS.find((b) => age >= b.min && age <= b.max)?.label ?? AGE_BAND_UNKNOWN;
}

function isOnPayroll(e: AttritionInput, on: string): boolean {
  if (!e.date_of_joining || e.date_of_joining > on) return false;
  return !e.relieving_date || e.relieving_date > on;
}

function pct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

interface Tally {
  headcountStart: number;
  headcountEnd: number;
  joiners: number;
  leavers: number;
  infantLeavers: number;
}

const emptyTally = (): Tally => ({
  headcountStart: 0,
  headcountEnd: 0,
  joiners: 0,
  leavers: 0,
  infantLeavers: 0,
});

function toRow(label: string, t: Tally): AttritionRow {
  const average = (t.headcountStart + t.headcountEnd) / 2;
  return {
    label,
    headcountStart: t.headcountStart,
    headcountEnd: t.headcountEnd,
    averageHeadcount: average,
    joiners: t.joiners,
    leavers: t.leavers,
    attritionPct: pct(t.leavers, average),
    infantLeavers: t.infantLeavers,
    infantShareOfExitsPct: pct(t.infantLeavers, t.leavers),
    infantPctOfJoiners: pct(t.infantLeavers, t.joiners),
  };
}

export function computeAttrition(
  employees: AttritionInput[],
  period: AttritionPeriod,
  today: string,
  scope: AttritionScope = {}
): AttritionResult {
  const { from, to, infantDays } = period;
  const dayBeforeStart = addDays(from, -1);

  const overall = emptyTally();
  const byDept = new Map<string, Tally>();
  const byAge = new Map<string, Tally>(AGE_BAND_LABELS.map((l) => [l, emptyTally()]));

  const quality: AttritionQuality = {
    employeesTotal: employees.length,
    withRelievingDate: 0,
    notYetJoined: 0,
    leaversWithoutJoinDate: 0,
    missingDateOfBirth: 0,
    missingDepartment: 0,
  };

  const inScope = (dept: string, age: string) =>
    (!scope.department || dept === scope.department) && (!scope.ageGroup || age === scope.ageGroup);
  const leavers: LeaverRecord[] = [];

  const bump = (
    dept: string,
    age: string,
    field: keyof Tally
  ) => {
    if (!inScope(dept, age)) return;
    overall[field]++;
    if (!byDept.has(dept)) byDept.set(dept, emptyTally());
    byDept.get(dept)![field]++;
    byAge.get(age)![field]++;
  };

  for (const e of employees) {
    const dept = e.department?.trim() || DEPARTMENT_UNKNOWN;
    if (e.relieving_date) quality.withRelievingDate++;
    if (!e.date_of_joining || e.date_of_joining > today) quality.notYetJoined++;

    let counted = false;

    if (isOnPayroll(e, dayBeforeStart)) {
      bump(dept, ageBandFor(e.date_of_birth, dayBeforeStart), "headcountStart");
      counted = true;
    }
    if (isOnPayroll(e, to)) {
      bump(dept, ageBandFor(e.date_of_birth, to), "headcountEnd");
      counted = true;
    }
    if (e.date_of_joining && e.date_of_joining >= from && e.date_of_joining <= to) {
      bump(dept, ageBandFor(e.date_of_birth, e.date_of_joining), "joiners");
      counted = true;
    }
    if (e.relieving_date && e.relieving_date >= from && e.relieving_date <= to) {
      const age = ageBandFor(e.date_of_birth, e.relieving_date);
      bump(dept, age, "leavers");
      counted = true;
      const tenureDays = e.date_of_joining ? daysBetween(e.date_of_joining, e.relieving_date) : null;
      const infant = tenureDays !== null && tenureDays <= infantDays;
      if (tenureDays === null) {
        quality.leaversWithoutJoinDate++;
      } else if (infant) {
        bump(dept, age, "infantLeavers");
      }
      if (inScope(dept, age)) {
        leavers.push({
          employeeCode: e.employee_code?.trim() || null,
          name: e.full_name?.trim() || null,
          department: dept,
          designation: e.designation ?? null,
          location: e.location ?? null,
          joined: e.date_of_joining,
          left: e.relieving_date,
          tenureDays,
          ageGroup: age,
          infant,
        });
      }
    }

    if (counted) {
      if (!e.date_of_birth) quality.missingDateOfBirth++;
      if (!e.department?.trim()) quality.missingDepartment++;
    }
  }

  const byDepartment = [...byDept.entries()]
    .map(([label, t]) => toRow(label, t))
    .filter((r) => r.headcountStart + r.headcountEnd + r.joiners + r.leavers > 0)
    .sort((a, b) => b.leavers - a.leavers || a.label.localeCompare(b.label));

  const byAgeGroup = AGE_BAND_LABELS.map((label) => toRow(label, byAge.get(label)!)).filter(
    (r) => r.headcountStart + r.headcountEnd + r.joiners + r.leavers > 0
  );

  return {
    period,
    overall: toRow("Overall", overall),
    byDepartment,
    byAgeGroup,
    quality,
    leavers,
  };
}
