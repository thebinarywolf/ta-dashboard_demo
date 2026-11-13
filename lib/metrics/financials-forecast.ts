import type { FinMonth, FinancialsData, Series } from "./financials-parse";

// A forecast of people cost that can be explained in one breath:
//
//   people cost = headcount x pay per head  +  headcount x non-payroll per head
//
// Each driver is read off the recent past in a way that one odd month cannot
// swing it (medians, not averages), and each can be changed by hand to ask
// "what if we hire faster?". The "likely range" comes from how wrong the same
// method would have been one month ahead over the last few months.

const WINDOW = 6;
const BACKTEST_MONTHS = 6;

export interface ForecastInputs {
  /** People added each month. */
  hiresPerMonth: number;
  /** Change in pay per head, in percent a month. */
  payGrowthPct: number;
}

export interface ForecastDrivers extends ForecastInputs {
  lastHeadcount: number;
  /** Pay per head today (median of the last 3 months, so one odd month does not move it). */
  payPerHead: number;
  /** Non-payroll cost per head per month (median of the last 6 months). */
  nonPayrollPerHead: number;
}

export interface ForecastMonth extends FinMonth {
  /** The forecast's cumulative pay rise by this month (1 = today's pay). */
  payFactor: number;
  headcount: number;
  payroll: number;
  nonPayroll: number;
  peopleCost: number;
  /** Likely range around peopleCost. */
  low: number;
  high: number;
}

export interface FiscalYearOutlook {
  label: string;
  actual: number;
  forecast: number;
  total: number;
  actualMonths: number;
  forecastMonths: number;
}

