import { money, pct } from "./financials-format";

// Reads the finance sheet's "Real OG" tab. The tab is laid out for people, not
// machines: one column per month, many blocks stacked down the page, some
// blocks repeated with slightly different numbers, and a few cells typed as
// text ("1,22,93,239"). So rows are found by their LABEL (never by row number),
// every total is rebuilt from its parts, and anything that does not add up is
// reported as a data note instead of being silently trusted.

export interface FinMonth {
  /** 2025-04 */
  key: string;
  /** Apr 2025 */
  label: string;
  /** Apr 25 */
  short: string;
}

/** One value per month, in the same order as `months`; null = left blank. */
export type Series = (number | null)[];

export interface FinLine {
  label: string;
  values: Series;
}

export interface FinDepartment {
  label: string;
  /** Earned gross pay. */
  values: Series;
  /** Incentives paid on top (the sheet keeps them out of its totals). */
  incentives: Series | null;
  /** False for consultants and Kerala housekeeping, which the sheet leaves out of its payroll total. */
  inPayroll: boolean;
}

export interface FinPlace {
  label: string;
  headcount: Series;
  earnedGross: Series;
  ctc: Series;
}

export interface FinancialsData {
  months: FinMonth[];
  /** Last month with both headcount and payroll filled in. */
  latest: number;
  headcount: {
    total: Series;
    branch: Series;
    salesEnablers: Series;
    ho: Series;
    branches: Series;
    female: Series;
    male: Series;
  };
  /** Earned gross pay (what was actually paid), rebuilt from its parts. */
  payroll: { branch: Series; salesEnablers: Series; ho: Series; total: Series };
  /** Cost to company (the budgeted pay). */
  ctc: { branch: Series; salesEnablers: Series; ho: Series; total: Series };
  nonPayroll: { total: Series; items: FinLine[] };
  /** Payroll + non-payroll, rebuilt here. */
  peopleCost: Series;
  departments: FinDepartment[];
  places: FinPlace[];
  /** Things in the sheet worth a second look. */
  notes: string[];
}

