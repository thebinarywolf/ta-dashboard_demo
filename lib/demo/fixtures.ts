// Realistic-shaped sample data for local preview only, loosely modeled on
// the real sheet's column values and vocabulary (departments, TAs, sources,
// priorities) without using any real candidate data. Shaped exactly like
// the Postgres views in supabase/migrations/0003_metrics_views.sql so
// lib/metrics/*.ts can return this directly in demo mode.
import type {
  CandidateFeedbackRow,
  DropoutFlaggedRow,
  EmployeeRow,
  ExitEmployeeRow,
  FunnelRow,
  PipelineByPosition,
  PositionWithSla,
  RecruiterPerformanceRow,
  SourceConversionRow,
  UpcomingJoinerRow,
} from "@/lib/supabase/types";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const SLA_DAYS = { Senior: 90, Mid: 60, Junior: 30 } as const;

function position(
  overrides: Partial<PositionWithSla> & {
    seniority: "Junior" | "Mid" | "Senior";
    agingDays: number;
    openClosed?: string;
  }
): PositionWithSla {
  const sla = SLA_DAYS[overrides.seniority];
  const openClosed = overrides.openClosed ?? "Open";
  return {
    id: `pos-${overrides.position_id ?? Math.random()}`,
    position_id: null,
    open_closed: openClosed,
    assigned_ta: null,
    closed_by_ta: null,
    date_closed: null,
    role_assigned_on: daysAgo(overrides.agingDays),
    date_per_qandle: daysAgo(overrides.agingDays),
    ho_branch: null,
    state: null,
    department: null,
    position_title: null,
    level: null,
    new_or_replacement: null,
    share_with_partners: null,
    priority: null,
    position_aging_days_sheet: overrides.agingDays,
    position_open_count: 1,
    pipeline_count: null,
    yet_to_join_count: null,
    joined_count: null,
    comments: null,
    synced_at: new Date().toISOString(),
    sla_days: sla,
    aging_days: openClosed === "Open" ? overrides.agingDays : null,
    sla_breached: openClosed === "Open" && overrides.agingDays > sla,
    ...overrides,
  };
}

export const demoPositions: PositionWithSla[] = [
  position({
    position_id: "JOB420",
    position_title: "BM/ABM - Raichur",
    department: "Sales",
    ho_branch: "Branch",
    state: "KA",
    seniority: "Junior",
    priority: "P1",
    assigned_ta: "Ananya",
    agingDays: 18,
    position_open_count: 1,
    pipeline_count: 6,
  }),
  position({
    position_id: "JOB292",
    position_title: "Accounts Payable - Team Lead",
    department: "Finance",
    ho_branch: "HO",
    state: "KA",
    seniority: "Mid",
    priority: "P0",
    assigned_ta: "Rohan",
    agingDays: 71,
    position_open_count: 2,
    pipeline_count: 9,
  }),
  position({
    position_id: "JOB999",
    position_title: "Head of Admin",
    department: "Admin",
    ho_branch: "HO",
    state: "KA",
    seniority: "Senior",
    priority: "P2",
    assigned_ta: "Kavya",
    agingDays: 112,
  }),
  position({
    position_id: "JOB385",
    position_title: "Marketing Associate",
    department: "Marketing",
    ho_branch: "HO",
    state: "KA",
    seniority: "Junior",
    priority: "P1",
    assigned_ta: "Arjun",
    agingDays: 9,
  }),
  position({
    position_id: "JOB123",
    position_title: "Gold Processing Manager",
    department: "Gold Processing",
    ho_branch: "HO",
    state: "KA",
    seniority: "Mid",
    priority: "P0",
    assigned_ta: "Kavya",
    agingDays: 64,
  }),
  position({
    position_id: "JOB310",
    position_title: "Business Development Executive",
    department: "Sales",
    ho_branch: "Branch",
    state: "TS",
    seniority: "Junior",
    priority: "P2",
    assigned_ta: "Ananya",
    agingDays: 27,
  }),
  position({
    position_id: "JOB201",
    position_title: "Retail Operations Manager",
    department: "Retail",
    ho_branch: "HO",
    state: "KA",
    seniority: "Senior",
    priority: "P1",
    assigned_ta: "Meera",
    agingDays: 45,
  }),
  position({
    position_id: "JOB055",
    position_title: "Senior BDE",
    department: "Branch",
    ho_branch: "Branch",
    state: "KA",
    seniority: "Mid",
    priority: "P2",
    assigned_ta: "Meera",
    agingDays: 33,
    openClosed: "Closed",
    date_closed: daysAgo(2),
    closed_by_ta: "Meera",
  }),
];

