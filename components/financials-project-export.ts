import type { Cell, SheetData } from "write-excel-file/browser";
import type { ForecastResult } from "@/lib/metrics/financials-forecast";
import { PROJECT_KINDS } from "@/lib/metrics/financials-projects";
import { monthLabel, type ProjectReport } from "@/lib/metrics/financials-project-report";

// The project as an Excel workbook. It is loaded only when someone clicks Export, so the
// page itself does not carry it. Amounts are plain rupee numbers (not text like "₹1.2 Cr"),
// so they can be summed, charted and changed in Excel.

const BLUE = "#1e50cc";
const RUPEES = "#,##0";

const head = (value: string): Cell => ({ value, fontWeight: "bold", textColor: "#ffffff", backgroundColor: BLUE, wrap: true, alignVertical: "center" });
const label = (value: string): Cell => ({ value, fontWeight: "bold" });
const text = (value: string): Cell => ({ value, wrap: true, alignVertical: "top" });
const rupees = (value: number, bold = false): Cell => ({ value: Math.round(value), type: Number, format: RUPEES, ...(bold ? { fontWeight: "bold" as const } : {}) });
const whole = (value: number): Cell => ({ value: Math.round(value), type: Number, format: "#,##0" });
const percent = (value: number): Cell => ({ value: Math.round(value * 10) / 10, type: Number, format: "0.0" });

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "project";

/** The workbook as a file in memory. */
export async function projectWorkbook(report: ProjectReport, fc: ForecastResult, basedOn: string): Promise<Blob> {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const p = report.project;
  const ro = p.rollout;
  const kind = PROJECT_KINDS.find((k) => k.key === p.kind)?.label ?? "Project";
  const forecastByKey = new Map(fc.months.map((m) => [m.key, m]));

  // ---- Summary
  const summary: SheetData = [
    [{ value: p.name, fontWeight: "bold", fontSize: 16 }],
    [text(`${kind}, starting ${monthLabel(p.startKey)}. Amounts are in rupees.`)],
    [],
    [head("Key numbers"), head("")],
    [label("People at full strength"), whole(report.steady.people)],
    ...(ro ? [[label("Branches"), whole(ro.branches)], [label("Opening over (months)"), whole(ro.months)]] : []),
    [label("Cost a month once everyone is in"), rupees(report.steady.monthly)],
    [label("Cost a year at that pace (today's pay)"), rupees(report.steady.yearly)],
    [label("First 12 months, everything included"), rupees(report.firstYear.total)],
    ...(report.steady.perBranch !== null ? [[label("Cost per branch a month, fully staffed"), rupees(report.steady.perBranch)]] : []),
    [],
    [head("Who joins"), head(ro ? "Per branch" : "People"), head("Pay per person a month"), head("People in total")],
    ...p.lines.map((l): Cell[] => [text(l.label), whole(ro ? l.unit ?? 0 : l.people), rupees(l.payPerHead), whole(l.people)]),
    [],
    [head("Other assumptions"), head("")],
    [label("Non-payroll per person a month"), rupees(p.nonPayrollPerHead)],
    [label("Cost to hire one person"), rupees(p.hireCost)],
    ...(ro ? [[label("Set-up cost per branch"), rupees(ro.setupPerBranch)]] : []),
    [label("Pay rises with the forecast's pay rise"), text(p.payRise ? "Yes" : "No")],
    ...p.oneOffs.filter((o) => o.amount > 0).map((o): Cell[] => [label(`One-time: ${o.label} (${monthLabel(o.monthKey)})`), rupees(o.amount)]),
    [],
    [head("What the numbers say")],
    ...report.insights.map((t): Cell[] => [text(t)]),
    [],
    [text(`An estimate, not a budget. ${basedOn} Incentives, consultants and settlements are not included.`)],
  ];

  // ---- Month by month
  const roleHeads = p.lines.map((l) => head(`${l.label} pay`));
  const monthly: SheetData = [
    [
      head("Month"),
      ...(ro ? [head("Branches open")] : []),
      head("People"),
      ...roleHeads,
      head("Pay total"),
      head("Non-payroll"),
      head("Hiring"),
      head("Set-up and one-time"),
      head("Project total"),
      head("Running total"),
      head("Company forecast without project"),
      head("Company forecast with project"),
    ],
    ...report.months.map((m, i): Cell[] => {
      const base = forecastByKey.get(m.key);
      return [
        text(monthLabel(m.key)),
        ...(ro ? [whole(m.branches)] : []),
        whole(m.headcount),
        ...p.lines.map((_, k) => rupees(m.linePayroll[k] ?? 0)),
        rupees(m.payroll),
        rupees(m.nonPayroll),
        rupees(m.hiring),
        rupees(m.oneOff),
        rupees(m.total, true),
        rupees(report.cumulative[i]),
        base ? rupees(base.peopleCost) : null,
        base ? rupees(base.peopleCost + m.total) : null,
      ];
    }),
  ];

  // ---- Branch rollout
  const rollout: SheetData | null = ro
    ? [
        [head("Branch"), head("Opens in"), head("People on its team")],
        ...report.openings.map((o): Cell[] => [whole(o.number), text(monthLabel(o.monthKey)), whole(ro.roles.reduce((a, r) => a + Math.max(0, Math.round(r.perBranch)), 0))]),
      ]
    : null;

  // ---- Company impact
  const company: SheetData = [
    [head("Month"), head("What it is"), head("People without"), head("People with"), head("Monthly people cost without"), head("Monthly people cost with"), head("Change %")],
    ...report.company.map((c): Cell[] => [
      text(c.label),
      text(c.note),
      whole(c.baselineHeadcount),
      whole(c.withHeadcount),
      rupees(c.baselineCost),
      rupees(c.withCost),
      percent(c.changePct),
    ]),
  ];

  const width = (n: number) => ({ width: n });
  const sheets = [
    { data: summary, sheet: "Summary", columns: [width(46), width(18), width(24), width(18)] },
    {
      data: monthly,
      sheet: "Month by month",
      columns: Array.from({ length: (monthly[0] ?? []).length }, (_, i) => width(i === 0 ? 14 : 17)),
      stickyRowsCount: 1,
      stickyColumnsCount: 1,
    },
    ...(rollout ? [{ data: rollout, sheet: "Branch rollout", columns: [width(10), width(16), width(20)], stickyRowsCount: 1 }] : []),
    { data: company, sheet: "Company impact", columns: [width(14), width(22), width(16), width(14), width(26), width(26), width(12)], stickyRowsCount: 1 },
  ];

  return writeExcelFile(sheets).toBlob();
}

/** Builds the workbook and hands it to the browser as a download. */
export async function downloadProjectExcel(report: ProjectReport, fc: ForecastResult, basedOn: string): Promise<void> {
  const blob = await projectWorkbook(report, fc, basedOn);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName(report.project.name)} - forecast.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
