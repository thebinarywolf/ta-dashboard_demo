// Planning projects for the Financials tab: "what happens to people cost if we
// open a new state, add a team, or hire for a new set of branches?". A project
// is a handful of editable numbers that this file turns into a month-by-month
// cost, which then sits on top of the baseline forecast.

export type ProjectKind = "state" | "branches" | "team" | "custom";

export const PROJECT_KINDS: { key: ProjectKind; label: string }[] = [
  { key: "state", label: "New state" },
  { key: "branches", label: "New branches" },
  { key: "team", label: "New team" },
  { key: "custom", label: "Blank project" },
];

/** A group of people the project hires: how many, what they cost, when they start and how fast they join. */
export interface PlanLine {
  id: string;
  label: string;
  people: number;
  /** Rupees per person per month. */
  payPerHead: number;
  /** Months after the project's start month before this group begins joining. */
  delayMonths: number;
  /** People join evenly over this many months (1 = all at once). */
  rampMonths: number;
  /** When set, people join in whole groups of this size (the staff of one branch). */
  unit?: number;
}

/** One role that staffs every branch, such as a branch manager. */
export interface RolloutRole {
  id: string;
  label: string;
  /** How many of this role each branch has. */
  perBranch: number;
  /** Rupees per person per month. */
  payPerHead: number;
}

/**
 * The simple way to describe an expansion: this many branches, opening evenly
 * over this many months, each staffed by the same roles. The project's lines are
 * worked out from it.
 */
export interface Rollout {
  /** The state being entered (a label only). */
  state: string;
  branches: number;
  /** Branches open evenly over this many months. */
  months: number;
  roles: RolloutRole[];
  /** One-time cost for each branch, in the month it opens. */
  setupPerBranch: number;
}

/** A cost that happens once, such as setting up an office or training a first batch. */
export interface PlanOneOff {
  id: string;
  label: string;
  amount: number;
  /** 2026-11 */
  monthKey: string;
}

export interface PlanProject {
  id: string;
  name: string;
  kind: ProjectKind;
  /** Branches opened, for the cost-per-branch figure. */
  branches: number;
  /** The month the first people join. */
  startKey: string;
  lines: PlanLine[];
  /** Meals, insurance and the like, per person per month. */
  nonPayrollPerHead: number;
  /** What it costs to hire one person (agency fee, onboarding). */
  hireCost: number;
  /** Whether pay per head rises with the forecast's pay rise. */
  payRise: boolean;
  oneOffs: PlanOneOff[];
  /** Whether it is counted in the forecast. */
  enabled: boolean;
  /** Present for branch rollouts; the lines above are then worked out from it. */
  rollout?: Rollout;
}

export interface ImpactMonth {
  key: string;
  /** Branches open so far (rollouts only). */
  branches: number;
  /** Pay for each of the project's lines, in the same order as its lines. */
  linePayroll: number[];
  headcount: number;
  payroll: number;
  nonPayroll: number;
  hiring: number;
  oneOff: number;
  total: number;
}

export const monthNumber = (key: string): number => {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
};

