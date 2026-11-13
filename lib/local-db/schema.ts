// Mirrors supabase/migrations/0001_core_schema.sql's raw tables (SQLite
// dialect — no RLS/profiles here, since auth in this mode is the in-memory
// demo store, not this DB; this file only ever holds synced sheet data).
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  position_id TEXT,
  open_closed TEXT,
  assigned_ta TEXT,
  closed_by_ta TEXT,
  date_closed TEXT,
  role_assigned_on TEXT,
  date_per_qandle TEXT,
  ho_branch TEXT,
  state TEXT,
  department TEXT,
  position_title TEXT,
  level TEXT,
  new_or_replacement TEXT,
  share_with_partners INTEGER,
  seniority TEXT,
  priority TEXT,
  position_aging_days_sheet INTEGER,
  position_open_count INTEGER,
  pipeline_count INTEGER,
  yet_to_join_count INTEGER,
  joined_count INTEGER,
  comments TEXT,
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS positions_position_id_idx ON positions (position_id);

CREATE TABLE IF NOT EXISTS candidate_feedback (
  id TEXT PRIMARY KEY,
  position_id TEXT,
  feedback_date TEXT,
  recruiter TEXT,
  candidate_name TEXT,
  source TEXT,
  position_applied_for TEXT,
  dept_location TEXT,
  interview_round TEXT,
  interviewer TEXT,
  outcome TEXT,
  feedback TEXT,
  reason TEXT,
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS candidate_feedback_position_id_idx ON candidate_feedback (position_id);

CREATE TABLE IF NOT EXISTS upcoming_joiners (
  id TEXT PRIMARY KEY,
  position_id TEXT,
  source TEXT,
  referral_name TEXT,
  recruiter TEXT,
  candidate_name TEXT,
  department TEXT,
  location TEXT,
  designation TEXT,
  application_date TEXT,
  doj TEXT,
  status TEXT,
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS upcoming_joiners_position_id_idx ON upcoming_joiners (position_id);

CREATE TABLE IF NOT EXISTS drop_outs (
  id TEXT PRIMARY KEY,
  position_id TEXT,
  recruiter TEXT,
  candidate_name TEXT,
  position_applied TEXT,
  location TEXT,
  source TEXT,
  feedback TEXT,
  offer_accepted_date TEXT,
  expected_doj TEXT,
  actual_dropout_date TEXT,
  days_offer_to_dropout INTEGER,
  reason TEXT,
  synced_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS drop_outs_position_id_idx ON drop_outs (position_id);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  employee_code TEXT,
  full_name TEXT,
  department TEXT,
  location TEXT,
  designation TEXT,
  date_of_joining TEXT,
  date_of_birth TEXT,
  relieving_date TEXT,
  employee_status TEXT,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exit_employees (
  id TEXT PRIMARY KEY,
  emp_code TEXT NOT NULL,
  emp_name TEXT,
  department TEXT,
  designation TEXT,
  location_type TEXT,
  category TEXT,
  branch_name TEXT,
  state TEXT,
  reporting_manager TEXT,
  date_of_joining TEXT,
  resignation_date TEXT,
  exit_date TEXT,
  actual_reason TEXT,
  reason_detail TEXT,
  regrettable TEXT,
  talent TEXT,
  voluntary TEXT,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hot_positions (
  position_id TEXT PRIMARY KEY,
  marked_by TEXT,
  marked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  rows_synced INTEGER,
  error TEXT
);
`;
