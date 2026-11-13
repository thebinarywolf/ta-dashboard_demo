-- Core synced-data schema: one table per Google Sheet tab, joined on
-- position_id (see docs/join-keys.md). Rows are written exclusively by the
-- service-role sync job (lib/connectors/google-sheets/sync.ts) — regular
-- users only ever read via RLS-gated SELECT (see 0002_auth_profiles.sql).

create extension if not exists pgcrypto;

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  position_id text,
  open_closed text,
  assigned_ta text,
  closed_by_ta text,
  date_closed date,
  role_assigned_on date,
  date_per_qandle date,
  ho_branch text,
  state text,
  department text,
  position_title text,
  level text,
  new_or_replacement text,
  share_with_partners boolean,
  seniority text check (seniority in ('Junior', 'Mid', 'Senior')),
  priority text,
  position_aging_days_sheet integer,
  position_open_count integer,
  pipeline_count integer,
  yet_to_join_count integer,
  joined_count integer,
  comments text,
  synced_at timestamptz not null default now()
);
create index positions_position_id_idx on public.positions (position_id);

create table public.candidate_feedback (
  id uuid primary key default gen_random_uuid(),
  position_id text,
  feedback_date date,
  recruiter text,
  candidate_name text,
  source text,
  position_applied_for text,
  dept_location text,
  interview_round text,
  interviewer text,
  outcome text,
  feedback text,
  reason text,
  synced_at timestamptz not null default now()
);
create index candidate_feedback_position_id_idx on public.candidate_feedback (position_id);

create table public.upcoming_joiners (
  id uuid primary key default gen_random_uuid(),
  position_id text,
  source text,
  referral_name text,
  recruiter text,
  candidate_name text,
  department text,
  location text,
  designation text,
  application_date date,
  doj date,
  status text,
  synced_at timestamptz not null default now()
);
create index upcoming_joiners_position_id_idx on public.upcoming_joiners (position_id);

create table public.drop_outs (
  id uuid primary key default gen_random_uuid(),
  position_id text,
  recruiter text,
  candidate_name text,
  position_applied text,
  location text,
  source text,
  feedback text,
  offer_accepted_date date,
  expected_doj date,
  actual_dropout_date date,
  days_offer_to_dropout integer,
  reason text,
  synced_at timestamptz not null default now()
);
create index drop_outs_position_id_idx on public.drop_outs (position_id);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  rows_synced integer,
  error text
);