function feedback(
  overrides: Partial<CandidateFeedbackRow> & {
    positionId: string;
    candidateName: string;
    daysAgo: number;
    outcome: string;
  }
): CandidateFeedbackRow {
  return {
    id: `cf-${overrides.candidateName}-${overrides.positionId}`,
    position_id: overrides.positionId,
    feedback_date: daysAgo(overrides.daysAgo),
    // Credit the interview to whoever the position is assigned to.
    recruiter: demoPositions.find((p) => p.position_id === overrides.positionId)?.assigned_ta ?? null,
    candidate_name: overrides.candidateName,
    source: null,
    position_applied_for: null,
    dept_location: null,
    interview_round: "Round 1",
    interviewer: null,
    feedback: demoStandardFeedback(overrides.outcome, overrides.reason),
    reason: null,
    synced_at: new Date().toISOString(),
    ...overrides,
  };
}

// Demo stand-in for the sheet's standard "Feedback" column, derived from the
// outcome and the free-text reason so the sample data shows both fields.
function demoStandardFeedback(outcome: string, reason?: string | null): string | null {
  if (outcome === "Selected") return "Selected";
  if (!reason) return null;
  if (/salary|compensation/i.test(reason)) return "Compensation";
  if (/experience|skills|excel|reconciliation/i.test(reason)) return "Technical skills";
  return null;
}

// Interview-level detail for the position detail page's "interview history" /
// "rejection reasons" sections and the listing page's "interviewed in last 7
// days" / "most rejected positions" stats. Only a handful of positions have
// entries here (matching demoPositions above) — that's deliberate, mirrors
// how not every real position has interview activity yet.
export const demoCandidateFeedback: CandidateFeedbackRow[] = [
  feedback({ positionId: "JOB420", candidateName: "Arjun Rao", daysAgo: 2, interview_round: "Round 1", interviewer: "Ananya", outcome: "Selected", source: "Naukri" }),
  feedback({ positionId: "JOB420", candidateName: "Divya Shetty", daysAgo: 4, interview_round: "Round 1", interviewer: "Ananya", outcome: "Rejected", reason: "Insufficient sales experience", source: "Naukri" }),
  feedback({ positionId: "JOB420", candidateName: "Farhan Ali", daysAgo: 15, interview_round: "Round 2", interviewer: "Ananya", outcome: "Rejected", reason: "Salary expectation mismatch", source: "Workindia" }),
  feedback({ positionId: "JOB292", candidateName: "Kavya Nair", daysAgo: 1, interview_round: "Round 2", interviewer: "Rohan", outcome: "On Hold", reason: "Awaiting second round feedback", source: "Naukri" }),
  feedback({ positionId: "JOB292", candidateName: "Rohit Menon", daysAgo: 3, interview_round: "Round 1", interviewer: "Rohan", outcome: "Rejected", reason: "Salary expectation mismatch", source: "Naukri" }),
  feedback({ positionId: "JOB292", candidateName: "Sneha Kulkarni", daysAgo: 6, interview_round: "Round 1", interviewer: "Rohan", outcome: "Rejected", reason: "Weak Excel/reconciliation skills", source: "Agency" }),
  feedback({ positionId: "JOB292", candidateName: "Vikram Iyer", daysAgo: 20, interview_round: "Round 1", interviewer: "Rohan", outcome: "Rejected", reason: "Salary expectation mismatch", source: "Naukri" }),
  feedback({ positionId: "JOB999", candidateName: "Ananya Desai", daysAgo: 5, interview_round: "Round 1", interviewer: "Kavya", outcome: "Selected", source: "Employee references" }),
  feedback({ positionId: "JOB999", candidateName: "Manoj Pillai", daysAgo: 30, interview_round: "Round 1", interviewer: "Kavya", outcome: "Rejected", reason: "Not enough team management experience", source: "Naukri" }),
  feedback({ positionId: "JOB123", candidateName: "Priya Bhat", daysAgo: 2, interview_round: "Round 1", interviewer: null, outcome: "Rejected", reason: "Salary expectation mismatch", source: "Naukri" }),
  feedback({ positionId: "JOB123", candidateName: "Suresh Gowda", daysAgo: 10, interview_round: "Round 2", interviewer: "Kavya", outcome: "Selected", source: "Employee references" }),
  feedback({ positionId: "JOB310", candidateName: "Nikhil Reddy", daysAgo: 1, interview_round: "Round 1", interviewer: "Ananya", outcome: "Selected", source: "Workindia" }),
  feedback({ positionId: "JOB310", candidateName: "Pooja Hegde", daysAgo: 3, interview_round: "Round 1", interviewer: "Ananya", outcome: "Rejected", reason: "", source: "Workindia" }),
];

