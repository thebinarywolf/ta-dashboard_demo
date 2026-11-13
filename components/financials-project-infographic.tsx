"use client";

import { GLASS_PANEL } from "@/components/glass-card";
import { CATEGORICAL, Donut, MonthChart, PAL, Panel, axisMoney, type ChartSeries, type Slice } from "@/components/financials-charts";
import { count, money, moneyFull } from "@/lib/metrics/financials-format";
import type { FinMonth } from "@/lib/metrics/financials-parse";
import { PROJECT_KINDS } from "@/lib/metrics/financials-projects";
import { monthLabel, monthShort, type ProjectReport } from "@/lib/metrics/financials-project-report";

// Blue, orange, aqua, magenta, green, red: one colour per role, the same in every chart.
const ROLE_COLORS = [PAL.blue, PAL.orange, PAL.aqua, PAL.magenta, PAL.green, PAL.red];
const roleColor = (i: number) => ROLE_COLORS[i % ROLE_COLORS.length];
const NON_PAYROLL = PAL.grey;
const HIRING = PAL.yellow;
const SETUP = PAL.violet;

/** The colour for a cost part of the first year, matching the stacked chart. */
function partColor(report: ProjectReport, label: string): string {
  const i = report.project.lines.findIndex((l) => l.label === label);
  if (i >= 0) return roleColor(i);
  if (label === "Non-payroll") return NON_PAYROLL;
  if (label === "Hiring") return HIRING;
  return SETUP;
}

const noop = () => {};

function windowMonths(report: ProjectReport): FinMonth[] {
  return report.months.map((m) => ({ key: m.key, label: monthLabel(m.key), short: monthShort(m.key) }));
}

