import { money } from "./financials-format";
import type { ForecastResult } from "./financials-forecast";
import {
  addToKey,
  projectImpact,
  steadyState,
  withRollout,
  type ImpactMonth,
  type PlanProject,
} from "./financials-projects";

// Everything the project infographic, the PDF and the Excel file say about a
// project, worked out once here so all three tell the same story.

const NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 2027-01 -> Jan 2027 */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${NAMES[m - 1] ?? "?"} ${y}`;
}

/** 2027-01 -> Jan 27 */
export function monthShort(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${NAMES[m - 1] ?? "?"} ${String(y).slice(2)}`;
}

export interface CostPart {
  label: string;
  amount: number;
}

export interface BranchOpening {
  /** 1, 2, 3 ... in opening order. */
  number: number;
  monthKey: string;
}

export interface CompanyRow {
  key: string;
  label: string;
  /** What the month is: "First branches open", "All branches open", "A year in". */
  note: string;
  baselineHeadcount: number;
  withHeadcount: number;
  baselineCost: number;
  withCost: number;
  changePct: number;
}

export interface ProjectReport {
  project: PlanProject;
  steady: ReturnType<typeof steadyState>;
  /** Month by month from the start month. */
  months: ImpactMonth[];
  /** Running total of what the project has cost. */
  cumulative: number[];
  /** The first 12 months, split into what the money goes on. */
  firstYear: { total: number; parts: CostPart[] };
  /** When each branch opens (rollouts only). */
  openings: BranchOpening[];
  /** The month the last person has joined. */
  fullStrengthKey: string;
  company: CompanyRow[];
  /** Plain-English findings. */
  insights: string[];
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function buildProjectReport(p: PlanProject, fc: ForecastResult): ProjectReport {
  const factors = new Map(fc.months.map((m) => [m.key, m.payFactor]));
  const lastFactor = fc.months[fc.months.length - 1]?.payFactor ?? 1;
  const factorOf = (key: string) => factors.get(key) ?? lastFactor;

  const rolloutLen = Math.max(1, ...p.lines.map((l) => Math.round(l.delayMonths) + Math.max(1, Math.round(l.rampMonths))));
  const length = Math.min(24, Math.max(12, rolloutLen + 6));
  const keys = Array.from({ length }, (_, k) => addToKey(p.startKey, k));
  const months = projectImpact(p, keys, factorOf);
  let running = 0;
  const cumulative = months.map((m) => (running += m.total));
  const steady = steadyState(p);

  // ---- the first 12 months and what they go on
  const year = months.slice(0, 12);
  const parts: CostPart[] = [
    ...p.lines.map((l, i) => ({ label: l.label, amount: sum(year.map((m) => m.linePayroll[i] ?? 0)) })),
    { label: "Non-payroll", amount: sum(year.map((m) => m.nonPayroll)) },
    { label: "Hiring", amount: sum(year.map((m) => m.hiring)) },
    { label: "Set-up and one-time", amount: sum(year.map((m) => m.oneOff)) },
  ].filter((x) => x.amount > 0);
  const firstYearTotal = sum(year.map((m) => m.total));

  // ---- when each branch opens
  const openings: BranchOpening[] = [];
  if (p.rollout) {
    let opened = 0;
    for (const m of months) {
      while (opened < m.branches) {
        opened += 1;
        openings.push({ number: opened, monthKey: m.key });
      }
    }
  }

  const fullStrengthKey = addToKey(p.startKey, rolloutLen - 1);

  // ---- what it does to the whole company, in the months the forecast covers
  const company: CompanyRow[] = [];
  const addRow = (key: string, note: string) => {
    const base = fc.months.find((m) => m.key === key);
    if (!base || company.some((c) => c.key === key)) return;
    const own = projectImpact(p, [key], factorOf)[0];
    company.push({
      key,
      label: monthLabel(key),
      note,
      baselineHeadcount: Math.round(base.headcount),
      withHeadcount: Math.round(base.headcount + own.headcount),
      baselineCost: base.peopleCost,
      withCost: base.peopleCost + own.total,
      changePct: base.peopleCost > 0 ? (own.total / base.peopleCost) * 100 : 0,
    });
  };
  addRow(p.startKey, p.rollout ? "First branches open" : "Project starts");
  addRow(fullStrengthKey, p.rollout ? "All branches open" : "Everyone has joined");
  addRow(addToKey(p.startKey, 12), "A year in");

  // ---- findings
  const insights: string[] = [];
  const peoplePerBranch = p.rollout ? sum(p.rollout.roles.map((r) => Math.max(0, Math.round(r.perBranch)))) : 0;
  if (p.rollout) {
    const where = p.rollout.state.trim() ? ` in ${p.rollout.state.trim()}` : "";
    insights.push(
      `${p.rollout.branches} ${p.rollout.branches === 1 ? "branch" : "branches"}${where}, ${peoplePerBranch} ${peoplePerBranch === 1 ? "person" : "people"} each, is ${steady.people} ${steady.people === 1 ? "person" : "people"} in total. They open evenly over ${p.rollout.months} ${p.rollout.months === 1 ? "month" : "months"}, from ${monthLabel(p.startKey)}.`
    );
    if (steady.perBranch !== null) {
      insights.push(`Once a branch is fully staffed it costs about ${money(steady.perBranch)} a month (${money(steady.perBranch * 12)} a year).`);
    }
  } else {
    insights.push(`${steady.people} ${steady.people === 1 ? "person" : "people"} join from ${monthLabel(p.startKey)}, reaching full strength in ${monthLabel(fullStrengthKey)}.`);
  }
  insights.push(`When everyone is in, the project costs ${money(steady.monthly)} a month, which is ${money(steady.yearly)} a year at today's pay.`);

  const payParts = parts.filter((x) => p.lines.some((l) => l.label === x.label));
  const payTotal = sum(payParts.map((x) => x.amount));
  if (payParts.length > 1 && payTotal > 0) {
    const top = [...payParts].sort((a, b) => b.amount - a.amount)[0];
    insights.push(`${top.label} is the biggest part of the pay bill: ${Math.round((top.amount / payTotal) * 100)}% of the first year's pay.`);
  }
  const setup = parts.find((x) => x.label === "Set-up and one-time")?.amount ?? 0;
  const hiring = parts.find((x) => x.label === "Hiring")?.amount ?? 0;
  insights.push(
    `The first 12 months cost ${money(firstYearTotal)}${
      setup > 0 || hiring > 0
        ? `, including ${[setup > 0 ? `${money(setup)} of set-up` : "", hiring > 0 ? `${money(hiring)} of hiring` : ""].filter(Boolean).join(" and ")}`
        : ""
    }.${firstYearTotal - setup < steady.yearly ? ` Recurring cost is still below a full year at full strength (${money(steady.yearly)}) because people are still joining.` : ""}`
  );

  if (p.rollout && p.rollout.branches > 1) {
    const slower = p.rollout.months * 2;
    const alt = projectImpact(withRollout(p, { months: slower }), keys.slice(0, 12), factorOf);
    const altTotal = sum(alt.map((m) => m.total));
    const diff = firstYearTotal - altTotal;
    if (Math.abs(diff) >= 1) {
      insights.push(
        `Opening them over ${slower} months instead of ${p.rollout.months} would cost ${money(altTotal)} in the first 12 months, which is ${money(Math.abs(diff))} ${diff > 0 ? "less" : "more"}.`
      );
    }
  }

  const all = company.find((c) => c.key === fullStrengthKey);
  if (all) {
    insights.push(
      `With every branch open, the company would have ${all.withHeadcount} people instead of ${all.baselineHeadcount}, and spend ${money(all.withCost)} a month on people instead of ${money(all.baselineCost)} (+${all.changePct.toFixed(1)}%).`
    );
  }

  return { project: p, steady, months, cumulative, firstYear: { total: firstYearTotal, parts }, openings, fullStrengthKey, company, insights };
}