function joiner(overrides: {
  positionId: string;
  candidateName: string;
  source: string;
  status: string;
  applicationDaysAgo: number;
  dojDaysAgo: number | null;
}): UpcomingJoinerRow {
  return {
    id: `uj-${overrides.candidateName}-${overrides.positionId}`,
    position_id: overrides.positionId,
    source: overrides.source,
    referral_name: null,
    recruiter: null,
    candidate_name: overrides.candidateName,
    department: null,
    location: null,
    designation: null,
    application_date: daysAgo(overrides.applicationDaysAgo),
    doj: overrides.dojDaysAgo !== null ? daysAgo(overrides.dojDaysAgo) : null,
    status: overrides.status,
    synced_at: new Date().toISOString(),
  };
}

// "Joined" = accepted-and-onboarded, "Drop" = accepted then backed out before
// joining — used for offer-acceptance-rate and interviews-per-hire-by-source.
export const demoUpcomingJoiners: UpcomingJoinerRow[] = [
  joiner({ positionId: "JOB420", candidateName: "Arjun Rao", source: "Naukri", status: "Joined", applicationDaysAgo: 25, dojDaysAgo: 1 }),
  joiner({ positionId: "JOB292", candidateName: "Rohit Menon", source: "Naukri", status: "Yet to Join", applicationDaysAgo: 18, dojDaysAgo: -5 }),
  joiner({ positionId: "JOB999", candidateName: "Ananya Desai", source: "Employee references", status: "Joined", applicationDaysAgo: 30, dojDaysAgo: 3 }),
  joiner({ positionId: "JOB123", candidateName: "Suresh Gowda", source: "Employee references", status: "Drop", applicationDaysAgo: 20, dojDaysAgo: null }),
  joiner({ positionId: "JOB310", candidateName: "Nikhil Reddy", source: "Workindia", status: "Joined", applicationDaysAgo: 15, dojDaysAgo: 2 }),
  joiner({ positionId: "JOB055", candidateName: "Kiran Shetty", source: "Naukri", status: "Joined", applicationDaysAgo: 40, dojDaysAgo: 5 }),
];

export const demoPipelines: PipelineByPosition[] = [
  { position_pk: "pos-JOB420", position_id: "JOB420", sourced_count: 14, interviewed_count: 8, selected_count: 2, yet_to_join_count: 1, joined_count: 0 },
  { position_pk: "pos-JOB292", position_id: "JOB292", sourced_count: 22, interviewed_count: 11, selected_count: 3, yet_to_join_count: 0, joined_count: 1 },
  { position_pk: "pos-JOB999", position_id: "JOB999", sourced_count: 9, interviewed_count: 4, selected_count: 1, yet_to_join_count: 0, joined_count: 0 },
  { position_pk: "pos-JOB385", position_id: "JOB385", sourced_count: 17, interviewed_count: 6, selected_count: 2, yet_to_join_count: 1, joined_count: 0 },
  { position_pk: "pos-JOB123", position_id: "JOB123", sourced_count: 12, interviewed_count: 5, selected_count: 1, yet_to_join_count: 0, joined_count: 1 },
  { position_pk: "pos-JOB310", position_id: "JOB310", sourced_count: 19, interviewed_count: 10, selected_count: 4, yet_to_join_count: 2, joined_count: 1 },
  { position_pk: "pos-JOB201", position_id: "JOB201", sourced_count: 15, interviewed_count: 7, selected_count: 2, yet_to_join_count: 0, joined_count: 0 },
  { position_pk: "pos-JOB055", position_id: "JOB055", sourced_count: 20, interviewed_count: 9, selected_count: 3, yet_to_join_count: 0, joined_count: 2 },
];

export const demoFunnelOverall: FunnelRow = {
  sourced: 128,
  interviewed: 60,
  selected: 18,
  offer_accepted: 13,
  joined: 5,
};

