// Pure recruiter analytics (no database access), so the same code runs on demo
// data, the local SQLite file and Supabase rows.
//
//  - Open positions: positions still Open, credited to the recruiter(s) in
//    "Assigned TA". A snapshot of today, not narrowed by the date range.
//  - Closed positions: credited to the recruiter(s) in "Closed by" and counted
//    when the Date closed falls in the range. A position closed by several
//    recruiters ("Ananya, Kavya") counts for each of them.
//  - Interviews: rows of the Daily Candidate Feedback tab whose date falls in
//    the range, credited to its Recruiter.
//  - The three sheets spell names differently ("Ananya" / "Ananya Rao",
//    "Arjun" / "Arjun", "Rohan K" / "RohanK"), so every name is first
//    matched to the names used in "Assigned TA".

import type { CandidateFeedbackRow, PositionRow } from "@/lib/supabase/types";

export const NO_SENIORITY = "Not set";
/** Summary rows for closed positions that have no single recruiter behind them. */
export const JOINTLY_CLOSED = "Jointly closed";
export const CLOSER_NOT_RECORDED = "Closer not recorded";

/** "recruiter" is a person; the other two are summary rows for closed positions
 *  that were closed by several recruiters, or by nobody recorded. */
export type RowKind = "recruiter" | "joint" | "unrecorded";

export interface RecruiterRow {
  kind: RowKind;
  name: string;
  openNow: number;
  /** Positions whose Role assigned on date is in the range. */
  assigned: number;
  closed: number;
  avgDaysToClose: number | null;
  interviews: number;
  candidates: number;
  selected: number;
  rejected: number;
  onHold: number;
  /** selected / (selected + rejected), as a percentage. */
  selectionRate: number | null;
}

export type MetricKey = "closed" | "interviews" | "assigned" | "selected";

/** One position behind a number, for the click-through lists. */
export interface PositionDetail {
  /** Row id, for the link to the position page. */
  id: string;
  code: string | null;
  title: string | null;
  department: string | null;
  seniority: string;
  status: "Open" | "Closed";
  assignedTa: string | null;
  closedBy: string | null;
  assignedOn: string | null;
  dateClosed: string | null;
  daysToClose: number | null;
  /** Recruiters credited as owner while open / for the assignment. */
  assignees: string[];
  /** Who the closing is credited to (a recruiter, "Jointly closed", ...). */
  credited: string[];
  /** For a jointly closed position: the recruiters together ("Kavya + Ananya"). */
  jointLabel: string | null;
  /** Counted in the open total (still open today). */
  open: boolean;
  /** Counted in the closed total for the period. */
  closedCounted: boolean;
  /** Role assigned on a day inside the period. */
  assignedInRange: boolean;
}

/** One interview behind a number, for the click-through lists. */
export interface InterviewDetail {
  date: string;
  candidate: string | null;
  /** Row id of the matching position, when the code matches one. */
  positionRowId: string | null;
  positionCode: string | null;
  positionTitle: string | null;
  round: string | null;
  interviewer: string | null;
  recruiterRaw: string | null;
  recruiters: string[];
  outcome: string | null;
  reason: string | null;
}

export interface RecruiterDetails {
  positions: PositionDetail[];
  interviews: InterviewDetail[];
}

/** What a clicked number stands for. */
export type DrillMetric =
  | "open"
  | "closed"
  | "openClosed"
  | "assigned"
  | "interviews"
  | "selected"
  | "rejected"
  | "onHold";

export interface DrillQuery {
  metric: DrillMetric;
  /** One recruiter (or summary row); left out = everyone. */
  name?: string;
  /** Seniority label. */
  level?: string;
  /** "YYYY-MM". */
  month?: string;
  /** A jointly closed combination ("Kavya + Ananya"). */
  combo?: string;
}

export type DrillResult =
  | { kind: "positions"; positions: PositionDetail[] }
  | { kind: "interviews"; interviews: InterviewDetail[] };