// ---------------------------------------------------------------- parsing

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseMonth(header: string): FinMonth | null {
  const m = header.trim().match(/^([A-Za-z]{3,9})[\s\-’']*(\d{2}|\d{4})$/);
  if (!m) return null;
  const idx = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
  if (idx < 0) return null;
  const year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
  const name = MONTH_NAMES[idx];
  return {
    key: `${year}-${String(idx + 1).padStart(2, "0")}`,
    label: `${name} ${year}`,
    short: `${name} ${String(year).slice(2)}`,
  };
}

/** "1,22,93,239" -> 12293239. Blank, dashes and anything else -> null. */
export function parseNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let s = raw.replace(/[₹\s]/g, "").replace(/,/g, "");
  if (s === "" || s === "-" || s === "–") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return negative ? -n : n;
}

/** A number typed as text in the Indian style: 1,22,93,239. */
const COMMA_NUMBER = /^\s*\d{1,3}(,\d{2})*,\d{3}(\.\d+)?\s*$/;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();

interface Row {
  label: string;
  key: string;
  cells: string[];
}

const TYPOS: [RegExp, string][] = [
  [/karmataka/gi, "Karnataka"],
  [/survelliance/gi, "Surveillance"],
  [/revnue/gi, "Revenue"],
  [/accomodation/gi, "Accommodation"],
];
const fixTypos = (s: string) => TYPOS.reduce((acc, [re, to]) => acc.replace(re, to), s);

export function parseFinancials(grid: string[][]): FinancialsData {
  const rows: Row[] = grid.map((cells) => ({ label: (cells[0] ?? "").trim(), key: norm(cells[0] ?? ""), cells }));

  // The header row: a label, then one cell per month.
  const headerRow = grid.find((cells) => parseMonth(cells[1] ?? "") !== null);
  if (!headerRow) throw new Error('No month columns found in the "Real OG" tab (expected headers like "April 2025").');
  const months: FinMonth[] = [];
  for (let c = 1; c < headerRow.length; c++) {
    const month = parseMonth(headerRow[c] ?? "");
    if (!month) break;
    months.push(month);
  }
  const n = months.length;

  const find = (label: string, from = 0): number => {
    const key = norm(label);
    for (let i = from; i < rows.length; i++) if (rows[i].key === key) return i;
    return -1;
  };
  const findStarting = (prefix: string, from = 0): number => {
    const key = norm(prefix);
    for (let i = from; i < rows.length; i++) if (rows[i].key.startsWith(key)) return i;
    return -1;
  };
  const seriesAt = (i: number): Series =>
    i < 0 ? new Array<number | null>(n).fill(null) : months.map((_, m) => parseNumber(rows[i].cells[m + 1]));
  const series = (label: string, from = 0): Series => seriesAt(find(label, from));

  /** The sum of several series; a month stays blank only when every part is blank. */
  const sumSeries = (parts: Series[]): Series =>
    months.map((_, m) => {
      const vals = parts.map((p) => p[m]).filter((v): v is number => v !== null);
      return vals.length === 0 ? null : vals.reduce((a, b) => a + b, 0);
    });

  // ---- headcount
  const headcount = {
    total: series("Total headcount"),
    branch: series("Branch headcount"),
    salesEnablers: series("Sales Enablers headcount"),
    ho: series("HO headcount"),
    branches: series("# of Branches"),
    female: series("Female"),
    male: series("Male"),
  };

  // ---- payroll (earned gross): rebuilt from Branch + Sales Enablers + HO
  const payrollAnchor = find("Payroll Cost");
  const payrollBranch = series("Branch - Earned Gross", Math.max(0, payrollAnchor));
  const payrollSE = series("Sales Enablers - Earned Gross", Math.max(0, payrollAnchor));
  const payrollHO = series("HO - Earned Gross", Math.max(0, payrollAnchor));
  const payroll = {
    branch: payrollBranch,
    salesEnablers: payrollSE,
    ho: payrollHO,
    total: sumSeries([payrollBranch, payrollSE, payrollHO]),
  };

  // ---- CTC
  const ctcBranch = series("Branch - CTC");
  const ctcSE = series("Sales Enablers - CTC");
  const ctcHO = series("HO - CTC");
  const ctc = { branch: ctcBranch, salesEnablers: ctcSE, ho: ctcHO, total: sumSeries([ctcBranch, ctcSE, ctcHO]) };

  // ---- non-payroll cost and its break-up
  const hrCostAnchor = find("HR Cost Breakdown");
  const nonPayrollRow = find("Non-payroll Cost", Math.max(0, hrCostAnchor));
  const breakupAnchor = findStarting("Break-up of Non-payroll", Math.max(0, hrCostAnchor));
  const items: FinLine[] = [];
  if (breakupAnchor >= 0) {
    for (let i = breakupAnchor + 1; i < rows.length; i++) {
      if (!rows[i].label) continue;
      const values = seriesAt(i);
      if (values.every((v) => v === null)) continue; // e.g. a heading with nothing under it yet
      items.push({ label: fixTypos(rows[i].label), values });
    }
  }
  const itemsTotal = sumSeries(items.map((it) => it.values));
  const nonPayrollSheet = seriesAt(nonPayrollRow);
  const nonPayroll = {
    // The sheet's own total row when it has one, else the sum of the break-up.
    total: months.map((_, m) => nonPayrollSheet[m] ?? itemsTotal[m]),
    items,
  };

  // ---- people cost = payroll + non-payroll
  const peopleCost: Series = months.map((_, m) =>
    payroll.total[m] === null && nonPayroll.total[m] === null
      ? null
      : (payroll.total[m] ?? 0) + (nonPayroll.total[m] ?? 0)
  );

  // ---- departments
  const departments: FinDepartment[] = [];
  const deptAnchor = find("Department Wise - Cost");
  if (deptAnchor >= 0) {
    const byName = new Map<string, FinDepartment>();
    for (let i = deptAnchor + 1; i < rows.length; i++) {
      if (!rows[i].label) break; // the unlabeled total row ends the block
      const raw = rows[i].label;
      const isIncentive = /incentive/i.test(raw);
      const name = departmentName(raw);
      const values = seriesAt(i);
      let dept = byName.get(name);
      if (!dept) {
        dept = { label: name, values: new Array<number | null>(n).fill(null), incentives: null, inPayroll: !/consultant|\(kl\)|^kl\b/i.test(name) };
        byName.set(name, dept);
        departments.push(dept);
      }
      if (isIncentive) dept.incentives = values;
      else dept.values = values;
    }
  }

  // ---- places (state + branch/HO): headcount and cost
  const places: FinPlace[] = [];
  const hcAnchor = find("Statewise Headcount");
  const costAnchor = find("Statewise Cost");
  const placeByKey = new Map<string, FinPlace>();
  const empty = () => new Array<number | null>(n).fill(null);
  if (hcAnchor >= 0) {
    const stop = costAnchor > hcAnchor ? costAnchor : rows.length;
    for (let i = hcAnchor + 1; i < stop; i++) {
      if (!rows[i].label) break;
      const label = fixTypos(rows[i].label);
      const place: FinPlace = { label, headcount: seriesAt(i), earnedGross: empty(), ctc: empty() };
      placeByKey.set(norm(label), place);
      places.push(place);
    }
  }
  if (costAnchor >= 0) {
    for (let i = costAnchor + 1; i < rows.length; i++) {
      const m = rows[i].label.match(/^(.*?)\s*(CTC|Earned Gross)\s*$/i);
      if (!m || !m[1].trim()) break; // the plain "Earned Gross" total row ends the block
      const label = fixTypos(m[1].trim());
      let place = placeByKey.get(norm(label));
      if (!place) {
        place = { label, headcount: empty(), earnedGross: empty(), ctc: empty() };
        placeByKey.set(norm(label), place);
        places.push(place);
      }
      if (/ctc/i.test(m[2])) place.ctc = seriesAt(i);
      else place.earnedGross = seriesAt(i);
    }
  }

  // ---- latest month with real data
  let latest = n - 1;
  while (latest > 0 && (headcount.total[latest] === null || payroll.total[latest] === null)) latest--;

  // ---- notes
  const notes: string[] = [];

  const textMonths = months
    .map((mo, m) => ({
      mo,
      count: rows.filter((r) => COMMA_NUMBER.test(r.cells[m + 1] ?? "")).length,
    }))
    .filter((x) => x.count >= 3);
  const totalTextCells = textMonths.reduce((a, x) => a + x.count, 0);
  // Only when a few months stand out; a sheet that shows commas everywhere is just formatted that way.
  if (textMonths.length > 0 && textMonths.length <= 3 && totalTextCells > 0) {
    const list = textMonths.map((x) => `${x.mo.label} (${x.count} cells)`).join(", ");
    notes.push(
      `${list} ${textMonths.length === 1 ? "has" : "have"} numbers typed as text, like 1,22,93,239. They are read correctly here, but the sheet's own formulas treat text as zero, so its totals for ${
        textMonths.length === 1 ? "that month" : "those months"
      } come out far too low. Retype them as plain numbers in the sheet.`
    );
  }

  const sheetPeopleCost = seriesAt(findStarting("Total People Cost"));
  const peopleDiff = months
    .map((mo, m) => ({ mo, sheet: sheetPeopleCost[m], mine: peopleCost[m] }))
    .filter((x) => x.sheet !== null && x.mine !== null && x.mine > 0 && Math.abs(x.sheet - x.mine) / x.mine > 0.02);
  if (peopleDiff.length > 0) {
    notes.push(
      `The sheet's own "Total People Cost" does not match payroll + non-payroll in ${peopleDiff
        .map((x) => `${x.mo.label} (sheet ${money(x.sheet)}, parts add up to ${money(x.mine)})`)
        .join("; ")}. This tab uses the sum of the parts.`
    );
  }

  const costBlockTotal = seriesAt(find("Earned Gross Total", Math.max(0, find("Cost")) + 1));
  const blockDiff = months.filter((_, m) => {
    const a = payroll.total[m];
    const b = costBlockTotal[m];
    return a !== null && b !== null && a > 0 && Math.abs(a - b) / a > 0.005;
  });
  if (blockDiff.length > 0) {
    notes.push(
      `The sheet shows two different earned-gross totals for ${blockDiff
        .map((x) => x.label)
        .join(", ")} (the "Payroll Cost" block and the "Cost" block). This tab uses the "Payroll Cost" block.`
    );
  }

  const placeTotal = sumSeries(places.map((p) => p.headcount));
  const hcMismatch = months.filter((_, m) => placeTotal[m] !== null && headcount.total[m] !== null && placeTotal[m] !== headcount.total[m]);
  if (hcMismatch.length > 0) {
    notes.push(
      `Headcount by state adds up to a different number than total headcount in ${hcMismatch
        .map((x) => {
          const m = months.indexOf(x);
          return `${x.label} (${placeTotal[m]} vs ${headcount.total[m]})`;
        })
        .join(", ")}.`
    );
  }

  const partsMismatch = months.filter((_, m) => {
    const parts = [headcount.branch[m], headcount.salesEnablers[m], headcount.ho[m]];
    const t = headcount.total[m];
    return t !== null && parts.every((p) => p !== null) && (parts as number[]).reduce((a, b) => a + b, 0) !== t;
  });
  if (partsMismatch.length > 0) {
    notes.push(`Branch + Sales Enablers + HO headcount does not equal total headcount in ${partsMismatch.map((x) => x.label).join(", ")}.`);
  }

  const swings: string[] = [];
  for (const [name, s] of [["Branch", headcount.branch], ["Sales Enablers", headcount.salesEnablers], ["HO", headcount.ho]] as const) {
    for (let m = 1; m < n; m++) {
      const a = s[m - 1];
      const b = s[m];
      if (a !== null && b !== null && a >= 20 && Math.abs(b - a) / a > 0.35) {
        swings.push(`${name} ${months[m].label} (${a} → ${b})`);
      }
    }
  }
  if (swings.length > 0) {
    notes.push(
      `Team headcount swings sharply in ${swings.join(", ")}. That usually means people were counted under a different team that month rather than hired or lost, so cost per head by team is skewed in those months.`
    );
  }

  const noGender = months.filter((_, m) => headcount.total[m] !== null && headcount.female[m] === null && headcount.male[m] === null);
  if (noGender.length > 0) notes.push(`Female and male headcount is blank for ${noGender.map((x) => x.label).join(", ")}.`);

  const fractional = headcount.female.some((v) => v !== null && !Number.isInteger(v));
  if (fractional) {
    notes.push("Some female headcount values have decimals (for example 55.75), so they look like averages rather than head counts.");
  }

  const revenueRow = findStarting("Total Turnover");
  if (revenueRow >= 0 && seriesAt(revenueRow).every((v) => v === null)) {
    notes.push('"Total Turnover (Revenue)" is empty in the sheet, so revenue per employee and revenue-to-cost are not shown.');
  }

  const incentiveMonths = months.filter((_, m) => departments.some((d) => (d.incentives?.[m] ?? 0) > 0));
  const incentiveTotal = departments.reduce((a, d) => a + (d.incentives ?? []).reduce<number>((s, v) => s + (v ?? 0), 0), 0);
  if (incentiveMonths.length > 0) {
    notes.push(
      `Incentives (${money(incentiveTotal)} across ${incentiveMonths.length} months) and consultants are not part of the sheet's payroll totals, so they are not part of the people cost here either. They are shown separately under Departments.`
    );
  }

  const spike = peopleCost
    .map((v, m) => ({ m, v, prev: m > 0 ? peopleCost[m - 1] : null }))
    .filter((x) => x.v !== null && x.prev !== null && x.prev > 0 && (x.v as number) / x.prev > 1.25 && x.m > 0);
  if (spike.length > 0) {
    notes.push(
      `People cost jumps by more than a quarter in ${spike
        .map((x) => `${months[x.m].label} (${pct((((x.v as number) - (x.prev as number)) / (x.prev as number)) * 100, 0)})`)
        .join(", ")}. Worth checking that the month is not carrying one-off or catch-up pay.`
    );
  }

  return { months, latest, headcount, payroll, ctc, nonPayroll, peopleCost, departments, places, notes };
}

/** "HO - KYC - Incentives" and "HO - KYC - Earned Gross" are both "KYC". */
function departmentName(raw: string): string {
  let s = fixTypos(raw)
    .replace(/^cost\s*-\s*/i, "")
    .replace(/\s*-?\s*earned gross\s*$/i, "")
    .replace(/\s*-?\s*incentives?\s*$/i, "")
    .replace(/^ho\s*-\s*/i, "")
    .trim();
  if (/^branch$/i.test(s)) s = "Branch";
  return s || raw.trim();
}
