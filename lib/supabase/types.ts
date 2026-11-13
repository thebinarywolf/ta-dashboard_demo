// Hand-written to match supabase/migrations/*.sql. If you regenerate this
// with `supabase gen types typescript`, keep the shape compatible with the
// hand-picked fields lib/metrics/*.ts and lib/connectors/* rely on.
//
// NOTE: these must be `type` aliases, not `interface`s — the Supabase
// client checks Row/Insert/Update against `Record<string, unknown>`, and
// only object-literal type aliases get the implicit index signature that
// makes that assignable (interfaces don't), or every query resolves to
// `never`.

export type UserRole = "pending" | "viewer" | "pro_viewer" | "recruiter" | "admin";
export type UserStatus = "pending" | "approved" | "revoked";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  status: UserStatus;
  requested_at: string;
  approved_at: string | null;
  approved_by: string | null;
};

export type PositionRow = {
  id: string;
  position_id: string | null;
  open_closed: string | null;
  assigned_ta: string | null;
  closed_by_ta: string | null;
  date_closed: string | null;
  role_assigned_on: string | null;
  date_per_qandle: string | null;
  ho_branch: string | null;
  state: string | null;
  department: string | null;
  position_title: string | null;
  level: string | null;
  new_or_replacement: string | null;
  share_with_partners: boolean | null;
  // Free text, not a fixed enum — the sheet has used "Junior/Mid/Senior" and,
  // later, "L1".."L7" — whatever's actually in the Seniority column.
  seniority: string | null;
  priority: string | null;
  position_aging_days_sheet: number | null;
  position_open_count: number | null;
  pipeline_count: number | null;
  yet_to_join_count: number | null;
  joined_count: number | null;
  comments: string | null;
  synced_at: string;
};

export type CandidateFeedbackRow = {
  id: string;
  position_id: string | null;
  feedback_date: string | null;
  recruiter: string | null;
  candidate_name: string | null;
  source: string | null;
  position_applied_for: string | null;
  dept_location: string | null;
  interview_round: string | null;
  interviewer: string | null;
  outcome: string | null;
  feedback: string | null;
  reason: string | null;
  synced_at: string;
};

export type UpcomingJoinerRow = {
  id: string;
  position_id: string | null;
  source: string | null;
  referral_name: string | null;
  recruiter: string | null;
  candidate_name: string | null;
  department: string | null;
  location: string | null;
  designation: string | null;
  application_date: string | null;
  doj: string | null;
  status: string | null;
  synced_at: string;
};

export type DropOutRow = {
  id: string;
  position_id: string | null;
  recruiter: string | null;
  candidate_name: string | null;
  position_applied: string | null;
  location: string | null;
  source: string | null;
  feedback: string | null;
  offer_accepted_date: string | null;
  expected_doj: string | null;
  actual_dropout_date: string | null;
  days_offer_to_dropout: number | null;
  reason: string | null;
  synced_at: string;
};

// From Qandle HRMS. Deliberately only the fields attrition needs: the API
// also returns names, phone numbers, emails, addresses and PAN numbers, and
// none of that is stored here.
export type EmployeeRow = {
  id: string;
  employee_code: string | null;
  /** First + middle + last name from Qandle. */
  full_name: string | null;
  department: string | null;
  location: string | null;
  designation: string | null;
  date_of_joining: string | null;
  date_of_birth: string | null;
  relieving_date: string | null;
  employee_status: string | null;
  synced_at: string;
};

/** One person who left, from the HR exits sheet. Joined to Qandle employees by
 *  emp_code (= employee_code). */
export type ExitEmployeeRow = {
  id: string;
  emp_code: string;
  emp_name: string | null;
  department: string | null;
  designation: string | null;
  /** "HO" or "Branch". */
  location_type: string | null;
  category: string | null;
  branch_name: string | null;
  state: string | null;
  reporting_manager: string | null;
  date_of_joining: string | null;
  resignation_date: string | null;
  exit_date: string | null;
  /** The standard reason, e.g. "Better opportunity". */
  actual_reason: string | null;
  /** The free-text detail behind that reason. */
  reason_detail: string | null;
  regrettable: string | null;
  talent: string | null;
  voluntary: string | null;
  synced_at: string;
};

export type SyncRunRow = {
  id: string;
  source_name: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "error";
  rows_synced: number | null;
  error: string | null;
};

export type PositionWithSla = PositionRow & {
  sla_days: number | null;
  aging_days: number | null;
  sla_breached: boolean;
};

export type PipelineByPosition = {
  position_pk: string;
  position_id: string | null;
  sourced_count: number;
  interviewed_count: number;
  selected_count: number;
  yet_to_join_count: number;
  joined_count: number;
};

export type FunnelRow = {
  department?: string | null;
  sourced: number;
  interviewed: number;
  selected: number;
  offer_accepted: number;
  joined: number;
};

export type RecruiterPerformanceRow = {
  recruiter: string;
  positions_closed: number;
  avg_days_to_close: number | null;
  candidates_handled: number;
};

export type DropoutFlaggedRow = DropOutRow & {
  unlinked: boolean;
  missing_dates: boolean;
  days_gap: number | null;
};

export type SourceConversionRow = {
  source: string | null;
  total_candidates: number;
  joined_candidates: number;
};

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type View<Row> = {
  Row: Row;
  Relationships: [];
};

export type RoleTabPermissionRow = {
  role: "viewer" | "pro_viewer" | "recruiter";
  tab_key: string;
};

export type HotPositionRow = {
  position_id: string;
  marked_by: string | null;
  marked_at: string;
};
export type AutoSyncRow = {
  id: number;
  enabled: boolean;
  every_hours: number;
  token: string;
  updated_by: string | null;
  updated_at: string;
  last_auto_run_at: string | null;
  last_auto_status: string | null;
  last_auto_message: string | null;
};


export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      positions: Table<PositionRow>;
      candidate_feedback: Table<CandidateFeedbackRow>;
      upcoming_joiners: Table<UpcomingJoinerRow>;
      drop_outs: Table<DropOutRow>;
      employees: Table<EmployeeRow>;
      exit_employees: Table<ExitEmployeeRow>;
      sync_runs: Table<SyncRunRow>;
      role_tab_permissions: Table<RoleTabPermissionRow>;
      hot_positions: Table<HotPositionRow>;
      auto_sync: Table<AutoSyncRow>;
    };
    Views: {
      v_positions_with_sla: View<PositionWithSla>;
      v_pipeline_by_position: View<PipelineByPosition>;
      v_funnel_overall: View<FunnelRow>;
      v_funnel_by_department: View<FunnelRow>;
      v_recruiter_performance: View<RecruiterPerformanceRow>;
      v_dropouts_flagged: View<DropoutFlaggedRow>;
      v_source_conversion: View<SourceConversionRow>;
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