/** The positions or interviews behind a clicked number. */
export function drillDown(details: RecruiterDetails, q: DrillQuery): DrillResult {
  const who = (list: string[]) => q.name === undefined || list.includes(q.name);
  const mon = (iso: string | null) => q.month === undefined || (!!iso && iso.slice(0, 7) === q.month);

  if (q.metric === "interviews" || q.metric === "selected" || q.metric === "rejected" || q.metric === "onHold") {
    const outcome =
      q.metric === "selected" ? "Selected" : q.metric === "rejected" ? "Rejected" : q.metric === "onHold" ? "On Hold" : null;
    return {
      kind: "interviews",
      interviews: details.interviews.filter(
        (i) => who(i.recruiters) && mon(i.date) && (outcome === null || i.outcome === outcome)
      ),
    };
  }
  const positions = details.positions.filter((p) => {
    if (q.level !== undefined && p.seniority !== q.level) return false;
    switch (q.metric) {
      case "open":
        return p.open && who(p.assignees);
      case "closed":
        return p.closedCounted && who(p.credited) && mon(p.dateClosed) && (q.combo === undefined || p.jointLabel === q.combo);
      case "openClosed":
        return (p.open && who(p.assignees)) || (p.closedCounted && who(p.credited));
      case "assigned":
        return p.assignedInRange && who(p.assignees) && mon(p.assignedOn);
      default:
        return false;
    }
  });
  return { kind: "positions", positions };
}

export interface RecruiterAnalytics {
  recruiters: RecruiterRow[];
  totals: Omit<RecruiterRow, "name" | "kind">;
  /** Seniority labels present, in order (L1..L7 then "Not set"). */
  seniorities: string[];
  /** recruiter -> seniority -> counts. Open is a snapshot; closed is in range. */
  seniorityMatrix: Record<string, Record<string, { open: number; closed: number }>>;
  /** "YYYY-MM", oldest first. */
  months: string[];
  /** metric -> recruiter -> month -> count. */
  monthly: Record<MetricKey, Record<string, Record<string, number>>>;
  /** Same shapes as the matrices above, for the total rows. */
  seniorityTotals: Record<string, { open: number; closed: number }>;
  monthlyTotals: Record<MetricKey, Record<string, number>>;
  /** Closed positions shared by several recruiters, by combination
   *  ("Kavya + Ananya"), most common first. */
  jointCombos: { label: string; count: number }[];
  sharedClosures: number;
  /** The rows behind every number, so a number can be clicked open. */
  details: RecruiterDetails;
  /** Things to flag: closed positions nobody is credited for, etc. */
  notes: string[];
}

export interface RecruiterAnalyticsOptions {
  /** Inclusive ISO dates; null = no limit. */
  from: string | null;
  to: string | null;
  today: string;
}

const compact = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** "Ananya, Kavya" / "Arjun & Rohan" / "A/B" -> ["Ananya", "Kavya"]. */
export function splitRecruiters(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/,|&|\/|\band\b/i)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Matches a name from any sheet to the names used in "Assigned TA". */
export function canonicalRecruiter(raw: string, known: string[]): string {
  const clean = raw.replace(/\s+/g, " ").trim();
  const c = compact(clean);
  if (!c) return clean;
  for (const k of known) {
    const kc = compact(k);
    if (c === kc || c.startsWith(kc) || kc.startsWith(c)) return k;
  }
  return clean;
}

const monthOf = (iso: string) => iso.slice(0, 7);

function monthsBetween(fromMonth: string, toMonth: string): string[] {
  const out: string[] = [];
  let [y, m] = fromMonth.split("-").map(Number);
  const [ty, tm] = toMonth.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(`${toIso}T00:00:00Z`).getTime() - new Date(`${fromIso}T00:00:00Z`).getTime()) / 86_400_000
  );
}

function seniorityOrder(a: string, b: string): number {
  if (a === NO_SENIORITY) return 1;
  if (b === NO_SENIORITY) return -1;
  const na = a.match(/(\d+)/)?.[1];
  const nb = b.match(/(\d+)/)?.[1];
  if (na && nb) return parseInt(na, 10) - parseInt(nb, 10);
  return a.localeCompare(b);
}