function Big({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={`${GLASS_PANEL} min-w-0 p-4`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xl font-extrabold text-[#0e1b3d] sm:text-2xl">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------- pieces

/** The six numbers that sum the project up. */
export function HeroNumbers({ report }: { report: ProjectReport }) {
  const p = report.project;
  const s = report.steady;
  const ro = p.rollout;
  const perBranch = ro ? ro.roles.reduce((a, r) => a + Math.max(0, Math.round(r.perBranch)), 0) : 0;
  const cards = ro
    ? [
        { label: "Branches", value: count(ro.branches), sub: ro.state.trim() ? ro.state.trim() : undefined },
        { label: "People", value: count(s.people), sub: `${count(ro.branches)} × ${perBranch} per branch` },
        { label: "Opening over", value: `${count(ro.months)} ${ro.months === 1 ? "month" : "months"}`, sub: `from ${monthLabel(p.startKey)}` },
        { label: "Full strength", value: money(s.monthly), sub: "a month" },
        { label: "First 12 months", value: money(report.firstYear.total), sub: "everything included" },
        { label: "Per branch", value: s.perBranch === null ? "–" : money(s.perBranch), sub: "a month, fully staffed" },
      ]
    : [
        { label: "People", value: count(s.people), sub: `${p.lines.length} ${p.lines.length === 1 ? "group" : "groups"}` },
        { label: "Starts", value: monthLabel(p.startKey), sub: `full strength ${monthLabel(report.fullStrengthKey)}` },
        { label: "Full strength", value: money(s.monthly), sub: "a month" },
        { label: "A year at that pace", value: money(s.yearly), sub: "at today's pay" },
        { label: "First 12 months", value: money(report.firstYear.total), sub: "everything included" },
        { label: "Per person", value: s.perPerson === null ? "–" : money(s.perPerson), sub: "a month" },
      ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cards.map((c) => (
        <Big key={c.label} {...c} />
      ))}
    </div>
  );
}

/** A small branch building. */
function BranchIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
      <path d="M3 10.5 12 4l9 6.5" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="5" y="10" width="14" height="10" rx="1.5" fill={color} opacity="0.18" stroke={color} strokeWidth="1.6" />
      <rect x="10.5" y="14" width="3" height="6" rx="0.8" fill={color} />
    </svg>
  );
}

const MAX_TILES = 40;

/** How the rollout looks: a tile for each branch, in the month it opens, with a dot for each person on its team. */
export function RolloutVisual({ report }: { report: ProjectReport }) {
  const ro = report.project.rollout;
  if (!ro) {
    const months = windowMonths(report);
    return (
      <Panel title="When people join" hint="Headcount added by the project, month by month" className="print-avoid">
        <MonthChart
          months={months}
          idx={months.map((_, i) => i)}
          kind="bar"
          focus={-1}
          onFocus={noop}
          fmt={count}
          height={200}
          series={[{ key: "hc", label: "People", color: PAL.brand, values: report.months.map((m) => m.headcount) }]}
        />
      </Panel>
    );
  }
  const shown = report.openings.slice(0, MAX_TILES);
  const dots = ro.roles.flatMap((role, i) => Array.from({ length: Math.min(6, Math.max(0, Math.round(role.perBranch))) }, () => i));
  return (
    <Panel
      title="How the rollout looks"
      hint={`Each tile is a branch, shown in the month it opens. The dots are its team.`}
      className="print-avoid"
    >
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
        {ro.roles.map((role, i) => (
          <span key={role.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: roleColor(i) }} />
            {role.label}
            {role.perBranch !== 1 ? ` × ${role.perBranch}` : ""}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {shown.map((o) => (
          <div key={o.number} className="rounded-2xl border border-blue-100 bg-white/80 px-2 py-2 text-center">
            <div className="flex justify-center">
              <BranchIcon color={PAL.brand} />
            </div>
            <p className="mt-0.5 text-[10px] font-bold text-[#0e1b3d]">Branch {o.number}</p>
            <p className="text-[10px] font-semibold text-brand-blue">{monthShort(o.monthKey)}</p>
            <div className="mt-1 flex flex-wrap justify-center gap-[3px]">
              {dots.map((ri, k) => (
                <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: roleColor(ri) }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {report.openings.length > MAX_TILES && (
        <p className="mt-2 text-[11px] text-slate-400">and {report.openings.length - MAX_TILES} more branches after these.</p>
      )}
    </Panel>
  );
}

/** Month-by-month cost, and the running total. */
export function CostCharts({ report, height = 260 }: { report: ProjectReport; height?: number }) {
  const p = report.project;
  const months = windowMonths(report);
  const idx = months.map((_, i) => i);
  const series: ChartSeries[] = [
    ...p.lines.map((l, i) => ({ key: `r${i}`, label: l.label, color: roleColor(i), values: report.months.map((m) => m.linePayroll[i] ?? 0) })),
    { key: "np", label: "Non-payroll", color: NON_PAYROLL, values: report.months.map((m) => m.nonPayroll) },
    { key: "hire", label: "Hiring", color: HIRING, values: report.months.map((m) => m.hiring) },
    { key: "one", label: "Set-up and one-time", color: SETUP, values: report.months.map((m) => m.oneOff) },
  ].filter((s) => s.values.some((v) => v > 0));
  return (
    <>
      <Panel title="What it costs each month" hint="Pay by role, plus non-payroll, hiring and set-up. It climbs as branches open." className="print-avoid">
        <MonthChart months={months} idx={idx} kind="stack" focus={-1} onFocus={noop} fmt={money} axisFmt={axisMoney} height={height} series={series} />
      </Panel>
      <Panel title="Total spent so far" hint="Everything the project has cost, added up month by month" className="print-avoid">
        <MonthChart
          months={months}
          idx={idx}
          kind="area"
          focus={-1}
          onFocus={noop}
          fmt={money}
          axisFmt={axisMoney}
          height={Math.round(height * 0.8)}
          series={[{ key: "cum", label: "Spent so far", color: PAL.brand, values: report.cumulative }]}
        />
      </Panel>
    </>
  );
}

/** Where the first year's money goes. */
export function CostSplit({ report }: { report: ProjectReport }) {
  const slices: Slice[] = report.firstYear.parts.map((x) => ({ label: x.label, value: x.amount, color: partColor(report, x.label) }));
  return (
    <Panel title="Where the first 12 months go" hint="Hover a slice to read it" className="print-avoid">
      <Donut slices={slices} fmt={money} centerLabel="First 12 months" />
    </Panel>
  );
}

/** What the project does to the whole company's people cost. */
export function CompanyImpact({ report }: { report: ProjectReport }) {
  if (report.company.length === 0) return null;
  return (
    <Panel title="What it does to the company" hint="The forecast's people and monthly people cost, with and without the project" className="print-avoid">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200/70 text-[10px] uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2">Month</th>
              <th className="px-2 py-2 text-right">People</th>
              <th className="px-2 py-2 text-right">Monthly people cost</th>
              <th className="px-2 py-2 text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {report.company.map((c) => (
              <tr key={c.key} className="border-b border-slate-100 last:border-0">
                <th className="px-2 py-2 font-semibold text-[#0e1b3d]">
                  {c.label}
                  <span className="block text-[10px] font-normal text-slate-400">{c.note}</span>
                </th>
                <td className="px-2 py-2 text-right tabular-nums">
                  {count(c.baselineHeadcount)} <span className="text-slate-400">→</span> <b className="text-[#0e1b3d]">{count(c.withHeadcount)}</b>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {money(c.baselineCost)} <span className="text-slate-400">→</span> <b className="text-[#0e1b3d]">{money(c.withCost)}</b>
                </td>
                <td className="px-2 py-2 text-right font-bold tabular-nums" style={{ color: PAL.orange }}>
                  +{c.changePct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** The plain-English findings. */
export function Findings({ report }: { report: ProjectReport }) {
  return (
    <Panel title="What the numbers say" className="print-avoid">
      <ul className="space-y-2">
        {report.insights.map((t) => (
          <li key={t} className="flex gap-2 text-xs leading-relaxed text-[#0e1b3d]">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The infographic as it appears in the builder. */
export default function ProjectInfographic({ report }: { report: ProjectReport }) {
  return (
    <div className="space-y-4">
      <HeroNumbers report={report} />
      <RolloutVisual report={report} />
      <CostCharts report={report} />
      <div className="grid gap-4 xl:grid-cols-2">
        <CostSplit report={report} />
        <Findings report={report} />
      </div>
      <CompanyImpact report={report} />
    </div>
  );
}

// ------------------------------------------------------------------ PDF

function Assumptions({ report }: { report: ProjectReport }) {
  const p = report.project;
  const ro = p.rollout;
  return (
    <Panel title="The assumptions behind it" hint="Change any of these in the project and the numbers update" className="print-avoid">
      <div className="space-y-3 text-xs text-slate-600">
        {ro && (
          <p>
            <b className="text-[#0e1b3d]">Rollout:</b> {count(ro.branches)} {ro.branches === 1 ? "branch" : "branches"}
            {ro.state.trim() ? ` in ${ro.state.trim()}` : ""}, opening evenly over {count(ro.months)} {ro.months === 1 ? "month" : "months"} from{" "}
            {monthLabel(p.startKey)}.
          </p>
        )}
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-200/70 text-[10px] uppercase tracking-wide text-slate-500">
              <th className="py-1.5 pr-2">{ro ? "Role" : "Group"}</th>
              <th className="py-1.5 pr-2 text-right">{ro ? "Per branch" : "People"}</th>
              <th className="py-1.5 pr-2 text-right">Pay per person a month</th>
              <th className="py-1.5 text-right">People in total</th>
            </tr>
          </thead>
          <tbody>
            {p.lines.map((l, i) => (
              <tr key={l.id} className="border-b border-slate-100 last:border-0">
                <th className="py-1.5 pr-2 font-semibold text-[#0e1b3d]">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: roleColor(i) }} />
                  {l.label}
                </th>
                <td className="py-1.5 pr-2 text-right tabular-nums">{ro ? count(l.unit ?? 0) : count(l.people)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{moneyFull(l.payPerHead)}</td>
                <td className="py-1.5 text-right tabular-nums">{count(l.people)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Non-payroll {moneyFull(p.nonPayrollPerHead)} per person a month · hiring {moneyFull(p.hireCost)} per person
          {ro ? ` · set-up ${moneyFull(ro.setupPerBranch)} per branch` : ""} · pay {p.payRise ? "rises with" : "does not rise with"} the forecast&apos;s pay rise.
        </p>
        {p.oneOffs.filter((o) => o.amount > 0).length > 0 && (
          <p>
            One-time costs:{" "}
            {p.oneOffs
              .filter((o) => o.amount > 0)
              .map((o) => `${o.label} ${moneyFull(o.amount)} (${monthLabel(o.monthKey)})`)
              .join(" · ")}
          </p>
        )}
      </div>
    </Panel>
  );
}

function MonthTable({ report }: { report: ProjectReport }) {
  const p = report.project;
  return (
    <Panel title="Month by month" className="print-avoid">
      <table className="w-full text-left text-[10px]">
        <thead>
          <tr className="border-b border-slate-200/70 uppercase tracking-wide text-slate-500">
            <th className="py-1.5 pr-1">Month</th>
            {p.rollout && <th className="py-1.5 pr-1 text-right">Branches</th>}
            <th className="py-1.5 pr-1 text-right">People</th>
            <th className="py-1.5 pr-1 text-right">Pay</th>
            <th className="py-1.5 pr-1 text-right">Non-payroll</th>
            <th className="py-1.5 pr-1 text-right">Hiring</th>
            <th className="py-1.5 pr-1 text-right">Set-up</th>
            <th className="py-1.5 pr-1 text-right">Total</th>
            <th className="py-1.5 text-right">Running total</th>
          </tr>
        </thead>
        <tbody>
          {report.months.map((m, i) => (
            <tr key={m.key} className="border-b border-slate-100 last:border-0">
              <th className="py-1 pr-1 font-semibold text-[#0e1b3d]">{monthLabel(m.key)}</th>
              {p.rollout && <td className="py-1 pr-1 text-right tabular-nums">{count(m.branches)}</td>}
              <td className="py-1 pr-1 text-right tabular-nums">{count(m.headcount)}</td>
              <td className="py-1 pr-1 text-right tabular-nums">{money(m.payroll)}</td>
              <td className="py-1 pr-1 text-right tabular-nums">{money(m.nonPayroll)}</td>
              <td className="py-1 pr-1 text-right tabular-nums">{m.hiring > 0 ? money(m.hiring) : "–"}</td>
              <td className="py-1 pr-1 text-right tabular-nums">{m.oneOff > 0 ? money(m.oneOff) : "–"}</td>
              <td className="py-1 pr-1 text-right font-bold tabular-nums text-[#0e1b3d]">{money(m.total)}</td>
              <td className="py-1 text-right tabular-nums">{money(report.cumulative[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/**
 * The page that is printed (and saved as a PDF). It sits off-screen at the width of
 * an A4 page so the charts are laid out properly, and is the only thing the print
 * styles in globals.css leave visible.
 */
export function PrintReport({ report, basedOn }: { report: ProjectReport; basedOn: string }) {
  const p = report.project;
  const kind = PROJECT_KINDS.find((k) => k.key === p.kind)?.label ?? "Project";
  const prepared = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div id="project-print-root" className="space-y-4 bg-white p-0 text-[#0e1b3d]">
      <header className="flex items-end justify-between border-b-2 border-brand-blue pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-brand-blue">White Gold · people cost planning</p>
          <h1 className="text-2xl font-extrabold">{p.name}</h1>
          <p className="text-xs text-slate-500">
            {kind} · starts {monthLabel(p.startKey)} · amounts in rupees
          </p>
        </div>
        <p className="text-right text-[10px] text-slate-500">Prepared {prepared}</p>
      </header>
      <HeroNumbers report={report} />
      <Assumptions report={report} />
      <RolloutVisual report={report} />
      <CostCharts report={report} height={230} />
      <CostSplit report={report} />
      <CompanyImpact report={report} />
      <Findings report={report} />
      <MonthTable report={report} />
      <p className="text-[10px] leading-relaxed text-slate-400">
        An estimate, not a budget. {basedOn} Pay per person starts from the figures entered for each role, and rises with the forecast&apos;s
        pay rise unless that is switched off. Incentives, consultants and settlements are not included.
      </p>
    </div>
  );
}
