// Made-up data for showcase mode (see lib/showcase/flag.ts).
//
// Fills the same tables a real sync fills, so every tab runs its normal
// calculations on it. Seeded, so the numbers are the same on every start; all
// dates are relative to today, so the dashboard always looks current.
// No real person, candidate, salary or sheet is used anywhere.
import type { DatabaseSync } from "node:sqlite";

// ------------------------------------------------------------------ helpers

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seeded(20261113);
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
/** Pick from [value, weight] pairs. */
function weighted<T>(pairs: readonly (readonly [T, number])[]): T {
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) {
    r -= w;
    if (r <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
}

const DAY = 86_400_000;
const TODAY = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z").getTime();
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(TODAY - n * DAY);
const addDays = (date: string, n: number) => iso(Date.parse(date + "T00:00:00Z") + n * DAY);
const diffDays = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
const todayIso = iso(TODAY);

// ------------------------------------------------------------------ vocabulary

const FIRST = [
  "Aarav", "Aditi", "Akash", "Ananya", "Arjun", "Bhavana", "Chetan", "Deepa", "Divya", "Farhan", "Gautam", "Harini",
  "Ishaan", "Jyothi", "Karthik", "Kavya", "Lakshmi", "Manoj", "Meera", "Naveen", "Nisha", "Pavan", "Pooja", "Prakash",
  "Priya", "Rahul", "Ramya", "Ravi", "Rohan", "Sahana", "Sandeep", "Shreya", "Siddharth", "Sneha", "Suresh", "Swathi",
  "Tanvi", "Tejas", "Uday", "Varun", "Vidya", "Vikram", "Yamini", "Zoya", "Abhishek", "Anil", "Bharath", "Chaitra",
  "Darshan", "Geetha", "Hemanth", "Imran", "Keerthi", "Mohan", "Nandini", "Pallavi", "Rakesh", "Shilpa", "Srinivas", "Usha",
] as const;
const LAST = [
  "Rao", "Reddy", "Kumar", "Shetty", "Nair", "Iyer", "Gowda", "Naidu", "Sharma", "Patil", "Hegde", "Menon",
  "Pillai", "Varma", "Joshi", "Kulkarni", "Desai", "Prasad", "Murthy", "Bhat", "Khan", "Das", "Pai", "Shenoy",
] as const;
let nameCounter = 0;
/** A made-up full name; a counter keeps them distinct. */
function fakeName(): string {
  nameCounter++;
  return `${pick(FIRST)} ${pick(LAST)}`;
}

// Made-up recruiters (TA team).
const TAS = ["Ananya R", "Rohan K", "Kavya S", "Arjun M", "Meera P"] as const;
const TA_WEIGHT: [string, number][] = [["Ananya R", 30], ["Rohan K", 24], ["Kavya S", 20], ["Arjun M", 16], ["Meera P", 10]];
const TA_SPEED: Record<string, number> = { "Ananya R": 0.8, "Rohan K": 1, "Kavya S": 0.9, "Arjun M": 1.25, "Meera P": 1.1 };

const STATES = [["KA", 62], ["AP/TL", 24], ["KL", 8], ["TN", 6]] as const;
const BRANCH_TOWNS: Record<string, string[]> = {
  KA: ["Hassan", "Mysuru", "Tumakuru", "Raichur", "Ballari", "Davanagere", "Shivamogga", "Hubballi", "Mandya", "Kolar"],
  "AP/TL": ["Vijayawada", "Guntur", "Nellore", "Warangal", "Karimnagar", "Eluru", "Kurnool"],
  KL: ["Thrissur", "Kollam", "Palakkad"],
  TN: ["Hosur", "Vellore"],
};
const QANDLE_PREFIX: Record<string, string> = { KA: "KA", "AP/TL": "AP", KL: "KL", TN: "TN" };
const STATE_NAME: Record<string, string> = { KA: "Karnataka", AP: "Andhra Pradesh", TS: "Telangana", KL: "Kerala", TN: "Tamil Nadu" };

type Seniority = "Junior" | "Mid" | "Senior";
const SLA: Record<Seniority, number> = { Junior: 30, Mid: 60, Senior: 90 };

interface RoleSpec {
  dept: string;
  hoBranch: "HO" | "Branch";
  titles: [string, Seniority][];
  weight: number;
}
const ROLES: RoleSpec[] = [
  { dept: "Sales", hoBranch: "Branch", weight: 46, titles: [["Branch Sales Executive", "Junior"], ["Relationship Executive", "Junior"], ["Gold Loan Officer", "Junior"], ["Branch Manager", "Mid"], ["Area Sales Manager", "Senior"]] },
  { dept: "Telesales", hoBranch: "HO", weight: 8, titles: [["Telesales Executive", "Junior"], ["Telesales Team Lead", "Mid"]] },
  { dept: "Finance", hoBranch: "HO", weight: 7, titles: [["Accounts Executive", "Junior"], ["Finance Analyst", "Mid"], ["Finance Manager", "Senior"]] },
  { dept: "IT", hoBranch: "HO", weight: 7, titles: [["Software Engineer", "Mid"], ["IT Support Engineer", "Junior"], ["Engineering Manager", "Senior"]] },
  { dept: "HR", hoBranch: "HO", weight: 5, titles: [["HR Executive", "Junior"], ["HR Business Partner", "Mid"]] },
  { dept: "Admin", hoBranch: "HO", weight: 5, titles: [["Admin Executive", "Junior"], ["Facilities Manager", "Mid"]] },
  { dept: "Marketing", hoBranch: "HO", weight: 5, titles: [["Digital Marketing Executive", "Junior"], ["Brand Manager", "Mid"]] },
  { dept: "Gold Processing", hoBranch: "HO", weight: 5, titles: [["Gold Appraiser", "Junior"], ["Processing Supervisor", "Mid"]] },
  { dept: "Retail", hoBranch: "Branch", weight: 5, titles: [["Retail Associate", "Junior"], ["Store Manager", "Mid"]] },
  { dept: "Legal", hoBranch: "HO", weight: 2, titles: [["Legal Associate", "Mid"]] },
  { dept: "Pre Sales", hoBranch: "HO", weight: 3, titles: [["Pre Sales Executive", "Junior"]] },
];

const SOURCES: [string, number][] = [
  ["Naukri", 30], ["Employee Ref", 20], ["LinkedIn", 10], ["Consultancy", 10], ["Workindia", 10], ["Walk In", 6], ["Job Enquiry", 8], ["Apna", 6],
];
const REJECT_REASONS = [
  "Lacks technical knowledge", "Communication not up to the mark", "Salary expectation too high", "Not suitable for field sales",
  "Only theoretical knowledge, no practical experience", "Could not explain past work", "Not willing to relocate", "Notice period too long",
];
const DROP_REASONS = [
  "Higher salary expectation", "Got another opportunity", "Current company retained", "Relocation issue",
  "Did not get relieving letter", "Work timing issue", "Not interested any more", "Family reasons",
];
const EXIT_REASONS: [string, string, number][] = [
  ["Better opportunity", "Moved to a bigger role at another company", 26],
  ["Compensation", "Salary lower than the market for the role", 16],
  ["Performance Issue", "Did not meet targets for three months in a row", 12],
  ["Relocation", "Moved to another city with family", 10],
  ["Higher Studies", "Left to study full time", 7],
  ["Work Environment", "Not comfortable with the team or manager", 9],
  ["Personal Health", "Long-term health problem", 5],
  ["Absconded", "Stopped coming to work without notice", 8],
  ["Asked to Leave", "Policy breach", 4],
  ["Family issue", "Needed to be at home for family", 6],
];

// ------------------------------------------------------------------ positions + hiring

interface Pos {
  id: string;
  position_id: string;
  open_closed: string;
  assigned_ta: string;
  closed_by_ta: string | null;
  date_closed: string | null;
  role_assigned_on: string;
  date_per_qandle: string;
  ho_branch: string;
  state: string;
  department: string;
  position_title: string;
  new_or_replacement: string;
  share_with_partners: number;
  seniority: Seniority;
  priority: string;
  position_aging_days_sheet: number;
  position_open_count: number;
  pipeline_count: number;
  yet_to_join_count: number;
  joined_count: number;
  comments: string | null;
}

interface Feedback {
  id: string; position_id: string; feedback_date: string; recruiter: string; candidate_name: string; source: string;
  position_applied_for: string; dept_location: string; interview_round: string; interviewer: string; outcome: string;
  feedback: string | null; reason: string | null;
}
interface Joiner {
  id: string; position_id: string; source: string; referral_name: string | null; recruiter: string; candidate_name: string;
  department: string; location: string; designation: string; application_date: string | null; doj: string; status: string;
}
interface DropOut {
  id: string; position_id: string; recruiter: string; candidate_name: string; position_applied: string; location: string;
  source: string; feedback: string | null; offer_accepted_date: string; expected_doj: string; actual_dropout_date: string;
  days_offer_to_dropout: number; reason: string;
}

function buildHiring() {
  const positions: Pos[] = [];
  const feedback: Feedback[] = [];
  const joiners: Joiner[] = [];
  const dropOuts: DropOut[] = [];
  const interviewers = Array.from({ length: 14 }, () => fakeName());

  const COUNT = 168;
  for (let i = 0; i < COUNT; i++) {
    // More positions in recent months: the business is growing.
    const age = Math.floor(Math.pow(rand(), 1.25) * 330) + 1;
    const role = weighted(ROLES.map((r) => [r, r.weight] as const));
    const [title, seniority] = pick(role.titles);
    const state = role.hoBranch === "HO" ? "KA" : weighted(STATES);
    const town = role.hoBranch === "HO" ? "HO - Bengaluru" : pick(BRANCH_TOWNS[state]);
    const ta = weighted(TA_WEIGHT);
    const assigned = daysAgo(age);
    const sla = SLA[seniority];
    const openCount = role.hoBranch === "Branch" && seniority === "Junior" ? weighted([[1, 70], [2, 22], [3, 8]] as const) : 1;
    const priority = weighted([["P1", 78], ["P0", 8], ["P2", 14]] as const);

    // How long it took / will take to close.
    const speed = TA_SPEED[ta] * (priority === "P0" ? 0.7 : priority === "P2" ? 1.3 : 1);
    const needed = Math.max(4, Math.round(sla * speed * (0.35 + rand() * 1.15)));
    let status: string;
    let closed: string | null = null;
    const r = rand();
    if (r < 0.015) status = "Position Cancelled";
    else if (r < 0.04) status = "Hold";
    else if (needed <= age) {
      status = "Closed";
      closed = addDays(assigned, needed);
    } else status = "Open";

    const posId = `JOB${String(100 + i).padStart(3, "0")}`;
    const pos: Pos = {
      id: `sc-pos-${i}`,
      position_id: posId,
      open_closed: status,
      assigned_ta: ta,
      closed_by_ta: closed ? (rand() < 0.9 ? ta : pick(TAS)) : null,
      date_closed: closed,
      role_assigned_on: assigned,
      date_per_qandle: addDays(assigned, rand() < 0.7 ? 0 : -int(1, 4)),
      ho_branch: role.hoBranch,
      state,
      department: role.dept,
      position_title: title,
      new_or_replacement: rand() < 0.55 ? "New" : "Replacement",
      share_with_partners: rand() < 0.22 ? 1 : 0,
      seniority,
      priority,
      position_aging_days_sheet: closed ? diffDays(assigned, closed) : age,
      position_open_count: openCount,
      pipeline_count: 0,
      yet_to_join_count: 0,
      joined_count: 0,
      comments: status === "Hold" ? "On hold until the budget is confirmed" : status === "Position Cancelled" ? "Role merged with another opening" : null,
    };

    // Candidates: interviews run from a few days after assignment until close (or today).
    const end = closed ?? todayIso;
    const window = Math.max(1, diffDays(assigned, end));
    const selectedNeeded = status === "Closed" ? openCount : status === "Open" ? (rand() < 0.35 ? 1 : 0) : 0;
    const candidates = Math.min(9, 2 + Math.round(window / 12) + int(0, 2)) * (openCount > 1 ? 1.5 : 1);
    let selectedSoFar = 0;
    const selected: { name: string; source: string; date: string }[] = [];

    for (let c = 0; c < Math.round(candidates); c++) {
      const name = fakeName();
      const source = weighted(SOURCES);
      const isLast = c >= Math.round(candidates) - selectedNeeded;
      const rounds = seniority === "Junior" ? 2 : 3;
      let date = addDays(assigned, Math.min(window, int(2, Math.max(2, window))));
      if (date > end) date = end;
      // Most open positions have someone in the last week, so the "last 7 days" view is alive.
      if (status === "Open" && c === 0 && rand() < 0.6) date = daysAgo(int(0, 6));
      else if (date > daysAgo(7) && rand() < 0.5) date = addDays(assigned, int(1, Math.max(1, window - 8)));
      if (date > end) date = end;
      for (let round = 1; round <= rounds; round++) {
        const roundName = round === rounds ? "Final Round" : `Round ${round}`;
        let outcome: string;
        let reason: string | null = null;
        if (isLast && selectedSoFar < selectedNeeded) {
          outcome = round === rounds ? "Selected" : "Shortlisted";
        } else if (date >= daysAgo(3) && status === "Open") {
          outcome = weighted([["Interview Pending", 3], ["In Process", 2], ["On Hold", 2]] as const);
        } else {
          outcome = weighted([["Rejected", 55], ["Shortlisted", 30], ["On Hold", 15]] as const);
          if (round === rounds && outcome === "Shortlisted") outcome = rand() < 0.4 ? "Selected" : "Rejected";
        }
        if (outcome === "Rejected") reason = pick(REJECT_REASONS);
        feedback.push({
          id: `sc-fb-${feedback.length}`,
          position_id: posId,
          feedback_date: date,
          recruiter: ta,
          candidate_name: name,
          source,
          position_applied_for: title,
          dept_location: role.hoBranch === "Branch" ? "Branch" : role.dept,
          interview_round: roundName,
          interviewer: pick(interviewers),
          outcome,
          feedback: outcome === "Selected" ? "Good fit for the role" : outcome === "Rejected" ? "Not a fit" : null,
          reason,
        });
        if (outcome === "Selected") {
          if (isLast) selectedSoFar++;
          selected.push({ name, source, date });
          break;
        }
        if (outcome !== "Shortlisted") break;
        const next = addDays(date, int(1, 5));
        if (next <= end) date = next;
        else if (isLast) date = end; // the hire still happens, on the closing day
        else break;
      }
    }

    // Offers -> joiners (and a few drop-outs, replaced by someone else).
    let joined = 0;
    let yetToJoin = 0;
    for (const s of selected) {
      const offerDate = addDays(s.date, int(1, 4));
      const doj = addDays(offerDate, seniority === "Junior" ? int(7, 21) : int(21, 60));
      const dropsOut = rand() < 0.12;
      const base = {
        position_id: posId,
        source: s.source,
        referral_name: s.source === "Employee Ref" ? fakeName() : null,
        recruiter: ta,
        candidate_name: s.name,
        department: role.hoBranch === "Branch" ? "Branch" : role.dept,
        location: town,
        designation: title,
        application_date: addDays(assigned, int(0, 5)),
        doj,
      };
      if (dropsOut) {
        const dropDate = addDays(offerDate, int(3, Math.max(4, diffDays(offerDate, doj))));
        joiners.push({ id: `sc-uj-${joiners.length}`, ...base, status: "Drop" });
        dropOuts.push({
          id: `sc-do-${dropOuts.length}`,
          position_id: posId,
          recruiter: ta,
          candidate_name: s.name,
          position_applied: title,
          location: role.hoBranch,
          source: s.source,
          feedback: "Candidate informed over phone",
          offer_accepted_date: offerDate,
          expected_doj: doj,
          actual_dropout_date: dropDate > todayIso ? todayIso : dropDate,
          days_offer_to_dropout: Math.max(0, diffDays(offerDate, dropDate > todayIso ? todayIso : dropDate)),
          reason: pick(DROP_REASONS),
        });
        continue;
      }
      let st = doj <= todayIso ? "Joined" : "Yet to join";
      if (st === "Joined" && rand() < 0.03) st = "Joined & Left";
      if (st === "Yet to join") yetToJoin++;
      else joined++;
      joiners.push({ id: `sc-uj-${joiners.length}`, ...base, status: st });
    }
    pos.joined_count = joined;
    pos.yet_to_join_count = yetToJoin;
    pos.pipeline_count = status === "Open" ? int(2, 9) : 0;
    positions.push(pos);
  }
  return { positions, feedback, joiners, dropOuts };
}

// ------------------------------------------------------------------ employees + exits

interface Emp {
  id: string; employee_code: string; full_name: string; department: string | null; location: string; designation: string;
  date_of_joining: string; date_of_birth: string | null; relieving_date: string | null; employee_status: string;
}
interface Exit {
  id: string; emp_code: string; emp_name: string; department: string | null; designation: string; location_type: string;
  category: string; branch_name: string; state: string; reporting_manager: string; date_of_joining: string;
  resignation_date: string | null; exit_date: string; actual_reason: string; reason_detail: string; regrettable: string;
  talent: string | null; voluntary: string;
}

function buildPeople() {
  const employees: Emp[] = [];
  const exits: Exit[] = [];
  const managers = Array.from({ length: 10 }, () => fakeName());
  const depts: [string, string, number][] = [
    ["Branch Sales", "Branch", 52], ["Sales", "HO", 6], ["Telesales", "HO", 6], ["Finance", "HO", 6], ["IT", "HO", 6], ["HR", "HO", 4],
    ["Admin", "HO", 4], ["Marketing", "HO", 4], ["Gold Processing", "HO", 5], ["Retail", "Branch", 5], ["Legal", "HO", 2],
  ];
  const designations: Record<string, string[]> = {
    "Branch Sales": ["Branch Sales Executive", "Relationship Executive", "Gold Loan Officer", "Branch Manager"],
    Retail: ["Retail Associate", "Store Manager"],
  };
  const branchLocations = [
    ...BRANCH_TOWNS.KA.map((t) => `KA-${t.toUpperCase()}`),
    ...BRANCH_TOWNS["AP/TL"].slice(0, 3).map((t) => `AP-${t.toUpperCase()}`),
    ...BRANCH_TOWNS["AP/TL"].slice(3).map((t) => `TS-${t.toUpperCase()}`),
    ...BRANCH_TOWNS.KL.map((t) => `KL-${t.toUpperCase()}`),
  ];

  let seq = 1000;
  const add = (code: string, maxDaysAgo: number, leaveRate: number) => {
    const [dept, kind] = weighted(depts.map(([d, k, w]) => [[d, k] as const, w] as const));
    // Hiring grew over time: more recent joiners.
    const joinedAgo = Math.floor(Math.pow(rand(), 1.6) * maxDaysAgo) + 5;
    const joined = daysAgo(joinedAgo);
    const location = kind === "HO" ? "KA-HO BENGALURU" : pick(branchLocations);
    let relieving: string | null = null;
    if (joinedAgo > 30 && rand() < leaveRate) {
      // A third of leavers go within 90 days (infant attrition).
      const early = rand() < 0.33;
      const tenure = early ? int(12, 89) : int(90, Math.max(91, joinedAgo - 1));
      const t = Math.min(tenure, joinedAgo - 1);
      relieving = addDays(joined, t);
    }
    const name = fakeName();
    const designation = pick(designations[dept] ?? [`${dept} Executive`, `${dept} Manager`]);
    const emp: Emp = {
      id: `sc-emp-${employees.length}`,
      employee_code: code,
      full_name: name,
      department: rand() < 0.01 ? null : dept,
      location,
      designation,
      date_of_joining: joined,
      date_of_birth: rand() < 0.03 ? null : daysAgo(int(21, 52) * 365 + int(0, 364)),
      relieving_date: relieving,
      employee_status: relieving ? "Relieved" : "Confirmed",
    };
    employees.push(emp);

    // Most leavers have an exits-sheet row with the reason (a few are missing, as in real life).
    if (relieving && rand() < 0.88) {
      const [reason, detail] = weighted(EXIT_REASONS.map(([r, d, w]) => [[r, d] as const, w] as const));
      const prefix = location.slice(0, 2);
      const involuntary = reason === "Performance Issue" || reason === "Asked to Leave" || reason === "Absconded";
      exits.push({
        id: `sc-exit-${exits.length}`,
        emp_code: code,
        emp_name: name,
        department: emp.department,
        designation,
        location_type: kind,
        category: kind,
        branch_name: kind === "HO" ? "Head Office" : location.slice(3),
        state: STATE_NAME[prefix] ?? "Karnataka",
        reporting_manager: pick(managers),
        date_of_joining: joined,
        resignation_date: involuntary ? null : addDays(relieving, -int(15, 30)),
        exit_date: relieving,
        actual_reason: reason,
        reason_detail: detail,
        regrettable: !involuntary && rand() < 0.3 ? "Regrettable" : "Non-regrettable",
        talent: null,
        voluntary: involuntary ? "Involuntary" : "Voluntary",
      });
    }
  };

  for (let i = 0; i < 560; i++) add(`WG${String(seq++).padStart(5, "0")}`, 2100, 0.3);
  for (let i = 0; i < 26; i++) add(`WG-INT-${String(i + 1).padStart(4, "0")}`, 420, 0.45);
  for (let i = 0; i < 12; i++) add(`WG-CON-${String(i + 1).padStart(4, "0")}`, 900, 0.25);
  // People of another group company: present in the HR system, left out of every view.
  for (let i = 0; i < 9; i++) add(`WP${String(i + 1).padStart(4, "0")}`, 1200, 0.2);
  return { employees, exits };
}

// ------------------------------------------------------------------ write

export function seedShowcaseDb(db: DatabaseSync): void {
  const syncedAt = new Date(TODAY + 6.5 * 3_600_000).toISOString();
  const { positions, feedback, joiners, dropOuts } = buildHiring();
  const { employees, exits } = buildPeople();

  const insertAll = (table: string, rows: object[]) => {
    if (rows.length === 0) return;
    const cols = [...Object.keys(rows[0]), "synced_at"];
    const stmt = db.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`);
    for (const row of rows) {
      const values = Object.values(row).map((v) => (v === undefined ? null : v)) as (string | number | null)[];
      stmt.run(...values, syncedAt);
    }
  };

  db.exec("BEGIN");
  insertAll("positions", positions);
  insertAll("candidate_feedback", feedback);
  insertAll("upcoming_joiners", joiners);
  insertAll("drop_outs", dropOuts);
  insertAll("employees", employees);
  insertAll("exit_employees", exits);

  // A few hot positions: urgent open roles.
  const hot = positions.filter((p) => p.open_closed === "Open" && p.priority !== "P2").slice(0, 4);
  const hotStmt = db.prepare("INSERT INTO hot_positions (position_id, marked_by, marked_at) VALUES (?, ?, ?)");
  for (const p of hot) hotStmt.run(p.position_id, "demo-admin", syncedAt);

  // A sync history so the Admin and Data source pages look lived-in.
  const runStmt = db.prepare(
    "INSERT INTO sync_runs (id, source_name, started_at, finished_at, status, rows_synced, error) VALUES (?, ?, ?, ?, 'success', ?, NULL)"
  );
  const rows = positions.length + feedback.length + joiners.length + dropOuts.length;
  for (let d = 0; d < 6; d++) {
    const start = new Date(TODAY - d * DAY + 6.5 * 3_600_000).toISOString();
    const end = new Date(TODAY - d * DAY + 6.5 * 3_600_000 + 9_000).toISOString();
    runStmt.run(`sc-run-${d}`, "ta-tracker-sheet", start, end, rows - d * 3);
  }
  db.exec("COMMIT");
}

// ------------------------------------------------------------------ finance sheet

/**
 * A made-up "Real OG" tab, laid out the way lib/metrics/financials-parse.ts
 * reads the real one: months across, labelled blocks down the page. Covers the
 * financial year before this one and this one; months after last month are blank.
 */
export function buildShowcaseFinanceGrid(): string[][] {
  const fr = seeded(777);
  const now = new Date(TODAY);
  const fyStartYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() - 1 : now.getUTCFullYear() - 2;
  const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const months: { label: string; filled: boolean }[] = [];
  const lastFilled = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  for (let k = 0; k < 24; k++) {
    const d = new Date(Date.UTC(fyStartYear, 3 + k, 1));
    months.push({ label: `${MONTH[d.getUTCMonth()]} ${d.getUTCFullYear()}`, filled: d <= lastFilled });
  }
  const n = months.length;
  const grid: string[][] = [];
  const row = (label: string, values: (number | null)[]) =>
    grid.push([label, ...values.map((v) => (v === null ? "" : String(Math.round(v))))]);
  const blank = () => grid.push([""]);
  const series = (fn: (m: number) => number) => months.map((mo, m) => (mo.filled ? fn(m) : null));

  // Headcount grows steadily with small wobbles.
  const branchHc = series((m) => Math.round(240 + m * 7.5 + (fr() - 0.5) * 8));
  const seHc = series((m) => Math.round(38 + m * 0.8 + (fr() - 0.5) * 3));
  const hoHc = series((m) => Math.round(104 + m * 1.6 + (fr() - 0.5) * 4));
  const totalHc = months.map((_, m) => (branchHc[m] === null ? null : branchHc[m]! + seHc[m]! + hoHc[m]!));
  const female = totalHc.map((t) => (t === null ? null : Math.round(t * (0.33 + fr() * 0.02))));
  const male = totalHc.map((t, m) => (t === null ? null : t - female[m]!));
  const branches = series((m) => 58 + Math.floor(m * 1.4));

  grid.push(["Particulars", ...months.map((m) => m.label)]);
  row("Total headcount", totalHc);
  row("Branch headcount", branchHc);
  row("Sales Enablers headcount", seHc);
  row("HO headcount", hoHc);
  row("# of Branches", branches);
  row("Female", female);
  row("Male", male);
  blank();

  // Pay per head, with a yearly increment every April.
  const hike = (m: number) => Math.pow(1.08, Math.floor(m / 12));
  const grossBranch = branchHc.map((h, m) => (h === null ? null : h * 21_500 * hike(m) * (0.98 + fr() * 0.04)));
  const grossSE = seHc.map((h, m) => (h === null ? null : h * 34_000 * hike(m) * (0.98 + fr() * 0.04)));
  const grossHO = hoHc.map((h, m) => (h === null ? null : h * 52_000 * hike(m) * (0.98 + fr() * 0.04)));
  row("Payroll Cost", new Array(n).fill(null));
  row("Branch - Earned Gross", grossBranch);
  row("Sales Enablers - Earned Gross", grossSE);
  row("HO - Earned Gross", grossHO);
  blank();
  const ctcOf = (s: (number | null)[]) => s.map((v) => (v === null ? null : v * 1.11));
  row("Branch - CTC", ctcOf(grossBranch));
  row("Sales Enablers - CTC", ctcOf(grossSE));
  row("HO - CTC", ctcOf(grossHO));
  blank();

  // Departments: HO gross split by share, plus incentives and consultants.
  grid.push(["Department Wise - Cost"]);
  const hoDepts: [string, number][] = [["Finance", 0.17], ["IT", 0.22], ["HR", 0.1], ["Admin", 0.1], ["Marketing", 0.12], ["Gold Processing", 0.13], ["Telesales", 0.11], ["Legal", 0.05]];
  row("Branch - Earned Gross", grossBranch);
  row("Branch - Incentives", grossBranch.map((v) => (v === null ? null : v * (0.05 + fr() * 0.03))));
  row("Sales Enablers - Earned Gross", grossSE);
  for (const [d, share] of hoDepts) {
    row(`HO - ${d} - Earned Gross`, grossHO.map((v) => (v === null ? null : v * share)));
    if (d === "Telesales") row(`HO - ${d} - Incentives`, grossHO.map((v) => (v === null ? null : v * share * 0.08)));
  }
  row("Consultants - Earned Gross", series(() => 3_10_000 + fr() * 40_000));
  blank();

  // Places: headcount and cost by state and branch/HO. They add up to the totals.
  const placeShares: [string, number][] = [["Karnataka - Branch", 0.6], ["Andhra Pradesh - Branch", 0.17], ["Telangana - Branch", 0.13], ["Kerala - Branch", 0.1]];
  const placeHc = placeShares.map(([, s]) => branchHc.map((h) => (h === null ? null : Math.round(h * s))));
  // Rounding remainder goes to the first branch place, so totals match exactly.
  months.forEach((_, m) => {
    if (branchHc[m] === null) return;
    const sum = placeHc.reduce((a, p) => a + (p[m] ?? 0), 0);
    placeHc[0][m] = (placeHc[0][m] ?? 0) + (branchHc[m]! - sum);
  });
  grid.push(["Statewise Headcount"]);
  placeShares.forEach(([label], i) => row(label, placeHc[i]));
  row("Karnataka - HO", hoHc.map((h, m) => (h === null ? null : h + seHc[m]!)));
  blank();
  grid.push(["Statewise Cost"]);
  placeShares.forEach(([label], i) => {
    const gross = placeHc[i].map((h, m) => (h === null || branchHc[m] === null ? null : (grossBranch[m]! * h) / branchHc[m]!));
    row(`${label} Earned Gross`, gross);
    row(`${label} CTC`, ctcOf(gross));
  });
  const hoGross = grossHO.map((v, m) => (v === null ? null : v + grossSE[m]!));
  row("Karnataka - HO Earned Gross", hoGross);
  row("Karnataka - HO CTC", ctcOf(hoGross));
  row("Earned Gross", new Array(n).fill(null));
  blank();

  // Non-payroll people cost (the break-up must be the last block: the parser
  // reads every labelled row after it).
  const items: [string, (m: number) => number][] = [
    ["Recruitment - Job portals", () => 1_40_000 + fr() * 30_000],
    ["Recruitment - Consultancy fees", () => 90_000 + fr() * 120_000],
    ["Staff welfare", (m) => (totalHc[m] ?? 0) * 450],
    ["Training", () => 60_000 + fr() * 50_000],
    ["Group health insurance", (m) => (totalHc[m] ?? 0) * 610],
    ["Travel & Accommodation", () => 2_10_000 + fr() * 60_000],
    ["Background verification", () => 35_000 + fr() * 15_000],
  ];
  const itemSeries = items.map(([label, fn]) => [label, series(fn)] as const);
  const npTotal = months.map((_, m) =>
    months[m].filled ? itemSeries.reduce((a, [, s]) => a + Math.round(s[m] ?? 0), 0) : null
  );
  grid.push(["HR Cost Breakdown"]);
  row("Non-payroll Cost", npTotal);
  grid.push(["Break-up of Non-payroll Cost"]);
  for (const [label, s] of itemSeries) row(label, s);
  return grid;
}