export const demoFunnelByDepartment: FunnelRow[] = [
  { department: "Sales", sourced: 33, interviewed: 18, selected: 6, offer_accepted: 4, joined: 1 },
  { department: "Finance", sourced: 22, interviewed: 11, selected: 3, offer_accepted: 2, joined: 1 },
  { department: "Admin", sourced: 9, interviewed: 4, selected: 1, offer_accepted: 1, joined: 0 },
  { department: "Marketing", sourced: 17, interviewed: 6, selected: 2, offer_accepted: 1, joined: 0 },
  { department: "Gold Processing", sourced: 12, interviewed: 5, selected: 1, offer_accepted: 1, joined: 1 },
  { department: "Retail", sourced: 15, interviewed: 7, selected: 2, offer_accepted: 1, joined: 0 },
  { department: "Branch", sourced: 20, interviewed: 9, selected: 3, offer_accepted: 3, joined: 2 },
];

export const demoRecruiters: RecruiterPerformanceRow[] = [
  { recruiter: "Ananya", positions_closed: 4, avg_days_to_close: 38, candidates_handled: 33 },
  { recruiter: "Kavya", positions_closed: 3, avg_days_to_close: 52, candidates_handled: 21 },
  { recruiter: "Rohan", positions_closed: 2, avg_days_to_close: 61, candidates_handled: 22 },
  { recruiter: "Arjun", positions_closed: 1, avg_days_to_close: 29, candidates_handled: 17 },
  { recruiter: "Meera", positions_closed: 5, avg_days_to_close: 33, candidates_handled: 35 },
];

function dropout(overrides: {
  candidate: string;
  positionApplied: string;
  positionId: string | null;
  offerDaysAgo: number | null;
  dropDaysAgo: number | null;
  reason: string;
  source: string;
}): DropoutFlaggedRow {
  const offer = overrides.offerDaysAgo !== null ? daysAgo(overrides.offerDaysAgo) : null;
  const drop = overrides.dropDaysAgo !== null ? daysAgo(overrides.dropDaysAgo) : null;
  const gap = offer && drop ? overrides.offerDaysAgo! - overrides.dropDaysAgo! : null;
  return {
    id: `drop-${overrides.candidate}`,
    position_id: overrides.positionId,
    recruiter: null,
    candidate_name: overrides.candidate,
    position_applied: overrides.positionApplied,
    location: null,
    source: overrides.source,
    feedback: null,
    offer_accepted_date: offer,
    expected_doj: null,
    actual_dropout_date: drop,
    days_offer_to_dropout: gap,
    reason: overrides.reason,
    synced_at: new Date().toISOString(),
    unlinked: overrides.positionId === null,
    missing_dates: offer === null || drop === null,
    days_gap: gap,
  };
}

export const demoDropouts: DropoutFlaggedRow[] = [
  dropout({ candidate: "Ashok", positionApplied: "Assistant Branch Manager - Chandanagar", positionId: "JOB252", offerDaysAgo: 20, dropDaysAgo: 17, reason: "Salary", source: "Workindia" }),
  dropout({ candidate: "Shiva", positionApplied: "ABM - Karwar", positionId: "JOB366", offerDaysAgo: 25, dropDaysAgo: 6, reason: "Existing company retained", source: "Workindia" }),
  dropout({ candidate: "Dinesh", positionApplied: "Telesales Executive", positionId: null, offerDaysAgo: null, dropDaysAgo: null, reason: "Health issues", source: "Employee Ref" }),
  dropout({ candidate: "Kavitha", positionApplied: "Gold Processing Manager", positionId: "JOB123", offerDaysAgo: 15, dropDaysAgo: 14, reason: "Higher salary expectation elsewhere", source: "Naukri" }),
  dropout({ candidate: "Ramesh", positionApplied: "Senior BDE", positionId: "JOB055", offerDaysAgo: 30, dropDaysAgo: 2, reason: "Could not join within the given timeline", source: "Naukri" }),
];

export const demoSourceConversion: SourceConversionRow[] = [
  { source: "Naukri", total_candidates: 48, joined_candidates: 2 },
  { source: "Workindia", total_candidates: 31, joined_candidates: 1 },
  { source: "Employee references", total_candidates: 27, joined_candidates: 2 },
  { source: "Agency", total_candidates: 22, joined_candidates: 0 },
];