export function computeRecruiterAnalytics(
  positions: PositionRow[],
  feedback: CandidateFeedbackRow[],
  options: RecruiterAnalyticsOptions
): RecruiterAnalytics {
  const { from, to, today } = options;
  const inRange = (d: string | null) =>
    !!d && (from === null || d >= from) && (to === null || d <= to);
  const rangeIsSet = from !== null || to !== null;

  // The names used in "Assigned TA" are the master list, most used first.
  const assignedCounts = new Map<string, number>();
  for (const p of positions) {
    for (const n of splitRecruiters(p.assigned_ta)) {
      if (compact(n) === "all") continue;
      assignedCounts.set(n, (assignedCounts.get(n) ?? 0) + 1);
    }
  }
  const known = [...assignedCounts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const canon = (raw: string) => (compact(raw) === "all" ? "All (whole team)" : canonicalRecruiter(raw, known));

  interface Acc {
    openNow: number;
    assigned: number;
    closed: number;
    closeDays: number[];
    interviews: number;
    candidates: Set<string>;
    selected: number;
    rejected: number;
    onHold: number;
  }
  const accs = new Map<string, Acc>();
  const acc = (name: string): Acc => {
    let a = accs.get(name);
    if (!a) {
      a = { openNow: 0, assigned: 0, closed: 0, closeDays: [], interviews: 0, candidates: new Set(), selected: 0, rejected: 0, onHold: 0 };
      accs.set(name, a);
    }
    return a;
  };

  const seniorityMatrix: RecruiterAnalytics["seniorityMatrix"] = {};
  const seniorities = new Set<string>();
  const bumpSeniority = (name: string, level: string, kind: "open" | "closed") => {
    seniorities.add(level);
    const row = (seniorityMatrix[name] ??= {});
    const cell = (row[level] ??= { open: 0, closed: 0 });
    cell[kind]++;
  };

  const monthly: RecruiterAnalytics["monthly"] = { closed: {}, interviews: {}, assigned: {}, selected: {} };
  const bumpMonth = (metric: MetricKey, name: string, iso: string) => {
    const row = (monthly[metric][name] ??= {});
    const m = monthOf(iso);
    row[m] = (row[m] ?? 0) + 1;
  };

  const notes: string[] = [];
  let closedWithoutCloser = 0;
  let closedWithoutDate = 0;
  let sharedClosures = 0;
  const jointCombos = new Map<string, number>();
  // Closed positions counted in the totals that have no closing date, so they
  // cannot be placed in a month (only possible when no date range is set).
  let closedWithoutDateCounted = 0;
  const allDates: string[] = [];

  // Totals count each position / interview once, whoever is credited.
  const dist = {
    open: 0,
    assigned: 0,
    closed: 0,
    closeDays: [] as number[],
    interviews: 0,
    selected: 0,
    rejected: 0,
    onHold: 0,
    candidates: new Set<string>(),
  };
  const seniorityTotals: RecruiterAnalytics["seniorityTotals"] = {};
  const bumpSeniorityTotal = (level: string, kind: "open" | "closed") => {
    seniorities.add(level);
    const cell = (seniorityTotals[level] ??= { open: 0, closed: 0 });
    cell[kind]++;
  };
  const monthlyTotals: RecruiterAnalytics["monthlyTotals"] = { closed: {}, interviews: {}, assigned: {}, selected: {} };
  const bumpMonthTotal = (metric: MetricKey, iso: string) => {
    const m = monthOf(iso);
    monthlyTotals[metric][m] = (monthlyTotals[metric][m] ?? 0) + 1;
  };

  const positionDetails: PositionDetail[] = [];
  const interviewDetails: InterviewDetail[] = [];
  const rowIdByCode = new Map<string, string>();
  for (const p of positions) if (p.position_id) rowIdByCode.set(p.position_id.trim().toLowerCase(), p.id);

  for (const p of positions) {
    const level = p.seniority?.trim() || NO_SENIORITY;
    const assignees = splitRecruiters(p.assigned_ta).map(canon);
    const detail: PositionDetail = {
      id: p.id,
      code: p.position_id,
      title: p.position_title,
      department: p.department,
      seniority: level,
      status: p.open_closed === "Closed" ? "Closed" : "Open",
      assignedTa: p.assigned_ta,
      closedBy: p.closed_by_ta,
      assignedOn: p.role_assigned_on,
      dateClosed: p.date_closed,
      daysToClose: p.date_closed && p.role_assigned_on ? daysBetween(p.role_assigned_on, p.date_closed) : null,
      assignees,
      credited: [],
      jointLabel: null,
      open: false,
      closedCounted: false,
      assignedInRange: !!p.role_assigned_on && inRange(p.role_assigned_on),
    };

    if (p.role_assigned_on) allDates.push(p.role_assigned_on);
    if (p.role_assigned_on && inRange(p.role_assigned_on)) {
      dist.assigned++;
      bumpMonthTotal("assigned", p.role_assigned_on);
      for (const n of assignees) {
        acc(n).assigned++;
        bumpMonth("assigned", n, p.role_assigned_on);
      }
    }

    if (p.open_closed === "Open") {
      detail.open = true;
      dist.open++;
      bumpSeniorityTotal(level, "open");
      for (const n of assignees) {
        acc(n).openNow++;
        bumpSeniority(n, level, "open");
      }
    } else if (p.open_closed === "Closed") {
      const closers = splitRecruiters(p.closed_by_ta).map(canon);
      if (!p.date_closed && rangeIsSet) closedWithoutDate++;
      if (!rangeIsSet || inRange(p.date_closed)) {
        if (p.date_closed) allDates.push(p.date_closed);
        detail.closedCounted = true;
        dist.closed++;
        if (!p.date_closed) closedWithoutDateCounted++;
        bumpSeniorityTotal(level, "closed");
        if (p.date_closed) bumpMonthTotal("closed", p.date_closed);
        if (p.date_closed && p.role_assigned_on) dist.closeDays.push(daysBetween(p.role_assigned_on, p.date_closed));
        // One closer: that recruiter. Several: shown together on their own row
        // instead of being credited to each. None recorded: also its own row.
        const uniqueClosers = [...new Set(closers)];
        let credited: string[];
        if (uniqueClosers.length === 0) {
          closedWithoutCloser++;
          credited = [CLOSER_NOT_RECORDED];
        } else if (uniqueClosers.length > 1) {
          sharedClosures++;
          const label = [...uniqueClosers].sort().join(" + ");
          jointCombos.set(label, (jointCombos.get(label) ?? 0) + 1);
          credited = [JOINTLY_CLOSED];
          detail.jointLabel = label;
        } else {
          credited = uniqueClosers;
        }
        detail.credited = credited;
        for (const n of credited) {
          const a = acc(n);
          a.closed++;
          bumpSeniority(n, level, "closed");
          if (p.date_closed && p.role_assigned_on) a.closeDays.push(daysBetween(p.role_assigned_on, p.date_closed));
          if (p.date_closed) bumpMonth("closed", n, p.date_closed);
        }
      }
    }
    if (detail.open || detail.closedCounted || detail.assignedInRange) positionDetails.push(detail);
  }

  let interviewsWithoutRecruiter = 0;
  for (const c of feedback) {
    if (c.feedback_date) allDates.push(c.feedback_date);
    if (!inRange(c.feedback_date)) continue;
    dist.interviews++;
    bumpMonthTotal("interviews", c.feedback_date!);
    if (c.candidate_name) dist.candidates.add(c.candidate_name.trim().toLowerCase());
    if (c.outcome === "Selected") {
      dist.selected++;
      bumpMonthTotal("selected", c.feedback_date!);
    } else if (c.outcome === "Rejected") dist.rejected++;
    else if (c.outcome === "On Hold") dist.onHold++;

    const who = splitRecruiters(c.recruiter).map(canon);
    interviewDetails.push({
      date: c.feedback_date!,
      candidate: c.candidate_name,
      positionRowId: c.position_id ? (rowIdByCode.get(c.position_id.trim().toLowerCase()) ?? null) : null,
      positionCode: c.position_id,
      positionTitle: c.position_applied_for,
      round: c.interview_round,
      interviewer: c.interviewer,
      recruiterRaw: c.recruiter,
      recruiters: [...new Set(who)],
      outcome: c.outcome,
      reason: c.reason,
    });
    if (who.length === 0) {
      interviewsWithoutRecruiter++;
      continue;
    }
    for (const n of who) {
      const a = acc(n);
      a.interviews++;
      if (c.candidate_name) a.candidates.add(c.candidate_name.trim().toLowerCase());
      bumpMonth("interviews", n, c.feedback_date!);
      if (c.outcome === "Selected") {
        a.selected++;
        bumpMonth("selected", n, c.feedback_date!);
      } else if (c.outcome === "Rejected") a.rejected++;
      else if (c.outcome === "On Hold") a.onHold++;
    }
  }

  const rate = (s: number, r: number) => (s + r > 0 ? (s / (s + r)) * 100 : null);
  const avg = (days: number[]) => (days.length > 0 ? days.reduce((x, y) => x + y, 0) / days.length : null);

  const recruiters: RecruiterRow[] = [...accs.entries()]
    .map(([name, a]) => ({
      kind: (name === JOINTLY_CLOSED ? "joint" : name === CLOSER_NOT_RECORDED ? "unrecorded" : "recruiter") as RowKind,
      name,
      openNow: a.openNow,
      assigned: a.assigned,
      closed: a.closed,
      avgDaysToClose: avg(a.closeDays),
      interviews: a.interviews,
      candidates: a.candidates.size,
      selected: a.selected,
      rejected: a.rejected,
      onHold: a.onHold,
      selectionRate: rate(a.selected, a.rejected),
    }))
    .sort((a, b) => {
      // People first (most open positions first); the two summary rows go last.
      const order = (r: RecruiterRow) => (r.kind === "recruiter" ? 0 : r.kind === "joint" ? 1 : 2);
      return (
        order(a) - order(b) ||
        b.openNow - a.openNow ||
        b.closed - a.closed ||
        b.interviews - a.interviews ||
        a.name.localeCompare(b.name)
      );
    });

  const totals = {
    openNow: dist.open,
    assigned: dist.assigned,
    closed: dist.closed,
    avgDaysToClose: avg(dist.closeDays),
    interviews: dist.interviews,
    candidates: dist.candidates.size,
    selected: dist.selected,
    rejected: dist.rejected,
    onHold: dist.onHold,
    selectionRate: rate(dist.selected, dist.rejected),
  };

  // Months shown: the chosen range, else everything the data covers (max 24).
  const dataMin = allDates.sort()[0] ?? today;
  const startMonth = monthOf(from ?? dataMin);
  const endMonth = monthOf(to ?? today);
  let months = startMonth <= endMonth ? monthsBetween(startMonth, endMonth) : [];
  if (months.length > 24) months = months.slice(months.length - 24);

  if (closedWithoutCloser > 0) {
    notes.push(
      `${closedWithoutCloser} closed ${closedWithoutCloser === 1 ? "position has" : "positions have"} no "closed by" recruiter in the sheet, so ${closedWithoutCloser === 1 ? "it is" : "they are"} shown on the "${CLOSER_NOT_RECORDED}" row.`
    );
  }
  if (closedWithoutDate > 0) {
    notes.push(
      `${closedWithoutDate} closed ${closedWithoutDate === 1 ? "position has" : "positions have"} no closing date, so ${closedWithoutDate === 1 ? "it is" : "they are"} left out while a date range is chosen.`
    );
  }
  if (closedWithoutDateCounted > 0) {
    notes.push(
      `${closedWithoutDateCounted} closed ${closedWithoutDateCounted === 1 ? "position has" : "positions have"} no closing date, so ${closedWithoutDateCounted === 1 ? "it is" : "they are"} counted in the totals but cannot appear in the month-by-month table.`
    );
  }
  if (interviewsWithoutRecruiter > 0) {
    notes.push(
      `${interviewsWithoutRecruiter} ${interviewsWithoutRecruiter === 1 ? "interview has" : "interviews have"} no recruiter in the feedback sheet, so ${interviewsWithoutRecruiter === 1 ? "it is" : "they are"} not counted for anyone.`
    );
  }
  if (recruiters.some((r) => r.name === "All (whole team)")) {
    notes.push('Positions marked "All" are shown together as "All (whole team)", not split across recruiters.');
  }
  if (sharedClosures > 0) {
    notes.push(
      `${sharedClosures} closed ${sharedClosures === 1 ? "position was" : "positions were"} closed by more than one recruiter. ${sharedClosures === 1 ? "It is" : "They are"} shown together on the "${JOINTLY_CLOSED}" row, not credited to each recruiter, so the closed column adds up to the total.`
    );
  }

  return {
    recruiters,
    totals,
    seniorities: [...seniorities].sort(seniorityOrder),
    seniorityMatrix,
    months,
    monthly,
    seniorityTotals,
    monthlyTotals,
    jointCombos: [...jointCombos.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    sharedClosures,
    details: {
      positions: positionDetails,
      interviews: interviewDetails.sort((a, b) => b.date.localeCompare(a.date)),
    },
    notes,
  };
}