const keyOfNumber = (n: number): string => `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;

export const addToKey = (key: string, by: number): string => keyOfNumber(monthNumber(key) + by);

/** How many of a line's people have joined by month number `n`. */
function joinedBy(p: PlanProject, line: PlanLine, n: number): number {
  const t = n - monthNumber(p.startKey) - Math.max(0, Math.round(line.delayMonths));
  if (t < 0) return 0;
  const ramp = Math.max(1, Math.round(line.rampMonths));
  const people = Math.max(0, line.people);
  if (line.unit && line.unit > 0) {
    // Whole branches at a time: the staff of a branch arrive together.
    const groups = Math.round(people / line.unit);
    return line.unit * Math.round((groups * Math.min(t + 1, ramp)) / ramp);
  }
  return Math.round((people * Math.min(t + 1, ramp)) / ramp);
}

/** Branches open by month number `n` for a rollout (0 for any other project). */
export function branchesOpenBy(p: PlanProject, n: number): number {
  if (!p.rollout) return 0;
  const t = n - monthNumber(p.startKey);
  if (t < 0) return 0;
  const months = Math.max(1, Math.round(p.rollout.months));
  return Math.round((Math.max(0, p.rollout.branches) * Math.min(t + 1, months)) / months);
}

/**
 * The project's cost in each of the given months. `payFactorOf` is the
 * forecast's cumulative pay rise for a month (1 = today's pay).
 */
export function projectImpact(p: PlanProject, keys: string[], payFactorOf: (key: string) => number): ImpactMonth[] {
  return keys.map((key) => {
    const n = monthNumber(key);
    let headcount = 0;
    let previous = 0;
    let payroll = 0;
    const factor = p.payRise ? payFactorOf(key) : 1;
    const linePayroll: number[] = [];
    for (const line of p.lines) {
      const joined = joinedBy(p, line, n);
      headcount += joined;
      previous += joinedBy(p, line, n - 1);
      const pay = joined * Math.max(0, line.payPerHead) * factor;
      linePayroll.push(pay);
      payroll += pay;
    }
    const branches = branchesOpenBy(p, n);
    const newBranches = Math.max(0, branches - branchesOpenBy(p, n - 1));
    const nonPayroll = headcount * Math.max(0, p.nonPayrollPerHead);
    const hiring = Math.max(0, headcount - previous) * Math.max(0, p.hireCost);
    const oneOff =
      p.oneOffs.filter((o) => o.monthKey === key).reduce((a, o) => a + Math.max(0, o.amount), 0) +
      newBranches * Math.max(0, p.rollout?.setupPerBranch ?? 0);
    return { key, branches, linePayroll, headcount, payroll, nonPayroll, hiring, oneOff, total: payroll + nonPayroll + hiring + oneOff };
  });
}

/** Month-by-month sum of several projects' impacts. */
export function sumImpacts(lists: ImpactMonth[][], keys: string[]): ImpactMonth[] {
  return keys.map((key, i) => {
    const acc: ImpactMonth = { key, branches: 0, linePayroll: [], headcount: 0, payroll: 0, nonPayroll: 0, hiring: 0, oneOff: 0, total: 0 };
    for (const list of lists) {
      const m = list[i];
      if (!m) continue;
      acc.branches += m.branches;
      acc.headcount += m.headcount;
      acc.payroll += m.payroll;
      acc.nonPayroll += m.nonPayroll;
      acc.hiring += m.hiring;
      acc.oneOff += m.oneOff;
      acc.total += m.total;
    }
    return acc;
  });
}

/** What the project costs each month once everyone has joined, at today's pay. */
export function steadyState(p: PlanProject): { people: number; monthly: number; yearly: number; perPerson: number | null; perBranch: number | null } {
  const people = p.lines.reduce((a, l) => a + Math.max(0, Math.round(l.people)), 0);
  const pay = p.lines.reduce((a, l) => a + Math.max(0, Math.round(l.people)) * Math.max(0, l.payPerHead), 0);
  const monthly = pay + people * Math.max(0, p.nonPayrollPerHead);
  return {
    people,
    monthly,
    yearly: monthly * 12,
    perPerson: people > 0 ? monthly / people : null,
    perBranch: p.branches > 0 ? monthly / p.branches : null,
  };
}

// ----------------------------------------------------------------- creating

export interface TemplateContext {
  /** First month a new project can start (the month after the latest actual). */
  firstKey: string;
  /** Typical pay per head per month, from the last few actual months. */
  branchPay: number;
  salesPay: number;
  hoPay: number;
  /** Branch staff per branch, from the latest actual month. */
  staffPerBranch: number;
  nonPayrollPerHead: number;
}

export const newId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const line = (label: string, people: number, payPerHead: number, delayMonths: number, rampMonths: number): PlanLine => ({
  id: newId(),
  label,
  people,
  payPerHead: Math.round(payPerHead),
  delayMonths,
  rampMonths,
});

const oneOff = (label: string, monthKey: string): PlanOneOff => ({ id: newId(), label, amount: 0, monthKey });

/** The default staff of a branch: a manager, an assistant manager and a business development executive. */
export function defaultRoles(pay: number): RolloutRole[] {
  return [
    { id: newId(), label: "BM", perBranch: 1, payPerHead: Math.round(pay) },
    { id: newId(), label: "ABM", perBranch: 1, payPerHead: Math.round(pay) },
    { id: newId(), label: "BDE", perBranch: 1, payPerHead: Math.round(pay) },
  ];
}

/** The lines a rollout works out to: every role, in whole branches, over the rollout months. */
export function rolloutLines(r: Rollout): PlanLine[] {
  return r.roles.map((role) => ({
    id: role.id,
    label: role.label,
    people: Math.max(0, Math.round(r.branches)) * Math.max(0, Math.round(role.perBranch)),
    payPerHead: role.payPerHead,
    delayMonths: 0,
    rampMonths: Math.max(1, Math.round(r.months)),
    unit: Math.max(0, Math.round(role.perBranch)),
  }));
}

/** The project with its rollout changed and its lines worked out again. */
export function withRollout(p: PlanProject, change: Partial<Rollout>): PlanProject {
  const base: Rollout = p.rollout ?? { state: "", branches: 1, months: 1, roles: [], setupPerBranch: 0 };
  const rollout: Rollout = { ...base, ...change };
  return { ...p, rollout, lines: rolloutLines(rollout), branches: Math.max(0, Math.round(rollout.branches)) };
}

/** The name a state expansion gets from the state typed in. */
export const stateProjectName = (state: string): string => (state.trim() ? `${state.trim()} expansion` : "New state expansion");

/** A starting point with sensible numbers from the sheet. Everything is meant to be edited. */
export function newProject(kind: ProjectKind, c: TemplateContext): PlanProject {
  const start = addToKey(c.firstKey, 2);
  const base: PlanProject = {
    id: newId(),
    name: "New project",
    kind,
    branches: 0,
    startKey: start,
    lines: [],
    nonPayrollPerHead: Math.round(c.nonPayrollPerHead),
    hireCost: 0,
    payRise: true,
    oneOffs: [],
    enabled: true,
  };
  switch (kind) {
    case "state":
      return withRollout(
        { ...base, name: stateProjectName("") },
        { state: "", branches: 10, months: 6, roles: defaultRoles(c.branchPay), setupPerBranch: 0 }
      );
    case "branches":
      return withRollout({ ...base, name: "New branches" }, { state: "", branches: 5, months: 3, roles: defaultRoles(c.branchPay), setupPerBranch: 0 });
    case "team":
      return {
        ...base,
        name: "New team",
        lines: [line("Team members", 5, c.hoPay, 0, 3)],
        oneOffs: [oneOff("Equipment and training", start)],
      };
    default:
      return { ...base, name: "New project", lines: [line("People", 5, c.hoPay, 0, 1)] };
  }
}

/** The same project with new ids everywhere, so a copy and its original never share one. */
export function withFreshIds(p: PlanProject): PlanProject {
  const copy: PlanProject = {
    ...p,
    id: newId(),
    lines: p.lines.map((l) => ({ ...l, id: newId() })),
    oneOffs: p.oneOffs.map((o) => ({ ...o, id: newId() })),
  };
  return p.rollout ? withRollout(copy, { roles: p.rollout.roles.map((r) => ({ ...r, id: newId() })) }) : copy;
}

export function duplicateProject(p: PlanProject): PlanProject {
  return { ...withFreshIds(p), name: `${p.name} (copy)` };
}

export function newLine(c: Pick<TemplateContext, "hoPay">): PlanLine {
  return line("People", 1, c.hoPay, 0, 1);
}

export function newOneOff(monthKey: string): PlanOneOff {
  return oneOff("One-time cost", monthKey);
}

// ------------------------------------------------------------ saved plans

const num = (v: unknown, fallback = 0, min = 0, max = 1e10): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const str = (v: unknown, fallback: string, max = 80): string => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : fallback);
const monthKey = (v: unknown, fallback: string): string => (typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : fallback);

/**
 * Turns whatever was saved or imported into well-formed projects, dropping
 * anything unusable. Saved files can be edited by hand, so nothing is trusted.
 */
export function sanitizeProjects(raw: unknown, fallbackKey: string): PlanProject[] {
  if (!Array.isArray(raw)) return [];
  const out: PlanProject[] = [];
  for (const r of raw.slice(0, 50)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const kind = PROJECT_KINDS.some((k) => k.key === o.kind) ? (o.kind as ProjectKind) : "custom";
    const lines = (Array.isArray(o.lines) ? o.lines : []).slice(0, 30).flatMap((l): PlanLine[] => {
      if (!l || typeof l !== "object") return [];
      const x = l as Record<string, unknown>;
      return [
        {
          id: str(x.id, newId(), 40),
          label: str(x.label, "People"),
          people: num(x.people, 0, 0, 100000),
          payPerHead: num(x.payPerHead, 0, 0, 10000000),
          delayMonths: num(x.delayMonths, 0, 0, 60),
          rampMonths: Math.max(1, num(x.rampMonths, 1, 1, 60)),
        },
      ];
    });
    const oneOffs = (Array.isArray(o.oneOffs) ? o.oneOffs : []).slice(0, 30).flatMap((l): PlanOneOff[] => {
      if (!l || typeof l !== "object") return [];
      const x = l as Record<string, unknown>;
      return [
        {
          id: str(x.id, newId(), 40),
          label: str(x.label, "One-time cost"),
          amount: num(x.amount, 0, 0, 1e11),
          monthKey: monthKey(x.monthKey, fallbackKey),
        },
      ];
    });
    const project: PlanProject = {
      id: str(o.id, newId(), 40),
      name: str(o.name, "Untitled project"),
      kind,
      branches: num(o.branches, 0, 0, 10000),
      startKey: monthKey(o.startKey, fallbackKey),
      lines,
      nonPayrollPerHead: num(o.nonPayrollPerHead, 0, 0, 10000000),
      hireCost: num(o.hireCost, 0, 0, 10000000),
      payRise: o.payRise !== false,
      oneOffs,
      enabled: o.enabled !== false,
    };
    const ro = o.rollout;
    if (ro && typeof ro === "object") {
      const r = ro as Record<string, unknown>;
      const roles = (Array.isArray(r.roles) ? r.roles : []).slice(0, 12).flatMap((x): RolloutRole[] => {
        if (!x || typeof x !== "object") return [];
        const y = x as Record<string, unknown>;
        return [
          {
            id: str(y.id, newId(), 40),
            label: str(y.label, "Role", 40),
            perBranch: Math.round(num(y.perBranch, 1, 0, 50)),
            payPerHead: num(y.payPerHead, 0, 0, 10000000),
          },
        ];
      });
      out.push(
        withRollout(project, {
          state: str(r.state, "", 60),
          branches: Math.max(1, Math.round(num(r.branches, 1, 1, 2000))),
          months: Math.max(1, Math.round(num(r.months, 1, 1, 60))),
          roles,
          setupPerBranch: num(r.setupPerBranch, 0, 0, 1e9),
        })
      );
    } else {
      out.push(project);
    }
  }
  return out;
}