// Sample workforce for the Attrition tab in demo mode (seeded, so the
// numbers are stable between reloads). Shaped like the Qandle fields the
// connector keeps; entirely made up.
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function buildDemoEmployees(): EmployeeRow[] {
  const rand = seededRandom(7);
  const pick = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)];
  const departments = ["Branch Sales", "Branch Sales", "Branch Sales", "Branch Sales", "Sales", "Finance", "Admin", "IT", "HR", "Retail", "Marketing", "Gold Processing"];
  const rows: EmployeeRow[] = [];

  for (let i = 0; i < 90; i++) {
    const joinedDaysAgo = 20 + Math.floor(rand() * 2400);
    const age = 21 + Math.floor(rand() * 36);
    const left = rand() < 0.22 && joinedDaysAgo > 40;
    let relievingDaysAgo: number | null = null;
    if (left) {
      const infant = rand() < 0.35;
      const tenure = infant ? 10 + Math.floor(rand() * 75) : 90 + Math.floor(rand() * 900);
      relievingDaysAgo = Math.max(1, joinedDaysAgo - Math.min(tenure, joinedDaysAgo - 1));
      if (relievingDaysAgo > 420) relievingDaysAgo = 20 + Math.floor(rand() * 380);
    }
    const joined = daysAgo(joinedDaysAgo);
    const relieving = relievingDaysAgo !== null ? daysAgo(relievingDaysAgo) : null;
    rows.push({
      id: `emp-${i}`,
      // Every 15th demo person is an intern (WG-INT-…), the rest are Company employees (WG…).
      full_name: `Demo Person ${i + 1}`,
      employee_code: i % 15 === 0 ? `WG-INT-${String(i + 1).padStart(4, "0")}` : `WG${String(i + 1).padStart(5, "0")}`,
      department: i % 41 === 0 ? null : pick(departments),
      // Qandle locations start with a state code, e.g. "KA-KORAMANGALA".
      location: pick(["KA-KORAMANGALA", "KA-HASSAN", "KL-VARKALA", "AP-VIJAYAWADA", "TS-HYDERABAD"]),
      designation: null,
      date_of_joining: relieving && relieving < joined ? relieving : joined,
      date_of_birth: i % 37 === 0 ? null : daysAgo(age * 365 + Math.floor(rand() * 300)),
      relieving_date: relieving,
      employee_status: relieving ? "Relieved" : "Confirmed",
      synced_at: new Date().toISOString(),
    });
  }
  return rows;
}

export const demoEmployees: EmployeeRow[] = buildDemoEmployees();

// Sample exit-sheet rows for most of the demo leavers (a few are left without
// one, like real data), so the Attrition analysis has reasons to show.
function buildDemoExitEmployees(): ExitEmployeeRow[] {
  const rand = seededRandom(21);
  const reasons: [string, string][] = [
    ["Better opportunity", "Moved to a bigger company with a higher role"],
    ["Better opportunity", "Got an offer with a better salary"],
    ["Performance Issue", "Did not meet targets for three months"],
    ["Family issue", "Had to relocate for family reasons"],
    ["Personal Health", "Long-term health problem"],
    ["Work Environment", "Not comfortable with the team culture"],
    ["Compensation", "Salary lower than expected"],
    ["Absconded", "Stopped coming to work without notice"],
    ["Asked to Leave", "Policy breach"],
  ];
  const rows: ExitEmployeeRow[] = [];
  demoEmployees.forEach((e, i) => {
    if (!e.relieving_date || !e.employee_code || rand() < 0.2) return;
    const [reason, detail] = reasons[Math.floor(rand() * reasons.length)];
    rows.push({
      id: `exit-${i}`,
      emp_code: e.employee_code,
      emp_name: `Demo Person ${i + 1}`,
      department: e.department,
      designation: e.designation ?? "Executive",
      location_type: i % 3 === 0 ? "HO" : "Branch",
      category: i % 3 === 0 ? "HO" : "Branch",
      branch_name: e.location,
      state: "Karnataka",
      reporting_manager: "Demo Manager",
      date_of_joining: e.date_of_joining,
      resignation_date: null,
      exit_date: e.relieving_date,
      actual_reason: reason,
      reason_detail: detail,
      regrettable: rand() < 0.15 ? "Regrettable" : "Non-regrettable",
      talent: null,
      voluntary: rand() < 0.3 ? (rand() < 0.5 ? "Voluntary" : "Involuntary") : null,
      synced_at: new Date().toISOString(),
    });
  });
  return rows;
}

export const demoExitEmployees: ExitEmployeeRow[] = buildDemoExitEmployees();
