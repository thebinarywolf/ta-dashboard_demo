import type { SheetRow } from "./client";
import type {
  CandidateFeedbackRow,
  DropOutRow,
  PositionRow,
  UpcomingJoinerRow,
} from "@/lib/supabase/types";

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * The sheet mixes several date spellings in the same column
 * (e.g. "31-Aug-26", "17 Feb 2026", "15-June-26", "8-June-2026").
 * Parses all of them into an ISO "YYYY-MM-DD" string, or null if blank /
 * unparseable (never throws — bad sheet data shouldn't kill the sync).
 */
export function normalizeSheetDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  const match = value.match(/^(\d{1,2})[\s-]+([A-Za-z]+)[\s-]+(\d{2,4})$/);
  if (match) {
    const [, dayStr, monthStr, yearStr] = match;
    const month = MONTHS[monthStr.toLowerCase()];
    if (month === undefined) return null;

    const day = parseInt(dayStr, 10);
    let year = parseInt(yearStr, 10);
    if (yearStr.length === 2) year += 2000;

    const date = new Date(Date.UTC(year, month, day));
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  // Fall back to whatever the JS Date parser can make of it (e.g. ISO-ish
  // strings Google Sheets sometimes returns).
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function str(row: SheetRow, header: string): string | null {
  const value = row[header]?.trim();
  return value ? value : null;
}

function yesNoToBool(raw: string | null): boolean | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === "yes" || v === "y") return true;
  if (v === "no" || v === "n") return false;
  return null;
}

function toInt(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? null : n;
}

// Free text, not a fixed enum. The sheet has used "Junior/Mid/Senior" and,
// later, "L1".."L7" — normalize the old spellings to Title Case for
// consistency, and pass anything else (the current L-levels, or whatever
// comes next) through as-is rather than silently dropping it to null.
function normalizeSeniority(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  if (lower === "junior") return "Junior";
  if (lower === "mid") return "Mid";
  if (lower === "senior") return "Senior";
  return v;
}

export function mapPositionRow(
  row: SheetRow
): Omit<PositionRow, "id" | "synced_at"> {
  return {
    position_id: str(row, "Position ID"),
    open_closed: str(row, "Open/Closed"),
    assigned_ta: str(row, "Assigned TA"),
    closed_by_ta: str(row, "Position actually closed by - TA Name"),
    date_closed: normalizeSheetDate(row["Date - position got closed on"]),
    role_assigned_on: normalizeSheetDate(row["Role assigned on"]),
    date_per_qandle: normalizeSheetDate(row["Date as per Qandle"]),
    ho_branch: str(row, "HO/Branch"),
    state: str(row, "State"),
    department: str(row, "Deptt"),
    position_title: str(row, "Position"),
    level: str(row, "Level"),
    new_or_replacement: str(row, "New/Replacement"),
    share_with_partners: yesNoToBool(str(row, "Share with hiring partners (Y/N)")),
    seniority: normalizeSeniority(str(row, "Seniority")),
    priority: str(row, "Priority"),
    position_aging_days_sheet: toInt(str(row, "Position Aging (Days)")),
    position_open_count: toInt(str(row, "Position Open")),
    pipeline_count: toInt(str(row, "Pipeline")),
    yet_to_join_count: toInt(str(row, "Yet to join")),
    joined_count: toInt(str(row, "Joined")),
    comments: str(row, "Comments"),
  };
}

export function mapCandidateFeedbackRow(
  row: SheetRow
): Omit<CandidateFeedbackRow, "id" | "synced_at"> {
  return {
    position_id: str(row, "Position ID"),
    feedback_date: normalizeSheetDate(row["Date"]),
    recruiter: str(row, "Recruiter"),
    candidate_name: str(row, "Candidate Name"),
    source: str(row, "Source"),
    position_applied_for: str(row, "Position Applied For"),
    dept_location: str(row, "Deptt/Location (in case of Branch Sales)"),
    interview_round: str(row, "Interview Round"),
    interviewer: str(row, "Interviewer"),
    outcome: str(row, "Outcome - Selection / Rejection"),
    feedback: str(row, "Feedback"),
    reason: str(row, "Reason for Selection / Rejection"),
  };
}

export function mapUpcomingJoinerRow(
  row: SheetRow
): Omit<UpcomingJoinerRow, "id" | "synced_at"> {
  const rawStatus = str(row, "Status");
  return {
    position_id: str(row, "Position ID"),
    source: str(row, "Source"),
    referral_name: str(
      row,
      "Referral's name - applicable only in case of employee referral"
    ),
    recruiter: str(row, "Recruiter"),
    candidate_name: str(row, "Candidate name"),
    department: str(row, "Department"),
    location: str(row, "Location"),
    designation: str(row, "Designation"),
    application_date: normalizeSheetDate(row["Application Date"]),
    doj: normalizeSheetDate(row["DOJ"]),
    // Normalize casing so "joined" / "Joined" / "JOINED" all compare equal
    // downstream (the metrics views match with ILIKE 'joined%' regardless).
    status: rawStatus ? rawStatus.trim() : null,
  };
}

export function mapDropOutRow(
  row: SheetRow
): Omit<DropOutRow, "id" | "synced_at"> {
  const offerAccepted = normalizeSheetDate(row["Offer Accepted Date"]);
  const droppedOut = normalizeSheetDate(row["Actual Drop-out Date"]);
  const sheetDaysGap = toInt(str(row, "Days: Offer Accepted to Drop-out"));

  let computedGap: number | null = sheetDaysGap;
  if (offerAccepted && droppedOut) {
    const days = Math.round(
      (new Date(droppedOut).getTime() - new Date(offerAccepted).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (!Number.isNaN(days)) computedGap = days;
  }

  return {
    position_id: str(row, "Position ID"),
    recruiter: str(row, "Recruiter"),
    candidate_name: str(row, "Candidate Name"),
    position_applied: str(row, "Position Applied"),
    location: str(row, "Location"),
    source: str(row, "Source"),
    feedback: str(row, "Feedback"),
    offer_accepted_date: offerAccepted,
    expected_doj: normalizeSheetDate(row["Expected DOJ"]),
    actual_dropout_date: droppedOut,
    days_offer_to_dropout: computedGap,
    reason: str(row, "Reason for Drop-out"),
  };
}
