// Pure maths for the Report tab (no database or Node imports), so the same
// code runs on demo fixtures, the local SQLite store and Supabase rows.
import type { PositionRow, UpcomingJoinerRow } from "@/lib/supabase/types";

/** One position (one Position ID) as a line of the HO / Branch tracker. */
export interface ReportRow {
  /** Internal row id, for linking to the position's detail page. */
  id: string;
  positionId: string | null;
  title: string | null;
  /** "Role assigned on", ISO date. */
  raised: string | null;
  /** Seats: how many people this requisition is for. */
  seats: number;
  /** Seats already filled (joined or offer accepted and yet to join). */
  filled: number;
  /** Candidates currently in the pipeline (open positions only). */
  pipeline: number;
  status: "open" | "closed";
  closedOn: string | null;
  /** Latest joining date among people hired for this position. */
  latestJoining: string | null;
  joinerCount: number;
}

/** A department (HO) or a branch location (Branch). */
export interface ReportGroup {
  name: string;
  seats: number;
  filled: number;
  pipeline: number;
  rows: ReportRow[];
}

export interface HiringReport {
  ho: ReportGroup[];
  branch: ReportGroup[];
  /** Positions left out because their status is neither Open nor Closed
   *  (e.g. "Position Cancelled"), by status label. */
  excluded: { label: string; count: number }[];
}

export const NO_LOCATION = "Location not set";

export function isBranch(department: string | null): boolean {
  return !!department && department.toLowerCase().startsWith("branch");
}

/** "BM - Hosa Road" -> "Hosa Road"; "BM | ABM - Gandhi Bazar" -> "Gandhi Bazar".
 *  Titles with no "- place" part fall into NO_LOCATION. */
export function branchLocation(title: string | null): string {
  if (!title) return NO_LOCATION;
  const idx = title.lastIndexOf("-");
  if (idx === -1) return NO_LOCATION;
  const place = title.slice(idx + 1).trim();
  return place || NO_LOCATION;
}

const DEPARTMENT_NOT_SET = "Department not set";

export interface ReportOptions {
  /** Only show closed positions that closed within this many days (open
   *  positions are always shown). Closed positions with no closing date are
   *  left out when this is set, since we cannot tell when they closed.
   *  null / omitted = show every closed position. */
  closedWithinDays?: number | null;
  /** "YYYY-MM-DD"; defaults to today. */
  today?: string;
}

function isoDaysBefore(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function computeHiringReport(
  positions: PositionRow[],
  joiners: UpcomingJoinerRow[],
  options: ReportOptions = {}
): HiringReport {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const closedCutoff =
    options.closedWithinDays != null ? isoDaysBefore(today, options.closedWithinDays) : null;

  // People hired per position; "Drop" and "Joined & Left" are not hires.
  const joinersByPosition = new Map<string, UpcomingJoinerRow[]>();
  for (const j of joiners) {
    if (!j.position_id) continue;
    const status = (j.status ?? "").toLowerCase();
    if (status === "drop" || status === "joined & left") continue;
    const list = joinersByPosition.get(j.position_id) ?? [];
    list.push(j);
    joinersByPosition.set(j.position_id, list);
  }

  const ho = new Map<string, ReportGroup>();
  const branch = new Map<string, ReportGroup>();
  const excluded = new Map<string, number>();

  for (const p of positions) {
    const state = p.open_closed;
    if (state !== "Open" && state !== "Closed") {
      const label = state?.trim() || "No status";
      excluded.set(label, (excluded.get(label) ?? 0) + 1);
      continue;
    }

    const closed = state === "Closed";
    if (closed && closedCutoff !== null && !(p.date_closed && p.date_closed >= closedCutoff)) continue;

    const seats = Math.max(1, p.position_open_count ?? 1);
    // An open position can already be partly filled: people who joined, or
    // accepted and are yet to join, each take a seat.
    const filled = closed ? seats : Math.min(seats, (p.joined_count ?? 0) + (p.yet_to_join_count ?? 0));
    const pipeline = closed ? 0 : p.pipeline_count ?? 0;

    const hires = p.position_id ? joinersByPosition.get(p.position_id) ?? [] : [];
    const dojs = hires.map((h) => h.doj).filter((d): d is string => !!d).sort();

    const row: ReportRow = {
      id: p.id,
      positionId: p.position_id,
      title: p.position_title,
      raised: p.role_assigned_on,
      seats,
      filled,
      pipeline,
      status: closed ? "closed" : "open",
      closedOn: p.date_closed,
      latestJoining: dojs.length > 0 ? dojs[dojs.length - 1] : null,
      joinerCount: hires.length,
    };

    const target = isBranch(p.department) ? branch : ho;
    const name = isBranch(p.department)
      ? branchLocation(p.position_title)
      : p.department?.trim() || DEPARTMENT_NOT_SET;
    const group = target.get(name) ?? { name, seats: 0, filled: 0, pipeline: 0, rows: [] };
    group.seats += seats;
    group.filled += filled;
    group.pipeline += pipeline;
    group.rows.push(row);
    target.set(name, group);
  }

  // Most complete first (like a leaderboard), then bigger groups, then by name.
  const order = (a: ReportGroup, b: ReportGroup) =>
    b.filled / b.seats - a.filled / a.seats || b.seats - a.seats || a.name.localeCompare(b.name);

  return {
    ho: Array.from(ho.values()).sort(order),
    branch: Array.from(branch.values()).sort(order),
    excluded: Array.from(excluded, ([label, count]) => ({ label, count })),
  };
}