export interface ForecastResult {
  drivers: ForecastDrivers;
  /** The same drivers with no hand changes: what the recent trend says. */
  trend: ForecastInputs;
  months: ForecastMonth[];
  /** Average % miss of this method, one month ahead, over the last few months. Null if there is too little history. */
  mape: number | null;
  /** How many months that miss was measured over. */
  mapeMonths: number;
  fiscalYear: FiscalYearOutlook | null;
  /** Extra people cost over the next 6 months for every 10 extra hires a month. */
  tenHiresCost: number | null;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function addMonths(m: FinMonth, by: number): FinMonth {
  const [y, mo] = m.key.split("-").map(Number);
  const t = y * 12 + (mo - 1) + by;
  const year = Math.floor(t / 12);
  const idx = t % 12;
  return {
    key: `${year}-${String(idx + 1).padStart(2, "0")}`,
    label: `${MONTH_NAMES[idx]} ${year}`,
    short: `${MONTH_NAMES[idx]} ${String(year).slice(2)}`,
  };
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

const ratio = (a: Series, b: Series, i: number): number | null => (a[i] !== null && b[i] ? (a[i] as number) / (b[i] as number) : null);
const valid = (xs: (number | null)[]): number[] => xs.filter((v): v is number => v !== null && Number.isFinite(v));

/** What the recent past says, as of the month at `origin`. Null when there is not enough to go on. */
export function trendDrivers(d: FinancialsData, origin: number): ForecastDrivers | null {
  const hc = d.headcount.total;
  const lastHeadcount = hc[origin];
  if (lastHeadcount === null || lastHeadcount === undefined) return null;

  const from = Math.max(1, origin - WINDOW + 1);
  const changes: number[] = [];
  for (let i = from; i <= origin; i++) {
    if (hc[i] !== null && hc[i - 1] !== null) changes.push((hc[i] as number) - (hc[i - 1] as number));
  }
  const hires = mean(changes);

  const pph = (i: number) => ratio(d.payroll.total, hc, i);
  const last3 = valid([origin - 2, origin - 1, origin].filter((i) => i >= 0).map(pph));
  const payPerHead = median(last3);

  const recent = median(valid(Array.from({ length: WINDOW }, (_, k) => origin - k).filter((i) => i >= 0).map(pph)));
  const before = median(valid(Array.from({ length: WINDOW }, (_, k) => origin - WINDOW - k).filter((i) => i >= 0).map(pph)));
  let growth = 0;
  if (recent !== null && before !== null && before > 0 && origin - 2 * WINDOW + 1 >= 0) {
    growth = (Math.pow(recent / before, 1 / WINDOW) - 1) * 100;
  }
  // A guard rail: no more than a few percent a month either way, whatever the sheet says.
  growth = Math.max(-2, Math.min(3, growth));

  const npph = median(
    valid(Array.from({ length: WINDOW }, (_, k) => origin - k).filter((i) => i >= 0).map((i) => ratio(d.nonPayroll.total, hc, i)))
  );

  if (hires === null || payPerHead === null || npph === null) return null;
  return {
    lastHeadcount,
    hiresPerMonth: Math.round(hires * 10) / 10,
    payGrowthPct: Math.round(growth * 10) / 10,
    payPerHead,
    nonPayrollPerHead: npph,
  };
}

interface Step {
  payFactor: number;
  headcount: number;
  payroll: number;
  nonPayroll: number;
  peopleCost: number;
}

/** Each month's rise in pay per head is this share of the month before it, so a recent climb does not run on forever. */
export const PAY_GROWTH_FADE = 0.8;

/** The central line: step 1 is the month after the origin. */
function project(drivers: ForecastDrivers, inputs: ForecastInputs, steps: number): Step[] {
  const out: Step[] = [];
  let payFactor = 1;
  for (let t = 1; t <= steps; t++) {
    const headcount = Math.max(0, drivers.lastHeadcount + inputs.hiresPerMonth * t);
    payFactor *= 1 + (inputs.payGrowthPct / 100) * Math.pow(PAY_GROWTH_FADE, t - 1);
    const payroll = headcount * drivers.payPerHead * payFactor;
    const nonPayroll = headcount * drivers.nonPayrollPerHead;
    out.push({ payFactor, headcount, payroll, nonPayroll, peopleCost: payroll + nonPayroll });
  }
  return out;
}

/** Runs the method as if it were an earlier month, and measures how far off its next-month call was. */
function backtest(d: FinancialsData, latest: number): { mape: number | null; months: number } {
  const errors: number[] = [];
  for (let origin = latest - BACKTEST_MONTHS; origin < latest; origin++) {
    if (origin < 3) continue;
    const actual = d.peopleCost[origin + 1];
    const drivers = trendDrivers(d, origin);
    if (!drivers || actual === null || !(actual > 0)) continue;
    const predicted = project(drivers, drivers, 1)[0].peopleCost;
    errors.push(Math.abs(predicted - actual) / actual);
  }
  const m = mean(errors);
  return { mape: m === null ? null : m * 100, months: errors.length };
}

/**
 * The forecast from the latest actual month. Pass `inputs` to override the
 * trend (hand-set hiring pace or pay growth); leave it out for the trend itself.
 */
export function buildForecast(d: FinancialsData, steps: number, inputs?: Partial<ForecastInputs>): ForecastResult | null {
  const base = trendDrivers(d, d.latest);
  if (!base) return null;
  const trend: ForecastInputs = { hiresPerMonth: base.hiresPerMonth, payGrowthPct: base.payGrowthPct };
  const use: ForecastInputs = { ...trend, ...inputs };
  const drivers: ForecastDrivers = { ...base, ...use };

  const { mape, months: mapeMonths } = backtest(d, d.latest);
  const origin = d.months[d.latest];
  const spread = (t: number) => (mape === null ? 0 : Math.min(0.6, (mape / 100) * Math.sqrt(t)));
  const months: ForecastMonth[] = project(drivers, use, steps).map((s, k) => ({
    ...addMonths(origin, k + 1),
    ...s,
    low: s.peopleCost * (1 - spread(k + 1)),
    high: s.peopleCost * (1 + spread(k + 1)),
  }));

  // The financial year (April to March) that the next month falls in.
  let fiscalYear: FiscalYearOutlook | null = null;
  const next = addMonths(origin, 1);
  const [ny, nm] = next.key.split("-").map(Number);
  const fyStart = nm >= 4 ? ny : ny - 1;
  const monthsLeft = (fyStart + 1) * 12 + 2 - (ny * 12 + (nm - 1)) + 1; // months from `next` to the end of March
  if (monthsLeft >= 1 && monthsLeft <= 12) {
    const inFy = d.months
      .map((m, i) => ({ m, i }))
      .filter(({ m, i }) => i <= d.latest && m.key >= `${fyStart}-04` && m.key <= `${fyStart + 1}-03`);
    const actual = inFy.reduce((a, { i }) => a + (d.peopleCost[i] ?? 0), 0);
    const forecast = project(drivers, use, monthsLeft).reduce((a, s) => a + s.peopleCost, 0);
    fiscalYear = {
      label: `FY ${fyStart}-${String(fyStart + 1).slice(2)}`,
      actual,
      forecast,
      total: actual + forecast,
      actualMonths: inFy.length,
      forecastMonths: monthsLeft,
    };
  }

  const six = (extra: number) =>
    project(drivers, { ...use, hiresPerMonth: use.hiresPerMonth + extra }, 6).reduce((a, s) => a + s.peopleCost, 0);
  const tenHiresCost = six(10) - six(0);

  return { drivers, trend, months, mape, mapeMonths, fiscalYear, tenHiresCost };
}
