// JS ports of the Postgres views in supabase/migrations/0003_metrics_views.sql,
// run against the locally-synced SQLite tables. Kept as plain array
// processing (not SQL) so the two engines' dialect differences (window
// functions, FILTER, FULL OUTER JOIN) never need to match exactly — this is
// the single-user local-sync path, not the multi-user Supabase path, and
// only needs to agree on final numbers, not query mechanics.
import { getLocalDb } from "./client";
import { makeSourceNamer } from "@/lib/metrics/source-names";
import type {
  DropOutRow,
  DropoutFlaggedRow,
  CandidateFeedbackRow,
  FunnelRow,
  PipelineByPosition,
  PositionRow,
  PositionWithSla,
  RecruiterPerformanceRow,
  SourceConversionRow,
  SyncRunRow,
  UpcomingJoinerRow,
} from "@/lib/supabase/types";

const SLA_DAYS: Record<string, number> = { Senior: 90, Mid: 60, Junior: 30 };

function daysBetween(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function periodStats(positions: PositionRow[]): PositionPeriodStats {
  const assignedDates = positions
    .map((p) => p.role_assigned_on)
    .filter((d): d is string => !!d)
    .sort();
  return {
    total: positions.length,
    open: positions.filter((p) => p.open_closed === "Open").length,
    closed: positions.filter((p) => p.open_closed === "Closed").length,
    earliestAssigned: assignedDates[0] ?? null,
    latestAssigned: assignedDates[assignedDates.length - 1] ?? null,
  };
}

/**
 * Pass the positions already narrowed by department/search but NOT by the
 * assigned-date range — carried-forward positions were, by definition,
 * created before the period, so a date filter would hide exactly the ones
 * this needs to count.
 */
/** Open at the end of the period: still open now, or closed only after it. */
export function isOpenAtPeriodEnd(p: PositionRow, period: Pick<CohortPeriod, "start" | "end">): boolean {
  if (p.role_assigned_on && p.role_assigned_on > period.end) return false;
  if (p.open_closed === "Open") return true;
  return p.open_closed === "Closed" && !!p.date_closed && p.date_closed > period.end;
}

/** Closed by the end of the period, counting everything from the start of the
 *  data. A closed position with no Date closed counts as closed. */
export function isClosedByPeriodEnd(p: PositionRow, period: Pick<CohortPeriod, "start" | "end">): boolean {
  if (p.role_assigned_on && p.role_assigned_on > period.end) return false;
  return p.open_closed === "Closed" && (!p.date_closed || p.date_closed <= period.end);
}

export function computeCohortStats(
  positions: PositionRow[],
  period: CohortPeriod
): PositionCohortStats {
  const { start, end } = period;

  const created = { total: 0, carriedForward: 0, newInPeriod: 0 };
  const open = { total: 0, carriedForward: 0, newInPeriod: 0 };
  const closed = { total: 0, carriedForward: 0, newInPeriod: 0, withoutCloseDate: 0 };
  const others = new Map<string, number>();

  for (const p of positions) {
    const assigned = p.role_assigned_on;
    if (assigned && assigned > end) continue; // created after the period

    // Created is grouped by when the position was assigned. Closed and Open
    // are the status AT THE END of the period (closed so far, still open),
    // each split by when the position was assigned, so
    // Closed + Open (+ other statuses) = Created.
    const isNew = !!assigned && assigned >= start;
    const bucket = isNew ? "newInPeriod" : "carriedForward";

    created.total++;
    created[bucket]++;

    if (p.open_closed === "Closed" && !p.date_closed) closed.withoutCloseDate++;
    if (isClosedByPeriodEnd(p, period)) {
      closed.total++;
      closed[bucket]++;
    } else if (isOpenAtPeriodEnd(p, period)) {
      open.total++;
      open[bucket]++;
    } else {
      const label = p.open_closed?.trim() || "No status";
      others.set(label, (others.get(label) ?? 0) + 1);
    }
  }

  return {
    periodStart: start,
    periodEnd: end,
    isCustomRange: period.isCustomRange,
    dataFrom: periodStats(positions).earliestAssigned,
    created,
    open,
    closed,
    otherStatuses: Array.from(others, ([label, count]) => ({ label, count })),
  };
}

/** Default period (no date filter): the current calendar month so far;
 *  otherwise the selected Assigned from/to range. A missing "from" starts at
 *  the earliest data, a missing "to" ends today. */
function resolveCohortPeriod(
  filters: DashboardFilters,
  today: string,
  earliestAssigned: string | null
): CohortPeriod {
  if (!filters.dateFrom && !filters.dateTo) {
    return { start: `${today.slice(0, 7)}-01`, end: today, isCustomRange: false };
  }
  return {
    start: filters.dateFrom ?? earliestAssigned ?? "0000-01-01",
    end: filters.dateTo ?? today,
    isCustomRange: true,
  };
}

function toPositionRow(r: Record<string, unknown>): PositionRow {
  return {
    ...(r as unknown as Omit<PositionRow, "share_with_partners">),
    share_with_partners:
      r.share_with_partners === null || r.share_with_partners === undefined
        ? null
        : Boolean(r.share_with_partners),
  };
}

export function getRawPositions(): PositionRow[] {
  const rows = getLocalDb().prepare("SELECT * FROM positions").all() as Record<string, unknown>[];
  return rows.map(toPositionRow);
}

export function getRawCandidateFeedback(): CandidateFeedbackRow[] {
  return getLocalDb().prepare("SELECT * FROM candidate_feedback").all() as CandidateFeedbackRow[];
}

export function getRawUpcomingJoiners(): UpcomingJoinerRow[] {
  return getLocalDb().prepare("SELECT * FROM upcoming_joiners").all() as UpcomingJoinerRow[];
}

function getRawDropOuts(): DropOutRow[] {
  return getLocalDb().prepare("SELECT * FROM drop_outs").all() as DropOutRow[];
}

export function computePositionsWithSla(positions: PositionRow[]): PositionWithSla[] {
  const today = todayIso();
  return positions.map((p) => {
    const slaDays = p.seniority ? SLA_DAYS[p.seniority] : null;
    const agingDays = p.role_assigned_on ? daysBetween(p.role_assigned_on, today) : null;
    const slaBreached =
      p.open_closed === "Open" && agingDays !== null && slaDays !== null && agingDays > slaDays;
    return { ...p, sla_days: slaDays, aging_days: agingDays, sla_breached: slaBreached };
  });
}

export function getPositionsWithSla(): PositionWithSla[] {
  return computePositionsWithSla(getRawPositions());
}

export function getPositionWithSlaById(id: string): PositionWithSla | null {
  return getPositionsWithSla().find((p) => p.id === id) ?? null;
}

/** "Yet to join" / "Yet to Join" / "yet to join " are all the same status. */
export function isYetToJoinStatus(status: string | null): boolean {
  return !!status && status.trim().toLowerCase() === "yet to join";
}

function isJoinedStatus(status: string | null): boolean {
  return !!status && status.toLowerCase().startsWith("joined");
}

export function getPipelineByPosition(): PipelineByPosition[] {
  const positions = getRawPositions();
  const feedback = getRawCandidateFeedback();
  const joiners = getRawUpcomingJoiners();

  return positions.map((pos) => {
    const cf = pos.position_id
      ? feedback.filter((f) => f.position_id === pos.position_id)
      : [];
    const uj = pos.position_id
      ? joiners.filter((j) => j.position_id === pos.position_id)
      : [];

    const distinct = (names: (string | null)[]) => new Set(names.filter(Boolean)).size;

    return {
      position_pk: pos.id,
      position_id: pos.position_id,
      sourced_count: distinct(cf.map((c) => c.candidate_name)),
      interviewed_count: distinct(cf.filter((c) => c.interview_round).map((c) => c.candidate_name)),
      selected_count: distinct(cf.filter((c) => c.outcome === "Selected").map((c) => c.candidate_name)),
      yet_to_join_count: distinct(uj.filter((j) => isYetToJoinStatus(j.status)).map((j) => j.candidate_name)),
      joined_count: distinct(uj.filter((j) => isJoinedStatus(j.status)).map((j) => j.candidate_name)),
    };
  });
}

export function getPipelineForPositionId(positionId: string): PipelineByPosition | null {
  return getPipelineByPosition().find((p) => p.position_id === positionId) ?? null;
}

function distinctNames(rows: { candidate_name: string | null }[]): Set<string> {
  return new Set(rows.map((r) => r.candidate_name).filter((n): n is string => !!n));
}

export function getFunnelOverall(): FunnelRow {
  const feedback = getRawCandidateFeedback();
  const joiners = getRawUpcomingJoiners();

  return {
    sourced: distinctNames(feedback).size,
    interviewed: distinctNames(feedback.filter((c) => c.interview_round)).size,
    selected: distinctNames(feedback.filter((c) => c.outcome === "Selected")).size,
    offer_accepted: distinctNames(joiners.filter((j) => j.status && j.status !== "Drop")).size,
    joined: distinctNames(joiners.filter((j) => isJoinedStatus(j.status))).size,
  };
}

export function getFunnelByDepartment(): FunnelRow[] {
  const positions = getRawPositions();
  const feedback = getRawCandidateFeedback();
  const joiners = getRawUpcomingJoiners();

  const deptByPositionId = new Map<string, string>();
  for (const p of positions) {
    if (p.position_id && p.department) deptByPositionId.set(p.position_id, p.department);
  }

  const departmentFor = (positionId: string | null, fallback: string | null) =>
    (positionId && deptByPositionId.get(positionId)) || fallback;

  const byDept = new Map<string, FunnelRow>();
  const ensure = (dept: string) => {
    if (!byDept.has(dept)) {
      byDept.set(dept, { department: dept, sourced: 0, interviewed: 0, selected: 0, offer_accepted: 0, joined: 0 });
    }
    return byDept.get(dept)!;
  };

  const seenSourced = new Set<string>();
  const seenInterviewed = new Set<string>();
  const seenSelected = new Set<string>();
  for (const c of feedback) {
    const dept = departmentFor(c.position_id, c.dept_location);
    if (!dept || !c.candidate_name) continue;
    const key = `${dept}|${c.candidate_name}`;
    if (!seenSourced.has(key)) {
      seenSourced.add(key);
      ensure(dept).sourced += 1;
    }
    if (c.interview_round && !seenInterviewed.has(key)) {
      seenInterviewed.add(key);
      ensure(dept).interviewed += 1;
    }
    if (c.outcome === "Selected" && !seenSelected.has(key)) {
      seenSelected.add(key);
      ensure(dept).selected += 1;
    }
  }

  const seenOffer = new Set<string>();
  const seenJoined = new Set<string>();
  for (const j of joiners) {
    const dept = departmentFor(j.position_id, j.department);
    if (!dept || !j.candidate_name) continue;
    const key = `${dept}|${j.candidate_name}`;
    if (j.status && j.status !== "Drop" && !seenOffer.has(key)) {
      seenOffer.add(key);
      ensure(dept).offer_accepted += 1;
    }
    if (isJoinedStatus(j.status) && !seenJoined.has(key)) {
      seenJoined.add(key);
      ensure(dept).joined += 1;
    }
  }

  return Array.from(byDept.values()).sort((a, b) => b.sourced - a.sourced);
}

export function getRecruiterPerformance(): RecruiterPerformanceRow[] {
  const positions = getRawPositions();
  const feedback = getRawCandidateFeedback();

  const byRecruiter = new Map<string, RecruiterPerformanceRow & { closeDaysSum: number; closeDaysCount: number }>();
  const ensure = (name: string) => {
    if (!byRecruiter.has(name)) {
      byRecruiter.set(name, {
        recruiter: name,
        positions_closed: 0,
        avg_days_to_close: null,
        candidates_handled: 0,
        closeDaysSum: 0,
        closeDaysCount: 0,
      });
    }
    return byRecruiter.get(name)!;
  };

  for (const p of positions) {
    const name = p.assigned_ta ?? p.closed_by_ta;
    if (!name) continue;
    const entry = ensure(name);
    if (p.open_closed === "Closed") {
      entry.positions_closed += 1;
      if (p.date_closed && p.role_assigned_on) {
        entry.closeDaysSum += daysBetween(p.role_assigned_on, p.date_closed);
        entry.closeDaysCount += 1;
      }
    }
  }

  for (const name of byRecruiter.keys()) {
    const candidates = distinctNames(feedback.filter((c) => c.recruiter === name));
    ensure(name).candidates_handled = candidates.size;
  }

  return Array.from(byRecruiter.values())
    .map((e) => ({
      recruiter: e.recruiter,
      positions_closed: e.positions_closed,
      avg_days_to_close: e.closeDaysCount > 0 ? e.closeDaysSum / e.closeDaysCount : null,
      candidates_handled: e.candidates_handled,
    }))
    .sort((a, b) => b.positions_closed - a.positions_closed);
}

export function getDropoutsFlagged(): DropoutFlaggedRow[] {
  return getRawDropOuts()
    .map((d) => ({
      ...d,
      unlinked: d.position_id === null,
      missing_dates: d.offer_accepted_date === null || d.actual_dropout_date === null,
      days_gap:
        d.offer_accepted_date && d.actual_dropout_date
          ? daysBetween(d.offer_accepted_date, d.actual_dropout_date)
          : d.days_offer_to_dropout,
    }))
    .sort((a, b) => (b.actual_dropout_date ?? "").localeCompare(a.actual_dropout_date ?? ""));
}

export function getSourceConversion(): SourceConversionRow[] {
  const feedback = getRawCandidateFeedback();
  const joiners = getRawUpcomingJoiners();

  // Best-effort match: a candidate's source is whichever tab names them
  // first (candidate feedback, falling back to the joiner tab), matched by
  // (name, position_id) — there's no shared candidate ID across tabs.
  const bySource = new Map<string, { total: Set<string>; joined: Set<string> }>();
  const nameOf = makeSourceNamer([...feedback.map((c) => c.source), ...joiners.map((j) => j.source)]);
  const ensure = (rawSource: string) => {
    const source = nameOf(rawSource);
    if (!bySource.has(source)) bySource.set(source, { total: new Set(), joined: new Set() });
    return bySource.get(source)!;
  };

  const sourceByKey = new Map<string, string>();
  for (const c of feedback) {
    if (!c.candidate_name || !c.source) continue;
    sourceByKey.set(`${c.candidate_name}|${c.position_id ?? ""}`, c.source);
  }

  for (const c of feedback) {
    if (!c.candidate_name || !c.source) continue;
    ensure(c.source).total.add(c.candidate_name);
  }

  for (const j of joiners) {
    if (!j.candidate_name) continue;
    const key = `${j.candidate_name}|${j.position_id ?? ""}`;
    const source = sourceByKey.get(key) ?? j.source;
    if (!source) continue;
    ensure(source).total.add(j.candidate_name);
    if (isJoinedStatus(j.status)) ensure(source).joined.add(j.candidate_name);
  }

  return Array.from(bySource.entries())
    .map(([source, { total, joined }]) => ({
      source,
      total_candidates: total.size,
      joined_candidates: joined.size,
    }))
    .sort((a, b) => b.total_candidates - a.total_candidates);
}

export function hasSyncedData(): boolean {
  const row = getLocalDb().prepare("SELECT COUNT(*) as c FROM positions").get() as
    | { c: number }
    | undefined;
  return (row?.c ?? 0) > 0;
}

const SYNCED_TABLES = [
  "positions",
  "candidate_feedback",
  "upcoming_joiners",
  "drop_outs",
  "employees",
] as const;

export function getTableRowCounts(): Record<(typeof SYNCED_TABLES)[number], number> {
  const db = getLocalDb();
  const counts = {} as Record<(typeof SYNCED_TABLES)[number], number>;
  for (const table of SYNCED_TABLES) {
    const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
    counts[table] = row.c;
  }
  return counts;
}

export function getLastSyncRun(): Pick<
  SyncRunRow,
  "finished_at" | "status" | "rows_synced"
> | null {
  const row = getLocalDb()
    .prepare(
      "SELECT finished_at, status, rows_synced FROM sync_runs ORDER BY started_at DESC LIMIT 1"
    )
    .get() as Pick<SyncRunRow, "finished_at" | "status" | "rows_synced"> | undefined;
  return row ?? null;
}

// --- Interview-history / rejection-analysis helpers -----------------------
// Pure functions over raw rows (not tied to SQLite) so lib/metrics/interviews.ts
// can reuse the exact same logic against Supabase-fetched rows — one place to
// get the math right, two places it gets called from.

export interface RejectionByPosition {
  id: string | null;
  position_id: string;
  position_title: string | null;
  rejection_count: number;
  top_reason: string | null;
}

export interface ReasonCount {
  reason: string;
  count: number;
}

function daysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Pass `sinceDaysAgo: null` for an all-time (no cutoff) count. */
export function computeInterviewedSince(
  feedback: CandidateFeedbackRow[],
  sinceDaysAgo: number | null
): number {
  const cutoff = sinceDaysAgo !== null ? daysAgoIso(sinceDaysAgo) : null;
  const names = new Set<string>();
  for (const c of feedback) {
    if (c.candidate_name && (cutoff === null || (c.feedback_date && c.feedback_date >= cutoff))) {
      names.add(c.candidate_name);
    }
  }
  return names.size;
}

export function computeInterviewedSinceForPosition(
  feedback: CandidateFeedbackRow[],
  positionId: string,
  sinceDaysAgo: number
): number {
  return computeInterviewedSince(
    feedback.filter((c) => c.position_id === positionId),
    sinceDaysAgo
  );
}

/**
 * Distinct candidates interviewed per weekday over the last 7 days
 * (index 0 = Sunday ... 6 = Saturday), for the "pipeline this week" chart.
 */
export function computeInterviewsByDayLast7Days(
  feedback: CandidateFeedbackRow[]
): number[] {
  const cutoff = daysAgoIso(6);
  const byDay: Set<string>[] = Array.from({ length: 7 }, () => new Set());
  for (const c of feedback) {
    if (!c.candidate_name || !c.feedback_date || c.feedback_date < cutoff) continue;
    const day = new Date(`${c.feedback_date}T00:00:00Z`).getUTCDay();
    byDay[day].add(c.candidate_name);
  }
  return byDay.map((set) => set.size);
}

export function computeRejectionsByPosition(
  positions: PositionRow[],
  feedback: CandidateFeedbackRow[]
): { byPosition: RejectionByPosition[]; unlinkedCount: number } {
  const titleByPositionId = new Map<string, string>();
  const idByPositionId = new Map<string, string>();
  for (const p of positions) {
    if (!p.position_id) continue;
    if (p.position_title) titleByPositionId.set(p.position_id, p.position_title);
    idByPositionId.set(p.position_id, p.id);
  }

  const byPosition = new Map<string, { count: number; reasonCounts: Map<string, number> }>();
  let unlinkedCount = 0;

  for (const c of feedback) {
    if (c.outcome !== "Rejected") continue;
    if (!c.position_id) {
      unlinkedCount += 1;
      continue;
    }
    const entry = byPosition.get(c.position_id) ?? { count: 0, reasonCounts: new Map() };
    entry.count += 1;
    // The standard category from the sheet's Feedback column; the free-text
    // reason is too varied (hundreds of distinct values) to group on.
    const reason = c.feedback ?? "Not recorded";
    entry.reasonCounts.set(reason, (entry.reasonCounts.get(reason) ?? 0) + 1);
    byPosition.set(c.position_id, entry);
  }

  const rows = Array.from(byPosition.entries())
    .map(([positionId, { count, reasonCounts }]) => {
      let topReason: string | null = null;
      let topCount = 0;
      for (const [reason, n] of reasonCounts) {
        if (n > topCount) {
          topReason = reason;
          topCount = n;
        }
      }
      return {
        id: idByPositionId.get(positionId) ?? null,
        position_id: positionId,
        position_title: titleByPositionId.get(positionId) ?? null,
        rejection_count: count,
        top_reason: topReason,
      };
    })
    .sort((a, b) => b.rejection_count - a.rejection_count);

  return { byPosition: rows, unlinkedCount };
}

export function computeInterviewHistory(
  feedback: CandidateFeedbackRow[],
  positionId: string
): CandidateFeedbackRow[] {
  return feedback
    .filter((c) => c.position_id === positionId)
    .sort((a, b) => (b.feedback_date ?? "").localeCompare(a.feedback_date ?? ""));
}

export function computeRejectionReasonsForPosition(
  feedback: CandidateFeedbackRow[],
  positionId: string
): ReasonCount[] {
  const counts = new Map<string, number>();
  for (const c of feedback) {
    if (c.position_id !== positionId || c.outcome !== "Rejected") continue;
    // The standard category from the sheet's Feedback column; the free-text
    // reason is too varied (hundreds of distinct values) to group on.
    const reason = c.feedback ?? "Not recorded";
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

export function getInterviewedLast7Days(): number {
  return computeInterviewedSince(getRawCandidateFeedback(), 7);
}

export function getInterviewsByDayLast7Days(): number[] {
  return computeInterviewsByDayLast7Days(getRawCandidateFeedback());
}

export function getInterviewedLast7DaysForPosition(positionId: string): number {
  return computeInterviewedSinceForPosition(getRawCandidateFeedback(), positionId, 7);
}

export function getRejectionsByPosition(): {
  byPosition: RejectionByPosition[];
  unlinkedCount: number;
} {
  return computeRejectionsByPosition(getRawPositions(), getRawCandidateFeedback());
}

export function getInterviewHistoryForPosition(positionId: string): CandidateFeedbackRow[] {
  return computeInterviewHistory(getRawCandidateFeedback(), positionId);
}

export function getRejectionReasonsForPosition(positionId: string): ReasonCount[] {
  return computeRejectionReasonsForPosition(getRawCandidateFeedback(), positionId);
}

// --- Dashboard overview: filterable totals + derived metrics --------------

export interface DashboardFilters {
  /** Empty/omitted means "all departments". */
  department?: string[];
  /** ISO date, inclusive, matches against role_assigned_on. */
  dateFrom?: string;
  dateTo?: string;
  /** Case-insensitive substring match against position_id or position_title. */
  search?: string;
  /** Which positions the listing table shows. Default "open" — the other
   *  dashboard stats (pipeline, interviewed, rejected, etc.) are unaffected
   *  by this, it only changes what's listed in the table. */
  status?: "open" | "closed" | "all";
  /** Narrow the listing table to one cohort of the headline cards: positions
   *  created before the period ("earlier") or inside it ("new"). When set, the
   *  Assigned from/to range is not applied to the list, because the cohort is
   *  already defined relative to that period. */
  cohort?: "earlier" | "new";
}

export interface PositionSuggestion {
  position_id: string | null;
  position_title: string | null;
}

export interface SeniorityTimeToFill {
  seniority: string;
  avgDays: number | null;
  sampleSize: number;
}

export interface SourceInterviewsPerHire {
  source: string;
  interviews: number;
  hires: number;
  perHire: number | null;
}

export interface PositionPeriodStats {
  total: number;
  open: number;
  closed: number;
  /** Earliest/latest "Role assigned on" among the positions counted here —
   *  for a "data covers Jan 2026 - Sep 2026" caption. null if none matched. */
  earliestAssigned: string | null;
  latestAssigned: string | null;
}

/** The reporting window for the cohort cards: the current month by default,
 *  or the Assigned from/to range when one is selected. Both dates inclusive. */
export interface CohortPeriod {
  start: string;
  end: string;
  isCustomRange: boolean;
}

/**
 * Headline-card numbers relative to a period, grouped by when each position
 * was CREATED (Role assigned on). "Carried forward" = created before the
 * period; "new" = created within it. Positions created after the period
 * ends are left out. The numbers reconcile:
 *   created.total = carriedForward + newInPeriod
 *   closed = everything closed by the END of the period, from the start of
 *     the data (Date closed on or before the end)
 *   open = positions open at the END of the period (assigned by then and not
 *     yet closed), so a position is open from its creation to its closing
 *   created.total = open.total + closed.total + otherStatuses (e.g. cancelled)
 *   each of those split the same two ways, by when the position was assigned
 * Positions with no Role-assigned-on date count as carried forward.
 * closed.withoutCloseDate counts closed positions that have no Date closed
 * in the sheet; they count as closed in every period.
 */
export interface PositionCohortStats {
  periodStart: string;
  periodEnd: string;
  isCustomRange: boolean;
  /** Earliest Role assigned on in the matching positions ("YYYY-MM-DD"). */
  dataFrom: string | null;
  created: { total: number; carriedForward: number; newInPeriod: number };
  open: { total: number; carriedForward: number; newInPeriod: number };
  closed: {
    total: number;
    carriedForward: number;
    newInPeriod: number;
    withoutCloseDate: number;
  };
  /** Positions counted in Created that are neither Open nor Closed (e.g. the
   *  sheet's "Position Cancelled"), by status label. */
  otherStatuses: { label: string; count: number }[];
}

export interface DashboardOverview {
  /** Carry-forward vs this-month split for the Created/Open/Closed cards. */
  cohorts: PositionCohortStats;
  /** Listing-table rows — which set depends on filters.status (default "open"). */
  positions: PositionWithSla[];
  /** Always the single oldest still-open position, regardless of
   *  filters.status — used for the "oldest open position" spotlight card,
   *  which must stay meaningful even when the table itself is showing
   *  closed positions. */
  oldestOpenPosition: PositionWithSla | null;
  /** Every position tracked (carried-forward still-open ones plus ones
   *  created/closed since) matching the active department/date/search
   *  filters — not scoped to this year or month. */
  allTime: PositionPeriodStats;
  /** Same, but only positions assigned so far this calendar year. */
  ytd: PositionPeriodStats;
  /** Same, but only positions assigned so far this calendar month. */
  mtd: PositionPeriodStats;
  /** Per-open-position pipeline/stage breakdown for the open-positions
   *  tracker table, scoped by the same department/date/search filters. */
  openPositionsDetail: OpenPositionRow[];
  totalInPipeline: number;
  totalInterviewed: number;
  interviewedLast7Days: number;
  totalRejected: number;
  interviewsByDayLast7Days: number[];
  departments: string[];
  avgTimeToFillBySeniority: SeniorityTimeToFill[];
  /** Fraction (0-1) of upcoming-joiner rows whose status isn't "Drop". null if no rows. */
  offerAcceptanceRate: number | null;
  offerAcceptanceSampleSize: number;
  interviewsPerHireBySource: SourceInterviewsPerHire[];
  /** false when no candidate_feedback row has a Source value (the sheet's
   *  interview log doesn't track it) — the "interviews" side of the table
   *  above is then all zeros with no real meaning, not a genuine count. */
  interviewSourceDataAvailable: boolean;
  /** Position ID/title pairs for the search box's suggestions, scoped by
   *  department + date filters but not by the search text itself (so
   *  suggestions don't shrink to nothing as you type). */
  searchSuggestions: PositionSuggestion[];
  /** All-time, unfiltered top-10 — computed here (reusing the positions/
   *  feedback already fetched for the rest of this overview) instead of via
   *  a separate call, which used to trigger its own second full-table fetch
   *  of the same two tables on every dashboard load. */
  mostRejectedPositions: { rows: RejectionByPosition[]; unlinkedCount: number };
}

function hasActiveDashboardFilters(f: DashboardFilters): boolean {
  return !!(
    (f.department && f.department.length > 0) ||
    f.dateFrom ||
    f.dateTo ||
    f.search?.trim()
  );
}

function filterPositionsByDeptAndDate(
  positions: PositionRow[],
  f: DashboardFilters
): PositionRow[] {
  return positions.filter((p) => {
    if (f.department && f.department.length > 0) {
      if (!p.department || !f.department.includes(p.department)) return false;
    }
    if (f.dateFrom && (!p.role_assigned_on || p.role_assigned_on < f.dateFrom)) return false;
    if (f.dateTo && (!p.role_assigned_on || p.role_assigned_on > f.dateTo)) return false;
    return true;
  });
}

function filterPositionsBySearch(
  positions: PositionRow[],
  search: string | undefined
): PositionRow[] {
  const q = search?.trim().toLowerCase();
  if (!q) return positions;
  return positions.filter((p) => {
    const haystack = `${p.position_id ?? ""} ${p.position_title ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function computeInterviewsPerHireBySource(
  feedback: CandidateFeedbackRow[],
  joiners: UpcomingJoinerRow[]
): SourceInterviewsPerHire[] {
  // "Job Enquiry" / "Job enquiry" / "job enquiry" are one source.
  const nameOf = makeSourceNamer([...feedback.map((c) => c.source), ...joiners.map((j) => j.source)]);
  const interviewsBySource = new Map<string, number>();
  for (const c of feedback) {
    if (!c.source || !c.source.trim()) continue;
    const name = nameOf(c.source);
    interviewsBySource.set(name, (interviewsBySource.get(name) ?? 0) + 1);
  }
  const hiresBySource = new Map<string, number>();
  for (const j of joiners) {
    if (!j.source || !j.source.trim() || !isJoinedStatus(j.status)) continue;
    const name = nameOf(j.source);
    hiresBySource.set(name, (hiresBySource.get(name) ?? 0) + 1);
  }
  const sources = new Set([...interviewsBySource.keys(), ...hiresBySource.keys()]);
  return Array.from(sources)
    .map((source) => {
      const interviews = interviewsBySource.get(source) ?? 0;
      const hires = hiresBySource.get(source) ?? 0;
      return { source, interviews, hires, perHire: hires > 0 ? interviews / hires : null };
    })
    .sort((a, b) => b.interviews - a.interviews);
}

/**
 * Everything the Position Tracking page needs, computed together so
 * "scoping by filter" only has to be gotten right once. When no filters are
 * active, candidate-level rows (feedback/joiners) are used unrestricted —
 * including ones with no position_id — matching the pre-filter behavior;
 * once any filter is set, they're scoped to positions the filter matched.
 */
export function computeDashboardOverview(
  positions: PositionRow[],
  feedback: CandidateFeedbackRow[],
  joiners: UpcomingJoinerRow[],
  filters: DashboardFilters
): DashboardOverview {
  const departments = Array.from(
    new Set(positions.map((p) => p.department).filter((d): d is string => !!d))
  ).sort();

  const deptDateFiltered = filterPositionsByDeptAndDate(positions, filters);
  const searchSuggestions: PositionSuggestion[] = deptDateFiltered
    .filter((p) => p.position_id || p.position_title)
    .map((p) => ({ position_id: p.position_id, position_title: p.position_title }));

  const filteredPositions = filterPositionsBySearch(deptDateFiltered, filters.search);
  const filteredIds = new Set(
    filteredPositions.map((p) => p.position_id).filter((id): id is string => !!id)
  );
  const scoped = hasActiveDashboardFilters(filters);

  const scopedFeedback = scoped
    ? feedback.filter((c) => c.position_id !== null && filteredIds.has(c.position_id))
    : feedback;
  const scopedJoiners = scoped
    ? joiners.filter((j) => j.position_id !== null && filteredIds.has(j.position_id))
    : joiners;

  const open = filteredPositions.filter((p) => p.open_closed === "Open");
  const closed = filteredPositions.filter((p) => p.open_closed === "Closed");

  const bySeniority = new Map<string, { sum: number; count: number }>();
  for (const p of closed) {
    if (!p.seniority || !p.date_closed || !p.role_assigned_on) continue;
    const entry = bySeniority.get(p.seniority) ?? { sum: 0, count: 0 };
    entry.sum += daysBetween(p.role_assigned_on, p.date_closed);
    entry.count += 1;
    bySeniority.set(p.seniority, entry);
  }
  // Seniority values aren't a fixed enum (the sheet has used "Junior/Mid/
  // Senior" and, later, "L1".."L7" — possibly other labels in future), so
  // the list of rows is whatever's actually present, sorted naturally by
  // any embedded number (L1, L2, ... L10) and alphabetically otherwise.
  const allSeniorities = Array.from(
    new Set(filteredPositions.map((p) => p.seniority).filter((s): s is string => !!s))
  ).sort((a, b) => {
    const na = a.match(/(\d+)/)?.[1];
    const nb = b.match(/(\d+)/)?.[1];
    if (na && nb) return parseInt(na, 10) - parseInt(nb, 10);
    return a.localeCompare(b);
  });
  const avgTimeToFillBySeniority: SeniorityTimeToFill[] = allSeniorities.map((seniority) => {
    const entry = bySeniority.get(seniority);
    return {
      seniority,
      avgDays: entry && entry.count > 0 ? Math.round(entry.sum / entry.count) : null,
      sampleSize: entry?.count ?? 0,
    };
  });

  const joinersWithStatus = scopedJoiners.filter((j) => j.status);
  const acceptedJoiners = joinersWithStatus.filter((j) => j.status !== "Drop");

  // The tracker and the Created/Open/Closed cards share one universe: every
  // position matching department + search, deliberately NOT narrowed by the
  // assigned-date range (carried-forward positions were created before it).
  // The range only decides which open positions count as new vs earlier.
  const cohortUniverse = filterPositionsBySearch(
    filterPositionsByDeptAndDate(positions, { department: filters.department }),
    filters.search
  );
  const cohortPeriod = resolveCohortPeriod(
    filters,
    todayIso(),
    periodStats(cohortUniverse).earliestAssigned
  );
  const openPositionsDetail = computeOpenPositionsOverview(
    cohortUniverse,
    feedback,
    joiners,
    cohortPeriod
  );

  // A cohort link from the headline cards lists exactly those positions: the
  // same department/search universe the cards count, split by creation date
  // relative to the period.
  const inCohort = (p: PositionRow) => {
    const assigned = p.role_assigned_on;
    if (assigned && assigned > cohortPeriod.end) return false;
    const isNew = !!assigned && assigned >= cohortPeriod.start;
    return filters.cohort === "new" ? isNew : !isNew;
  };
  // Open / Closed cards count open-at-period-end and closed-in-period, so their
  // links list the same; the Created card ("all") lists by status right now.
  const byCards = filters.status !== "all";
  const listOpen = filters.cohort
    ? cohortUniverse.filter(
        (p) => (byCards ? isOpenAtPeriodEnd(p, cohortPeriod) : p.open_closed === "Open") && inCohort(p)
      )
    : open;
  const listClosed = filters.cohort
    ? cohortUniverse.filter(
        (p) => (byCards ? isClosedByPeriodEnd(p, cohortPeriod) : p.open_closed === "Closed") && inCohort(p)
      )
    : closed;

  const byAgeDesc = (a: PositionWithSla, b: PositionWithSla) =>
    (b.aging_days ?? -1) - (a.aging_days ?? -1);
  // Spotlight card: always the oldest open position under the normal filters,
  // regardless of any cohort link.
  const oldestOpenPosition = computePositionsWithSla(open).sort(byAgeDesc)[0] ?? null;
  const isOpenOrClosed = (p: PositionRow) => p.open_closed === "Open" || p.open_closed === "Closed";
  const listOther = filters.cohort
    ? cohortUniverse.filter((p) => !isOpenOrClosed(p) && inCohort(p))
    : filteredPositions.filter((p) => !isOpenOrClosed(p));
  const openWithSla = computePositionsWithSla(listOpen).sort(byAgeDesc);
  const closedWithSla = computePositionsWithSla(listClosed).sort((a, b) =>
    (b.date_closed ?? "").localeCompare(a.date_closed ?? "")
  );
  const status = filters.status ?? "open";
  const listedPositions =
    status === "closed"
      ? closedWithSla
      : status === "all"
        ? [...openWithSla, ...closedWithSla, ...computePositionsWithSla(listOther)]
        : openWithSla;

  const today = todayIso();
  const currentYear = today.slice(0, 4);
  const currentMonth = today.slice(0, 7);
  const ytdPositions = filteredPositions.filter(
    (p) => p.role_assigned_on && p.role_assigned_on.slice(0, 4) === currentYear
  );
  const mtdPositions = filteredPositions.filter(
    (p) => p.role_assigned_on && p.role_assigned_on.slice(0, 7) === currentMonth
  );

  // All-time, unfiltered by design — reuses the full (unfiltered) positions/
  // feedback arrays passed into this function, not filteredPositions.
  const rejections = computeRejectionsByPosition(positions, feedback);
  const mostRejectedPositions = {
    rows: rejections.byPosition.slice(0, 10),
    unlinkedCount: rejections.unlinkedCount,
  };

  return {
    positions: listedPositions,
    oldestOpenPosition,
    cohorts: computeCohortStats(cohortUniverse, cohortPeriod),
    allTime: periodStats(filteredPositions),
    ytd: periodStats(ytdPositions),
    mtd: periodStats(mtdPositions),
    totalInPipeline: open.reduce((sum, p) => sum + (p.pipeline_count ?? 0), 0),
    totalInterviewed: computeInterviewedSince(scopedFeedback, null),
    interviewedLast7Days: computeInterviewedSince(scopedFeedback, 7),
    totalRejected: scopedFeedback.filter((c) => c.outcome === "Rejected").length,
    interviewsByDayLast7Days: computeInterviewsByDayLast7Days(scopedFeedback),
    departments,
    avgTimeToFillBySeniority,
    offerAcceptanceRate:
      joinersWithStatus.length > 0 ? acceptedJoiners.length / joinersWithStatus.length : null,
    offerAcceptanceSampleSize: joinersWithStatus.length,
    interviewsPerHireBySource: computeInterviewsPerHireBySource(scopedFeedback, scopedJoiners),
    interviewSourceDataAvailable: scopedFeedback.some((c) => !!c.source),
    searchSuggestions,
    mostRejectedPositions,
    openPositionsDetail,
  };
}

export function getDashboardOverview(filters: DashboardFilters): DashboardOverview {
  return computeDashboardOverview(
    getRawPositions(),
    getRawCandidateFeedback(),
    getRawUpcomingJoiners(),
    filters
  );
}

// --- Open-positions tracker (per-position pipeline + stage breakdown) -----

/** Departments whose sheet name starts with "Branch" — the "Branch sales"
 *  vs "Other departments" split is derived from this real field, not a
 *  separate flag anywhere in the sheet. */
export function isBranchDepartment(department: string | null): boolean {
  return !!department && department.toLowerCase().startsWith("branch");
}

export interface PositionStageCounts {
  sourced: number;
  interviewed: number;
  selected: number;
  yetToJoin: number;
  joined: number;
  rejected: number;
}

/** Someone who has accepted an offer and has not started yet. */
export interface PendingJoiner {
  name: string;
  doj: string | null;
  source: string | null;
  recruiter: string | null;
}

export interface OpenPositionRow {
  id: string;
  position_id: string | null;
  position_title: string | null;
  department: string | null;
  state: string | null;
  isBranch: boolean;
  /** Created inside the active period (this month, or the selected date
   *  range) as opposed to carried forward from before it. */
  isNewInPeriod: boolean;
  assigned_ta: string | null;
  /** How many people the position needs (the sheet's "Position Open" column). */
  requirements: number | null;
  /** Self-reported from the sheet's own "Pipeline" column. */
  pipelineCount: number | null;
  sourced: number;
  interviewed: number;
  interviewedLast7Days: number;
  /** Days since role_assigned_on; null if that date is missing. */
  agingDays: number | null;
  stages: PositionStageCounts;
  /** The sheet's own comment on the position (often says who is joining and when). */
  comments: string | null;
  /** The people yet to join this position, soonest first. */
  joiners: PendingJoiner[];
  /** Everyone needed is either already in or yet to join. */
  fullyCovered: boolean;
}

export function computeOpenPositionsOverview(
  positions: PositionRow[],
  feedback: CandidateFeedbackRow[],
  joiners: UpcomingJoinerRow[],
  /** Defaults to the current month. Positions created after `end` are left
   *  out, to match the Created/Open/Closed cards. */
  period?: Pick<CohortPeriod, "start" | "end">
): OpenPositionRow[] {
  const today = todayIso();
  const { start, end } = period ?? { start: `${today.slice(0, 7)}-01`, end: today };

  return positions
    .filter((p) => p.open_closed === "Open")
    .filter((p) => !(p.role_assigned_on && p.role_assigned_on > end))
    .map((p) => {
      const pid = p.position_id;
      const posFeedback = pid ? feedback.filter((c) => c.position_id === pid) : [];
      const posJoiners = pid ? joiners.filter((j) => j.position_id === pid) : [];

      const sourcedNames = new Set(
        posFeedback.map((c) => c.candidate_name).filter((n): n is string => !!n)
      );
      const interviewedNames = new Set(
        posFeedback
          .filter((c) => c.interview_round)
          .map((c) => c.candidate_name)
          .filter((n): n is string => !!n)
      );
      const selectedNames = new Set(
        posFeedback
          .filter((c) => c.outcome === "Selected")
          .map((c) => c.candidate_name)
          .filter((n): n is string => !!n)
      );
      const rejectedNames = new Set(
        posFeedback
          .filter((c) => c.outcome === "Rejected")
          .map((c) => c.candidate_name)
          .filter((n): n is string => !!n)
      );
      const yetToJoinNames = new Set(
        posJoiners
          .filter((j) => isYetToJoinStatus(j.status))
          .map((j) => j.candidate_name)
          .filter((n): n is string => !!n)
      );
      // The Positions sheet has its own "Yet to join" count. It can be ahead of the
      // joiner tracker (someone has accepted but has not been added there yet), so
      // never show fewer than the sheet says.
      const yetToJoin = Math.max(yetToJoinNames.size, p.yet_to_join_count ?? 0);
      const pendingJoiners: PendingJoiner[] = [];
      const seenJoiners = new Set<string>();
      for (const j of posJoiners) {
        if (!isYetToJoinStatus(j.status) || !j.candidate_name || seenJoiners.has(j.candidate_name)) continue;
        seenJoiners.add(j.candidate_name);
        pendingJoiners.push({ name: j.candidate_name, doj: j.doj, source: j.source, recruiter: j.recruiter });
      }
      pendingJoiners.sort((a, b) => (a.doj ?? "9999").localeCompare(b.doj ?? "9999"));
      const seats = p.position_open_count ?? 0;
      const joinedNames = new Set(
        posJoiners
          .filter((j) => isJoinedStatus(j.status))
          .map((j) => j.candidate_name)
          .filter((n): n is string => !!n)
      );

      const agingDays = p.role_assigned_on ? daysBetween(p.role_assigned_on, today) : null;
      const interviewedLast7Days = pid ? computeInterviewedSinceForPosition(feedback, pid, 7) : 0;

      return {
        id: p.id,
        position_id: p.position_id,
        position_title: p.position_title,
        department: p.department,
        state: p.state,
        isBranch: isBranchDepartment(p.department),
        isNewInPeriod: !!p.role_assigned_on && p.role_assigned_on >= start,
        assigned_ta: p.assigned_ta,
        requirements: p.position_open_count,
        pipelineCount: p.pipeline_count,
        sourced: sourcedNames.size,
        interviewed: interviewedNames.size,
        interviewedLast7Days,
        agingDays,
        stages: {
          sourced: sourcedNames.size,
          interviewed: interviewedNames.size,
          selected: selectedNames.size,
          yetToJoin,
          joined: joinedNames.size,
          rejected: rejectedNames.size,
        },
        comments: p.comments,
        joiners: pendingJoiners,
        fullyCovered: seats > 0 && yetToJoin + joinedNames.size >= seats,
      };
    })
    .sort((a, b) => (b.agingDays ?? -1) - (a.agingDays ?? -1));
}
