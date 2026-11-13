"use client";

import { useMemo, useState } from "react";
import DataNotesFlag from "@/components/data-notes-flag";
import { GLASS_PANEL } from "@/components/glass-card";
import ScrollTable from "@/components/scroll-table";
import {
  CATEGORICAL,
  ChangeChart,
  Chip,
  Donut,
  ForecastChart,
  HBars,
  HeatTable,
  MiniBars,
  MonthChart,
  PAL,
  Panel,
  Spark,
  Waffle,
  axisMoney,
  type BarRowData,
  type ChartSeries,
  type ForecastRow,
  type HeatRow,
  type Slice,
} from "@/components/financials-charts";
import { changePct, count, money, moneyFull, pct } from "@/lib/metrics/financials-format";
import { PAY_GROWTH_FADE, buildForecast } from "@/lib/metrics/financials-forecast";
import FinancialsPlanner, { useFinanceProjects, usePlanImpacts } from "@/components/financials-planner";
import ProjectBuilder from "@/components/financials-project-builder";
import { newProject, type PlanProject, type ProjectKind, type TemplateContext } from "@/lib/metrics/financials-projects";
import type { FinancialsData, FinPlace, Series } from "@/lib/metrics/financials-parse";

type View = "overview" | "people" | "cost" | "departments" | "states" | "other" | "forecast";
const VIEWS: { key: View; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "people", label: "People" },
  { key: "cost", label: "Cost" },
  { key: "departments", label: "Departments" },
  { key: "states", label: "States" },
  { key: "other", label: "Other costs" },
  { key: "forecast", label: "Forecast" },
];

type PlaceMetric = "headcount" | "earnedGross" | "ctc" | "perHead";
const PLACE_METRICS: { key: PlaceMetric; label: string }[] = [
  { key: "headcount", label: "Headcount" },
  { key: "earnedGross", label: "Earned gross pay" },
  { key: "ctc", label: "CTC" },
  { key: "perHead", label: "Pay per head" },
];

interface MetricDef {
  key: string;
  label: string;
  series: Series;
  fmt: (n: number) => string;
  axis?: (n: number) => string;
  kind: "bar" | "line";
  /** How a month-on-month move is shown. */
  delta: "pct" | "pts";
  hint: string;
}

const num = (n: number) => count(n);
const money1 = (n: number) => money(n);

/** The middle value of the last three months, so one odd month does not set the "typical" figure. */
const typical = (s: Series, last: number): number | null => {
  const v = [last - 2, last - 1, last]
    .filter((i) => i >= 0)
    .map((i) => s[i])
    .filter((x): x is number => x !== null)
    .sort((a, b) => a - b);
  return v.length === 0 ? null : v[Math.floor(v.length / 2)];
};

const divide = (a: Series, b: Series): Series => a.map((v, i) => (v !== null && b[i] ? v / (b[i] as number) : null));
const sumOver = (s: Series, idx: number[]) => idx.reduce((a, i) => a + (s[i] ?? 0), 0);
const grew = (from: number | null, to: number | null) => {
  const c = changePct(to, from);
  return c === null ? null : `${c >= 0 ? "grew" : "fell"} ${Math.abs(c).toFixed(0)}%`;
};

export default function FinancialsExplorer({ data }: { data: FinancialsData }) {
  const d = data;
  const last = d.latest;

  // ---- derived series, built once
  const derived = useMemo(() => {
    const hc = d.headcount;
    const female = hc.female.map((f, i) => {
      const m = hc.male[i];
      return f !== null && m !== null && f + m > 0 ? (f / (f + m)) * 100 : null;
    });
    return {
      costPerHead: divide(d.peopleCost, hc.total),
      branchPerHead: divide(d.payroll.branch, hc.branch),
      sePerHead: divide(d.payroll.salesEnablers, hc.salesEnablers),
      hoPerHead: divide(d.payroll.ho, hc.ho),
      femalePct: female,
      staffPerBranch: divide(hc.branch, hc.branches),
      netChange: hc.total.map((v, i) => (i > 0 && v !== null && hc.total[i - 1] !== null ? v - (hc.total[i - 1] as number) : null)),
      paidVsCtc: d.payroll.total.map((v, i) => (v !== null && d.ctc.total[i] ? (v / (d.ctc.total[i] as number)) * 100 : null)),
    };
  }, [d]);

  const metrics: MetricDef[] = useMemo(
    () => [
      { key: "headcount", label: "Headcount", series: d.headcount.total, fmt: num, kind: "bar", delta: "pct", hint: "People on the payroll at month end" },
      { key: "branches", label: "Branches", series: d.headcount.branches, fmt: num, kind: "bar", delta: "pct", hint: "Number of branches" },
      { key: "peopleCost", label: "People cost", series: d.peopleCost, fmt: money1, axis: axisMoney, kind: "bar", delta: "pct", hint: "Earned gross pay + non-payroll cost" },
      { key: "payroll", label: "Payroll", series: d.payroll.total, fmt: money1, axis: axisMoney, kind: "bar", delta: "pct", hint: "Earned gross pay: Branch + Sales Enablers + HO" },
      { key: "nonPayroll", label: "Non-payroll", series: d.nonPayroll.total, fmt: money1, axis: axisMoney, kind: "bar", delta: "pct", hint: "Insurance, meals, uniforms, events and the like" },
      { key: "costPerHead", label: "Cost per employee", series: derived.costPerHead, fmt: moneyFull, axis: axisMoney, kind: "line", delta: "pct", hint: "People cost ÷ headcount, per month" },
      { key: "femalePct", label: "Women in the team", series: derived.femalePct, fmt: (n) => pct(n), axis: (n) => `${Math.round(n)}%`, kind: "line", delta: "pts", hint: "Female ÷ (female + male)" },
      { key: "staffPerBranch", label: "Staff per branch", series: derived.staffPerBranch, fmt: (n) => count(n, 1), kind: "line", delta: "pct", hint: "Branch headcount ÷ number of branches" },
    ],
    [d, derived]
  );

  // ---- state
  const [range, setRange] = useState<[number, number]>([Math.max(0, last - 11), last]);
  const [focusRaw, setFocus] = useState(last);
  const [view, setView] = useState<View>("overview");
  const [metricKey, setMetricKey] = useState("peopleCost");
  const [deptKey, setDeptKey] = useState<string | null>(null);
  const [deptMode, setDeptMode] = useState<"range" | "month">("range");
  const [shade, setShade] = useState<"table" | "row">("table");
  const [placeMetric, setPlaceMetric] = useState<PlaceMetric>("headcount");
  const [placeKey, setPlaceKey] = useState<string | null>(null);
  const [itemKey, setItemKey] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<3 | 6 | 12 | 24>(6);
  const [fcMode, setFcMode] = useState<"trend" | "projects">("trend");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hires, setHires] = useState<number | null>(null);
  const [growth, setGrowth] = useState<number | null>(null);

  const [from, to] = range;
  const idx = useMemo(() => Array.from({ length: to - from + 1 }, (_, k) => from + k), [from, to]);
  const focus = Math.min(Math.max(focusRaw, from), to);
  const monthLabel = (i: number) => d.months[i].label;
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[2];

  const ranges = useMemo(() => {
    const out: { label: string; from: number; to: number }[] = [
      { label: "Last 6 months", from: Math.max(0, last - 5), to: last },
      { label: "Last 12 months", from: Math.max(0, last - 11), to: last },
    ];
    const years = new Set<number>();
    for (const m of d.months) {
      const [y, mo] = m.key.split("-").map(Number);
      years.add(mo >= 4 ? y : y - 1);
    }
    for (const y of [...years].sort()) {
      const inFy = d.months.map((m, i) => ({ m, i })).filter(({ m, i }) => i <= last && m.key >= `${y}-04` && m.key <= `${y + 1}-03`);
      if (inFy.length >= 2) {
        out.push({
          label: `FY ${y}-${String(y + 1).slice(2)}${inFy.length < 12 ? " so far" : ""}`,
          from: inFy[0].i,
          to: inFy[inFy.length - 1].i,
        });
      }
    }
    out.push({ label: "All months", from: 0, to: last });
    return out;
  }, [d.months, last]);

  const setFrom = (i: number) => setRange([i, Math.max(i, to)]);
  const setTo = (i: number) => setRange([Math.min(from, i), i]);

  const cur = (s: Series) => s[focus] ?? null;
  const prevOf = (s: Series) => (focus > 0 ? s[focus - 1] ?? null : null);

  // ---- overview pieces
  const summary = useMemo(() => {
    const hc = d.headcount.total[focus];
    const br = d.headcount.branches[focus];
    const pc = d.peopleCost[focus];
    const cph = derived.costPerHead[focus];
    const costMove = changePct(pc, focus > 0 ? d.peopleCost[focus - 1] : null);
    const hcGrowth = grew(d.headcount.total[from], d.headcount.total[to]);
    const costGrowth = grew(d.peopleCost[from], d.peopleCost[to]);
    return { hc, br, pc, cph, costMove, hcGrowth, costGrowth };
  }, [d, derived, focus, from, to]);

  const teamSlices = (a: Series, b: Series, c: Series): Slice[] => [
    { label: "Branch", value: a[focus] ?? 0, color: PAL.blue },
    { label: "Sales Enablers", value: b[focus] ?? 0, color: PAL.orange },
    { label: "HO", value: c[focus] ?? 0, color: PAL.aqua },
  ];

  const perHeadRows: BarRowData[] = [
    { key: "b", label: "Branch", value: derived.branchPerHead[focus], color: PAL.blue },
    { key: "s", label: "Sales Enablers", value: derived.sePerHead[focus], color: PAL.orange },
    { key: "h", label: "HO", value: derived.hoPerHead[focus], color: PAL.aqua },
  ];

  // ---- departments
  const deptRows = useMemo(
    () =>
      d.departments.map((dep) => ({
        dep,
        range: sumOver(dep.values, idx),
        month: dep.values[focus] ?? null,
        incentives: dep.incentives ? sumOver(dep.incentives, idx) : 0,
      })),
    [d.departments, idx, focus]
  );
  const deptValue = (r: (typeof deptRows)[number]) => (deptMode === "range" ? r.range : r.month ?? 0);
  const inPayrollDepts = deptRows.filter((r) => r.dep.inPayroll).sort((a, b) => deptValue(b) - deptValue(a));
  const outsideDepts = deptRows.filter((r) => !r.dep.inPayroll && deptValue(r) > 0).sort((a, b) => deptValue(b) - deptValue(a));
  const payrollInDepts = inPayrollDepts.reduce((a, r) => a + deptValue(r), 0);
  const selectedDept = deptRows.find((r) => r.dep.label === deptKey) ?? inPayrollDepts[0] ?? deptRows[0];

  // ---- places
  const placeSeries = (p: FinPlace, m: PlaceMetric): Series =>
    m === "headcount" ? p.headcount : m === "earnedGross" ? p.earnedGross : m === "ctc" ? p.ctc : divide(p.earnedGross, p.headcount);
  const placeFmt = placeMetric === "headcount" ? num : placeMetric === "perHead" ? moneyFull : money1;
  const placeAxis = placeMetric === "headcount" ? undefined : axisMoney;
  const selectedPlace = d.places.find((p) => p.label === placeKey) ?? d.places[0];

  // ---- other costs: top items by total spend across ALL months, so a colour never moves when the range changes
  const itemOrder = useMemo(
    () =>
      d.nonPayroll.items
        .map((it) => ({ it, total: sumOver(it.values, d.months.map((_, i) => i)) }))
        .sort((a, b) => b.total - a.total),
    [d.nonPayroll.items, d.months]
  );
  const topItems = itemOrder.slice(0, 7);
  const restItems = itemOrder.slice(7);
  const itemSeries: ChartSeries[] = [
    ...topItems.map((x, k) => ({ key: `i${k}`, label: x.it.label, color: CATEGORICAL[k], values: x.it.values })),
    ...(restItems.length > 0
      ? [
          {
            key: "rest",
            label: "Everything else",
            color: PAL.grey,
            values: d.months.map((_, i) => restItems.reduce<number | null>((a, x) => (x.it.values[i] === null ? a : (a ?? 0) + (x.it.values[i] as number)), null)),
          },
        ]
      : []),
  ];
  const itemRange = itemSeries.map((s) => ({ s, total: sumOver(s.values, idx) })).filter((x) => x.total > 0);

  const allIdx = (s: Series) => sumOver(s, idx);
  const monthsInRange = idx.length;

  // ---- other costs: cards, the busiest month
  const hcInRange = sumOver(d.headcount.total, idx);
  const itemsTotal = itemOrder.reduce((a, x) => a + sumOver(x.it.values, idx), 0);
  const itemCards = itemOrder
    .map((x, k) => {
      const total = sumOver(x.it.values, idx);
      const peak = idx.reduce((best, i) => ((x.it.values[i] ?? 0) > best.v ? { i, v: x.it.values[i] ?? 0 } : best), { i: idx[0], v: 0 });
      return {
        key: x.it.label,
        label: x.it.label,
        color: k < 7 ? CATEGORICAL[k] : PAL.grey,
        total,
        perHead: hcInRange > 0 ? total / hcInRange : null,
        share: itemsTotal > 0 ? (total / itemsTotal) * 100 : 0,
        peak,
        values: x.it.values,
        paidMonths: idx.filter((i) => (x.it.values[i] ?? 0) > 0).length,
      };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const selectedItem = itemCards.find((c) => c.key === itemKey) ?? itemCards[0];
  const busiest = (() => {
    let best: { i: number; value: number } | null = null;
    for (const i of idx) {
      const v = d.nonPayroll.total[i] ?? 0;
      if (!best || v > best.value) best = { i, value: v };
    }
    if (!best || best.value <= 0) return null;
    let top: string | null = null;
    let topValue = 0;
    for (const x of itemOrder) {
      const v = x.it.values[best.i] ?? 0;
      if (v > topValue) {
        topValue = v;
        top = x.it.label;
      }
    }
    return { ...best, top };
  })();

  // ---- forecast
  const fcTrend = useMemo(() => buildForecast(d, 24), [d]);
  const fc = useMemo(
    () =>
      buildForecast(d, 24, {
        ...(hires !== null ? { hiresPerMonth: hires } : {}),
        ...(growth !== null ? { payGrowthPct: growth } : {}),
      }),
    [d, hires, growth]
  );
  const changed = hires !== null || growth !== null;

  // ---- planning projects
  const { projects, setProjects, loaded: projectsLoaded, saveFailed } = useFinanceProjects(fc?.months[0]?.key ?? d.months[last].key);
  const impacts = usePlanImpacts(projects, fc);
  const hasPlan = projects.some((p) => p.enabled);
  const editingProject = projects.find((p) => p.id === editingId) ?? null;
  const planCtx: TemplateContext = {
    firstKey: fc?.months[0]?.key ?? d.months[last].key,
    branchPay: typical(derived.branchPerHead, last) ?? 30000,
    salesPay: typical(derived.sePerHead, last) ?? 45000,
    hoPay: typical(derived.hoPerHead, last) ?? 60000,
    staffPerBranch: derived.staffPerBranch[last] ?? 2.5,
    nonPayrollPerHead: fc?.drivers.nonPayrollPerHead ?? 700,
  };
  const createProject = (kind: ProjectKind) => {
    const project = newProject(kind, planCtx);
    setProjects((all) => [...all, project]);
    setEditingId(project.id);
  };
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const deleteProject = (id: string) => {
    setProjects((all) => all.filter((p) => p.id !== id));
    setEditingId((cur) => (cur === id ? null : cur));
    setConfirmDelId(null);
  };
  const patchEditing = (change: (p: PlanProject) => PlanProject) =>
    setProjects((all) => all.map((p) => (p.id === editingId ? change(p) : p)));
  const horizonMonths = fc ? fc.months.slice(0, horizon) : [];
  const fcVsLast = fc ? changePct(fc.months[0].peopleCost, d.peopleCost[last]) : null;
  const forecastRows: ForecastRow[] =
    fc && fcTrend
      ? [
          ...Array.from({ length: Math.min(12, last + 1) }, (_, k) => last - Math.min(12, last + 1) + 1 + k).map((i) => {
            const v = d.peopleCost[i];
            return {
              name: d.months[i].short,
              actual: v,
              forecast: i === last ? v : null,
              band: i === last && v !== null ? ([v, v] as [number, number]) : null,
              trend: changed && i === last ? v : null,
              plan: hasPlan && i === last ? v : null,
            };
          }),
          ...horizonMonths.map((m, k) => ({
            name: m.short,
            actual: null,
            forecast: m.peopleCost,
            band: [m.low, m.high] as [number, number],
            trend: changed ? fcTrend.months[k].peopleCost : null,
            plan: hasPlan ? m.peopleCost + (impacts.total[k]?.total ?? 0) : null,
          })),
        ]
      : [];

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------ controls */}
      <div className={`${GLASS_PANEL} space-y-3 p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Period</span>
          {ranges.map((r) => (
            <Chip key={r.label} active={from === r.from && to === r.to} onClick={() => setRange([r.from, r.to])}>
              {r.label}
            </Chip>
          ))}
          <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
            <select
              aria-label="From month"
              value={from}
              onChange={(e) => setFrom(Number(e.target.value))}
              className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-[#0e1b3d] outline-none focus:border-brand-blue"
            >
              {d.months.slice(0, last + 1).map((m, i) => (
                <option key={m.key} value={i}>
                  {m.label}
                </option>
              ))}
            </select>
            to
            <select
              aria-label="To month"
              value={to}
              onChange={(e) => setTo(Number(e.target.value))}
              className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-[#0e1b3d] outline-none focus:border-brand-blue"
            >
              {d.months.slice(0, last + 1).map((m, i) => (
                <option key={m.key} value={i}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/60 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Focus month</span>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5">
            {idx.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setFocus(i)}
                aria-pressed={focus === i}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                  focus === i ? "bg-[#0e1b3d] text-white" : "text-slate-500 hover:bg-white hover:text-brand-blue"
                }`}
              >
                {d.months[i].short}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Financials views">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            onClick={() => setView(v.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
              view === v.key
                ? "bg-brand-blue text-white shadow-[0_6px_16px_rgba(30,80,204,0.3)]"
                : "bg-white/70 text-slate-600 hover:bg-white hover:text-brand-blue"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------ overview */}
      {view === "overview" && (
        <>
          <section className={`${GLASS_PANEL} space-y-1.5 p-5`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-brand-blue">{monthLabel(focus)} at a glance</p>
            <p className="text-base font-semibold leading-relaxed text-[#0e1b3d] sm:text-lg">
              {summary.hc !== null && (
                <>
                  <b className="text-brand-blue">{count(summary.hc)} people</b>
                  {summary.br !== null && <> across <b className="text-brand-blue">{count(summary.br)} branches</b></>}.{" "}
                </>
              )}
              {summary.pc !== null && (
                <>
                  People cost was <b className="text-brand-blue">{money(summary.pc)}</b>
                  {summary.costMove !== null && focus > 0 && (
                    <>
                      {" "}
                      ({summary.costMove >= 0 ? "up" : "down"} {Math.abs(summary.costMove).toFixed(1)}% on {monthLabel(focus - 1)})
                    </>
                  )}
                  {summary.cph !== null && <>, which is <b className="text-brand-blue">{moneyFull(summary.cph)}</b> per employee</>}
                  .
                </>
              )}
            </p>
            {from < to && (summary.hcGrowth || summary.costGrowth) && (
              <p className="text-sm text-slate-500">
                Between {monthLabel(from)} and {monthLabel(to)}
                {summary.hcGrowth && <> headcount {summary.hcGrowth} ({count(d.headcount.total[from])} → {count(d.headcount.total[to])})</>}
                {summary.hcGrowth && summary.costGrowth && <> and</>}
                {summary.costGrowth && <> monthly people cost {summary.costGrowth} ({money(d.peopleCost[from])} → {money(d.peopleCost[to])})</>}.
              </p>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map((m) => {
              const v = cur(m.series);
              const p = prevOf(m.series);
              const delta = m.delta === "pts" ? (v !== null && p !== null ? v - p : null) : changePct(v, p);
              const on = m.key === metricKey;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMetricKey(m.key)}
                  aria-pressed={on}
                  title={m.hint}
                  className={`${GLASS_PANEL} min-w-0 p-4 text-left transition hover:-translate-y-0.5 ${on ? "ring-2 ring-brand-blue" : ""}`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{m.label}</p>
                  <p className="mt-1 truncate text-xl font-extrabold text-[#0e1b3d] sm:text-2xl">{v === null ? "–" : m.fmt(v)}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {delta === null ? (
                      "No earlier month"
                    ) : (
                      <>
                        <span className="font-bold text-[#0e1b3d]">
                          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
                          {m.delta === "pts" ? " pts" : "%"}
                        </span>{" "}
                        vs {d.months[focus - 1].short}
                      </>
                    )}
                  </p>
                  <Spark values={idx.map((i) => m.series[i])} focusAt={focus - from} />
                </button>
              );
            })}
          </div>

          <Panel
            title={`${metric.label} by month`}
            hint={`${metric.hint}. Click a month to focus it; click a card above to chart something else.`}
          >
            <MonthChart
              key={metric.key}
              months={d.months}
              idx={idx}
              series={[{ key: metric.key, label: metric.label, color: PAL.brand, values: metric.series }]}
              kind={metric.kind}
              focus={focus}
              onFocus={setFocus}
              fmt={metric.fmt}
              axisFmt={metric.axis}
              height={280}
            />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Where the payroll goes" hint={`Earned gross pay by team, ${monthLabel(focus)}`}>
              <Donut
                slices={teamSlices(d.payroll.branch, d.payroll.salesEnablers, d.payroll.ho)}
                fmt={money1}
                centerLabel="Payroll"
              />
            </Panel>
            <Panel title="Who is on the team" hint={`Headcount by team, ${monthLabel(focus)}`}>
              <Donut
                slices={teamSlices(d.headcount.branch, d.headcount.salesEnablers, d.headcount.ho)}
                fmt={num}
                centerLabel="People"
              />
            </Panel>
            <Panel title="Pay per head" hint={`Earned gross ÷ headcount, ${monthLabel(focus)}`}>
              <HBars rows={perHeadRows} fmt={moneyFull} />
            </Panel>
          </div>
        </>
      )}

      {/* ------------------------------------------------ people */}
      {view === "people" && (
        <>
          <Panel title="Headcount by team" hint="Stacked: Branch + Sales Enablers + HO. Click a legend name to hide a team.">
            <MonthChart
              months={d.months}
              idx={idx}
              kind="stack"
              focus={focus}
              onFocus={setFocus}
              fmt={num}
              series={[
                { key: "b", label: "Branch", color: PAL.blue, values: d.headcount.branch },
                { key: "s", label: "Sales Enablers", color: PAL.orange, values: d.headcount.salesEnablers },
                { key: "h", label: "HO", color: PAL.aqua, values: d.headcount.ho },
              ]}
            />
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Net change each month" hint="People added (blue) or lost (orange) compared with the month before">
              <ChangeChart months={d.months} idx={idx} values={derived.netChange} focus={focus} onFocus={setFocus} fmt={(n) => (n > 0 ? `+${n}` : String(n))} />
            </Panel>
            <Panel title="Branches" hint="Number of branches open">
              <MonthChart
                months={d.months}
                idx={idx}
                kind="bar"
                focus={focus}
                onFocus={setFocus}
                fmt={num}
                height={200}
                series={[{ key: "br", label: "Branches", color: PAL.brand, values: d.headcount.branches }]}
              />
            </Panel>
            <Panel title="Staff per branch" hint="Branch headcount ÷ number of branches">
              <MonthChart
                months={d.months}
                idx={idx}
                kind="line"
                focus={focus}
                onFocus={setFocus}
                fmt={(n) => count(n, 1)}
                height={200}
                series={[{ key: "spb", label: "Staff per branch", color: PAL.brand, values: derived.staffPerBranch }]}
              />
            </Panel>
            <Panel
              title="Women and men"
              hint={
                derived.femalePct[focus] === null
                  ? `No gender split for ${monthLabel(focus)}`
                  : `${pct(derived.femalePct[focus])} women in ${monthLabel(focus)}`
              }
            >
              <MonthChart
                months={d.months}
                idx={idx}
                kind="stack"
                focus={focus}
                onFocus={setFocus}
                fmt={(n) => count(n, 1)}
                height={200}
                series={[
                  { key: "m", label: "Male", color: PAL.blue, values: d.headcount.male },
                  { key: "f", label: "Female", color: PAL.magenta, values: d.headcount.female },
                ]}
              />
            </Panel>
          </div>
        </>
      )}

      {/* ------------------------------------------------ cost */}
      {view === "cost" && (
        <>
          <Panel title="People cost by month" hint="Payroll by team plus non-payroll cost. The full bar is the people cost.">
            <MonthChart
              months={d.months}
              idx={idx}
              kind="stack"
              focus={focus}
              onFocus={setFocus}
              fmt={money1}
              axisFmt={axisMoney}
              height={300}
              series={[
                { key: "b", label: "Branch pay", color: PAL.blue, values: d.payroll.branch },
                { key: "s", label: "Sales Enablers pay", color: PAL.orange, values: d.payroll.salesEnablers },
                { key: "h", label: "HO pay", color: PAL.aqua, values: d.payroll.ho },
                { key: "n", label: "Non-payroll", color: PAL.grey, values: d.nonPayroll.total },
              ]}
            />
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Cost per head" hint="Overall is people cost ÷ headcount; teams are earned gross ÷ team headcount">
              <MonthChart
                months={d.months}
                idx={idx}
                kind="line"
                focus={focus}
                onFocus={setFocus}
                fmt={moneyFull}
                axisFmt={axisMoney}
                series={[
                  { key: "o", label: "Overall", color: PAL.ink, values: derived.costPerHead },
                  { key: "b", label: "Branch", color: PAL.blue, values: derived.branchPerHead },
                  { key: "s", label: "Sales Enablers", color: PAL.orange, values: derived.sePerHead },
                  { key: "h", label: "HO", color: PAL.aqua, values: derived.hoPerHead },
                ]}
              />
            </Panel>
            <Panel
              title="Paid vs budgeted pay"
              hint={
                derived.paidVsCtc[focus] === null
                  ? "Earned gross against cost to company (CTC)"
                  : `${monthLabel(focus)}: earned gross was ${pct(derived.paidVsCtc[focus])} of CTC`
              }
            >
              <MonthChart
                months={d.months}
                idx={idx}
                kind="line"
                focus={focus}
                onFocus={setFocus}
                fmt={money1}
                axisFmt={axisMoney}
                series={[
                  { key: "c", label: "CTC", color: PAL.violet, values: d.ctc.total },
                  { key: "e", label: "Earned gross", color: PAL.brand, values: d.payroll.total },
                ]}
              />
            </Panel>
          </div>
          <Panel title="Month by month" hint="The sheet's layout: one column per month. Click a month to focus it.">
            <HeatTable
              months={d.months}
              idx={idx}
              fmt={money1}
              focus={focus}
              onFocus={setFocus}
              shade="row"
              showTotal
              rows={[
                { key: "b", label: "Branch pay", values: d.payroll.branch },
                { key: "s", label: "Sales Enablers pay", values: d.payroll.salesEnablers },
                { key: "h", label: "HO pay", values: d.payroll.ho },
                { key: "p", label: "Payroll", values: d.payroll.total },
                { key: "n", label: "Non-payroll", values: d.nonPayroll.total },
                { key: "t", label: "People cost", values: d.peopleCost },
              ]}
            />
          </Panel>
        </>
      )}

      {/* ------------------------------------------------ departments */}
      {view === "departments" && (
        <>
          <Panel
            title="Pay by department"
            hint="Earned gross pay. Click a department to see it month by month."
            right={
              <div className="flex gap-1.5">
                <Chip active={deptMode === "range"} onClick={() => setDeptMode("range")}>
                  Whole period
                </Chip>
                <Chip active={deptMode === "month"} onClick={() => setDeptMode("month")}>
                  {d.months[focus].short} only
                </Chip>
              </div>
            }
          >
            <div className="grid gap-x-8 gap-y-4 lg:grid-cols-2">
              <HBars
                selected={selectedDept?.dep.label}
                onSelect={setDeptKey}
                fmt={money1}
                rows={inPayrollDepts
                  .filter((r) => deptValue(r) > 0)
                  .map((r) => ({
                    key: r.dep.label,
                    label: r.dep.label,
                    value: deptValue(r),
                    sub: payrollInDepts > 0 ? `${Math.round((deptValue(r) / payrollInDepts) * 100)}%` : undefined,
                  }))}
              />
              <div>
                <p className="px-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Not in the payroll total</p>
                <p className="mb-1 px-2 text-[11px] text-slate-400">Consultants and Kerala housekeeping are paid outside payroll.</p>
                <HBars
                  selected={selectedDept?.dep.label}
                  onSelect={setDeptKey}
                  fmt={money1}
                  empty="None in this period."
                  rows={outsideDepts.map((r) => ({ key: r.dep.label, label: r.dep.label, value: deptValue(r), color: PAL.grey }))}
                />
              </div>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-3">
            {selectedDept && (
              <Panel
                className="lg:col-span-2"
                title={selectedDept.dep.label}
                hint={`${money(selectedDept.range)} earned gross in ${monthsInRange} ${monthsInRange === 1 ? "month" : "months"}${
                  selectedDept.incentives > 0 ? `, plus ${money(selectedDept.incentives)} incentives` : ""
                }`}
              >
                <MonthChart
                  key={selectedDept.dep.label}
                  months={d.months}
                  idx={idx}
                  kind="stack"
                  focus={focus}
                  onFocus={setFocus}
                  fmt={money1}
                  axisFmt={axisMoney}
                  height={240}
                  series={[
                    { key: "e", label: "Earned gross", color: PAL.brand, values: selectedDept.dep.values },
                    ...(selectedDept.dep.incentives ? [{ key: "i", label: "Incentives", color: PAL.orange, values: selectedDept.dep.incentives }] : []),
                  ]}
                />
              </Panel>
            )}
            <Panel title="Incentives" hint={`Paid on top of pay, ${monthsInRange === 1 ? d.months[from].label : `${d.months[from].short} to ${d.months[to].short}`}`}>
              <HBars
                fmt={money1}
                empty="No incentives in this period."
                rows={deptRows
                  .filter((r) => r.incentives > 0)
                  .sort((a, b) => b.incentives - a.incentives)
                  .map((r) => ({ key: r.dep.label, label: r.dep.label, value: r.incentives, color: PAL.orange }))}
              />
              <p className="mt-2 text-[11px] text-slate-400">Incentives are not part of the sheet&apos;s payroll total.</p>
            </Panel>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#0e1b3d]">Every department, month by month</h2>
              <div className="flex gap-1.5">
                <Chip active={shade === "table"} onClick={() => setShade("table")}>
                  Shade across table
                </Chip>
                <Chip active={shade === "row"} onClick={() => setShade("row")}>
                  Shade each row
                </Chip>
              </div>
            </div>
            <HeatTable
              months={d.months}
              idx={idx}
              fmt={money1}
              focus={focus}
              onFocus={setFocus}
              selected={selectedDept?.dep.label}
              onSelect={setDeptKey}
              shade={shade}
              showTotal
              rows={[...d.departments]
                .sort((a, b) => Number(b.inPayroll) - Number(a.inPayroll))
                .map<HeatRow>((dep) => ({ key: dep.label, label: dep.label, values: dep.values, muted: !dep.inPayroll }))}
            />
          </div>
        </>
      )}

      {/* ------------------------------------------------ states */}
      {view === "states" && selectedPlace && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Show</span>
            {PLACE_METRICS.map((m) => (
              <Chip key={m.key} active={placeMetric === m.key} onClick={() => setPlaceMetric(m.key)}>
                {m.label}
              </Chip>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="By state" hint={`${PLACE_METRICS.find((m) => m.key === placeMetric)?.label}, ${monthLabel(focus)}. Click one to follow it.`}>
              <HBars
                selected={selectedPlace.label}
                onSelect={setPlaceKey}
                fmt={placeFmt}
                rows={[...d.places]
                  .map((p) => {
                    const s = placeSeries(p, placeMetric);
                    const a = s[from];
                    const b = s[focus];
                    const delta = placeMetric === "headcount" && a !== null && b !== null && from < focus ? b - a : null;
                    return {
                      key: p.label,
                      label: p.label,
                      value: b,
                      sub: delta === null ? undefined : `${delta >= 0 ? "+" : ""}${delta} since ${d.months[from].short}`,
                      color: CATEGORICAL[d.places.indexOf(p) % CATEGORICAL.length],
                    };
                  })
                  .sort((x, y) => (y.value ?? 0) - (x.value ?? 0))}
              />
            </Panel>
            <Panel title="Share of the total" hint={`${PLACE_METRICS.find((m) => m.key === placeMetric)?.label}, ${monthLabel(focus)}`}>
              <Donut
                fmt={placeFmt}
                centerLabel={placeMetric === "perHead" ? "Sum of averages" : "Total"}
                slices={d.places
                  .map((p, k) => ({ label: p.label, value: placeSeries(p, placeMetric)[focus] ?? 0, color: CATEGORICAL[k % CATEGORICAL.length] }))
                  .filter((s) => s.value > 0)}
              />
              {placeMetric === "perHead" && (
                <p className="mt-2 text-[11px] text-slate-400">Pay per head is an average, so the ring only compares places, it does not add up.</p>
              )}
            </Panel>
          </div>
          <Panel
            title={selectedPlace.label}
            hint={`${PLACE_METRICS.find((m) => m.key === placeMetric)?.label} by month`}
          >
            <MonthChart
              key={`${selectedPlace.label}-${placeMetric}`}
              months={d.months}
              idx={idx}
              kind={placeMetric === "perHead" ? "line" : "bar"}
              focus={focus}
              onFocus={setFocus}
              fmt={placeFmt}
              axisFmt={placeAxis}
              height={240}
              series={[
                {
                  key: "p",
                  label: PLACE_METRICS.find((m) => m.key === placeMetric)?.label ?? "",
                  color: CATEGORICAL[d.places.indexOf(selectedPlace) % CATEGORICAL.length],
                  values: placeSeries(selectedPlace, placeMetric),
                },
              ]}
            />
          </Panel>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#0e1b3d]">Every state, month by month</h2>
              <div className="flex gap-1.5">
                <Chip active={shade === "table"} onClick={() => setShade("table")}>
                  Shade across table
                </Chip>
                <Chip active={shade === "row"} onClick={() => setShade("row")}>
                  Shade each row
                </Chip>
              </div>
            </div>
            <HeatTable
              months={d.months}
              idx={idx}
              fmt={placeFmt}
              focus={focus}
              onFocus={setFocus}
              selected={selectedPlace.label}
              onSelect={setPlaceKey}
              shade={shade}
              rows={d.places.map<HeatRow>((p) => ({ key: p.label, label: p.label, values: placeSeries(p, placeMetric) }))}
            />
          </div>
        </>
      )}

      {/* ------------------------------------------------ other costs */}
      {view === "other" && (
        <>
          <div className="grid gap-4 lg:grid-cols-5">
            <Panel
              className="lg:col-span-3"
              title="Where each ₹100 goes"
              hint={`Non-payroll cost, ${monthsInRange === 1 ? d.months[from].label : `${d.months[from].short} to ${d.months[to].short}`}`}
            >
              <Waffle fmt={money1} slices={itemRange.map((x) => ({ label: x.s.label, value: x.total, color: x.s.color }))} />
            </Panel>
            <div className="grid grid-cols-2 gap-3 lg:col-span-2">
              {[
                { label: "Non-payroll cost", value: money(allIdx(d.nonPayroll.total)), sub: `${monthsInRange} ${monthsInRange === 1 ? "month" : "months"}` },
                {
                  label: "Per employee a month",
                  value: moneyFull(hcInRange > 0 ? allIdx(d.nonPayroll.total) / hcInRange : null),
                  sub: "Non-payroll ÷ headcount",
                },
                {
                  label: "Share of people cost",
                  value: pct((allIdx(d.nonPayroll.total) / Math.max(1, allIdx(d.peopleCost))) * 100),
                  sub: "Non-payroll ÷ people cost",
                },
                {
                  label: "Busiest month",
                  value: busiest ? money(busiest.value) : "–",
                  sub: busiest ? `${d.months[busiest.i].label}${busiest.top ? `, mostly ${busiest.top}` : ""}` : "",
                },
              ].map((t) => (
                <div key={t.label} className={`${GLASS_PANEL} min-w-0 p-4`}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t.label}</p>
                  <p className="mt-1 truncate text-xl font-extrabold text-[#0e1b3d]">{t.value}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{t.sub}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold text-[#0e1b3d]">Every item</h2>
              <p className="text-xs text-slate-500">Click an item to look at it month by month. The bright bar is {d.months[focus].short}.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {itemCards.map((c) => {
                const on = selectedItem?.key === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setItemKey(c.key)}
                    aria-pressed={on}
                    className={`${GLASS_PANEL} min-w-0 overflow-hidden p-3.5 text-left transition hover:-translate-y-0.5 ${on ? "ring-2 ring-brand-blue" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-[#0e1b3d]">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: c.color }} />
                        <span className="truncate">{c.label}</span>
                      </span>
                      <span className="shrink-0 text-[10px] font-bold text-slate-400">{c.share.toFixed(0)}%</span>
                    </div>
                    <p className="mt-2 text-lg font-extrabold text-[#0e1b3d]">{money(c.total)}</p>
                    <p className="text-[11px] text-slate-500">{c.perHead === null ? "–" : `${moneyFull(c.perHead)} per person a month`}</p>
                    <div className="mt-2">
                      <MiniBars values={idx.map((i) => c.values[i])} color={c.color} focusAt={focus - from} />
                    </div>
                    <p className="mt-1.5 truncate text-[10px] text-slate-400">
                      Peak {d.months[c.peak.i].short}, {money(c.peak.v)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedItem && (
            <Panel
              title={selectedItem.label}
              hint={`${money(selectedItem.total)} over ${monthsInRange} ${monthsInRange === 1 ? "month" : "months"}, paid in ${selectedItem.paidMonths} of them`}
              right={
                <div className="flex gap-4 text-right">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Average month</p>
                    <p className="text-sm font-extrabold text-[#0e1b3d]">{money(selectedItem.total / monthsInRange)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Highest</p>
                    <p className="text-sm font-extrabold text-[#0e1b3d]">
                      {money(selectedItem.peak.v)} <span className="font-normal text-slate-400">{d.months[selectedItem.peak.i].short}</span>
                    </p>
                  </div>
                </div>
              }
            >
              <MonthChart
                key={selectedItem.key}
                months={d.months}
                idx={idx}
                kind="bar"
                focus={focus}
                onFocus={setFocus}
                fmt={money1}
                axisFmt={axisMoney}
                height={220}
                series={[{ key: "it", label: selectedItem.label, color: selectedItem.color, values: selectedItem.values }]}
              />
            </Panel>
          )}

          <Panel title="All items together" hint="Stacked by item. Click a legend name to hide it.">
            <MonthChart
              months={d.months}
              idx={idx}
              kind="stack"
              focus={focus}
              onFocus={setFocus}
              fmt={money1}
              axisFmt={axisMoney}
              height={300}
              series={itemSeries}
            />
          </Panel>
          <Panel title="Month by month" hint="Every item, one column per month">
            <HeatTable
              months={d.months}
              idx={idx}
              fmt={money1}
              focus={focus}
              onFocus={setFocus}
              shade="row"
              showTotal
              rows={itemOrder.map<HeatRow>((x) => ({ key: x.it.label, label: x.it.label, values: x.it.values }))}
            />
          </Panel>
        </>
      )}

      {/* ------------------------------------------------ forecast */}
      {view === "forecast" && (
        <>
          {!fc || !fcTrend ? (
            <Panel title="Forecast" hint="Not enough months of data yet to work out a trend.">
              <p className="text-sm text-slate-500">The forecast needs at least a few months of headcount and payroll.</p>
            </Panel>
          ) : (
            <>
              <section className="rounded-3xl bg-gradient-to-r from-brand-blue to-[#3b6fe0] p-5 text-white shadow-[0_12px_30px_rgba(30,80,204,0.28)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 max-w-xl">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-white/70">Forecast project</p>
                    <h2 className="text-lg font-extrabold">Planning to grow? Create a forecast project</h2>
                    <p className="mt-0.5 text-sm text-white/85">
                      Open a new state or new branches, 3 people each (BM, ABM and BDE), and see what it costs month by month, with a
                      one-click PDF or Excel.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => createProject("state")}
                      className="rounded-full bg-white px-4 py-2 text-xs font-bold text-brand-blue shadow-sm transition hover:bg-blue-50"
                    >
                      + New state expansion
                    </button>
                    <button
                      type="button"
                      onClick={() => createProject("branches")}
                      className="rounded-full bg-white px-4 py-2 text-xs font-bold text-brand-blue shadow-sm transition hover:bg-blue-50"
                    >
                      + New branches
                    </button>
                    <button
                      type="button"
                      onClick={() => createProject("team")}
                      className="rounded-full bg-white/15 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/25"
                    >
                      + New team
                    </button>
                  </div>
                </div>
                {projects.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/20 pt-3">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-white/70">Your projects</span>
                    {projects.map((p) => (
                      <span key={p.id} className="inline-flex max-w-full items-center overflow-hidden rounded-full bg-white/15">
                        <button
                          type="button"
                          onClick={() => setEditingId(p.id)}
                          className="max-w-[14rem] truncate py-1 pl-3 pr-2 text-xs font-bold transition hover:bg-white/25"
                        >
                          {p.name}
                          {p.enabled ? "" : " (off)"}
                        </button>
                        {confirmDelId === p.id ? (
                          <button
                            type="button"
                            autoFocus
                            onClick={() => deleteProject(p.id)}
                            onBlur={() => setConfirmDelId(null)}
                            className="self-stretch bg-red-600 px-2.5 text-[11px] font-bold text-white"
                          >
                            Delete?
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDelId(p.id)}
                            aria-label={`Delete ${p.name}`}
                            title="Delete this project"
                            className="self-stretch px-2.5 text-sm font-bold leading-none text-white/80 transition hover:bg-red-600 hover:text-white"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs font-medium text-brand-blue-dark">
                An estimate from the months up to {d.months[last].label}, not a budget. It uses every actual month, not only the period chosen above.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Chip active={fcMode === "trend"} onClick={() => setFcMode("trend")}>
                  Forecast
                </Chip>
                <Chip active={fcMode === "projects"} onClick={() => setFcMode("projects")}>
                  Projects overview{projects.length > 0 ? ` (${projects.length})` : ""}
                </Chip>
                {fcMode === "trend" && hasPlan && (
                  <span className="text-xs text-slate-500">
                    {projects.filter((p) => p.enabled).length} planning {projects.filter((p) => p.enabled).length === 1 ? "project is" : "projects are"} drawn in orange on the chart.
                  </span>
                )}
              </div>

              {fcMode === "projects" ? (
                <FinancialsPlanner
                  d={d}
                  fc={fc}
                  horizon={horizon}
                  setHorizon={setHorizon}
                  projects={projects}
                  setProjects={setProjects}
                  loaded={projectsLoaded}
                  saveFailed={saveFailed}
                  impacts={impacts}
                  chartRows={forecastRows}
                  editingId={editingId}
                  onEdit={setEditingId}
                  onCreate={createProject}
                />
              ) : (
              <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  {
                    label: `Next month, ${fc.months[0].short}`,
                    value: money(fc.months[0].peopleCost),
                    sub:
                      fcVsLast === null
                        ? ""
                        : `${fcVsLast >= 0 ? "▲" : "▼"} ${Math.abs(fcVsLast).toFixed(1)}% on ${d.months[last].short}`,
                    extra: `Likely ${money(fc.months[0].low)} to ${money(fc.months[0].high)}`,
                  },
                  {
                    label: `Next ${horizon} months`,
                    value: money(horizonMonths.reduce((a, m) => a + m.peopleCost, 0)),
                    sub: `${money(horizonMonths.reduce((a, m) => a + m.peopleCost, 0) / horizon)} a month on average`,
                    extra: `${fc.months[0].short} to ${fc.months[horizon - 1].short}`,
                  },
                  {
                    label: fc.fiscalYear ? `${fc.fiscalYear.label} in total` : "Financial year",
                    value: fc.fiscalYear ? money(fc.fiscalYear.total) : "–",
                    sub: fc.fiscalYear
                      ? `${money(fc.fiscalYear.actual)} so far + ${money(fc.fiscalYear.forecast)} to come`
                      : "",
                    extra: fc.fiscalYear ? `${fc.fiscalYear.actualMonths} months actual, ${fc.fiscalYear.forecastMonths} forecast` : "",
                  },
                  {
                    label: `Headcount, ${fc.months[horizon - 1].short}`,
                    value: count(Math.round(fc.months[horizon - 1].headcount)),
                    sub: `${fc.months[horizon - 1].headcount - fc.drivers.lastHeadcount >= 0 ? "+" : ""}${count(
                      Math.round(fc.months[horizon - 1].headcount - fc.drivers.lastHeadcount)
                    )} from ${count(fc.drivers.lastHeadcount)} now`,
                    extra: `${fc.drivers.hiresPerMonth >= 0 ? "+" : ""}${count(fc.drivers.hiresPerMonth, 1)} people a month`,
                  },
                ].map((t) => (
                  <div key={t.label} className={`${GLASS_PANEL} min-w-0 p-4`}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t.label}</p>
                    <p className="mt-1 truncate text-xl font-extrabold text-[#0e1b3d] sm:text-2xl">{t.value}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#0e1b3d]">{t.sub}</p>
                    <p className="text-[11px] text-slate-500">{t.extra}</p>
                  </div>
                ))}
              </div>

              <Panel
                title="People cost: where it has been and where it is heading"
                hint="Solid line is what happened. Dashed line is the forecast, with the likely range shaded."
                right={
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Look ahead</span>
                    {([3, 6, 12, 24] as const).map((h) => (
                      <Chip key={h} active={horizon === h} onClick={() => setHorizon(h)}>
                        {h} months
                      </Chip>
                    ))}
                  </div>
                }
              >
                <ForecastChart rows={forecastRows} nowName={d.months[last].short} fmt={money1} axisFmt={axisMoney} height={320} />
              </Panel>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel
                  title="What if…"
                  hint="Change the two things you control and watch the forecast move."
                  right={
                    changed ? (
                      <button
                        type="button"
                        onClick={() => {
                          setHires(null);
                          setGrowth(null);
                        }}
                        className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-brand-blue hover:bg-white"
                      >
                        Back to trend
                      </button>
                    ) : null
                  }
                >
                  <div className="space-y-5">
                    <label className="block">
                      <span className="flex items-baseline justify-between text-xs">
                        <span className="font-bold text-[#0e1b3d]">Hiring pace</span>
                        <span className="font-extrabold text-brand-blue">{count(fc.drivers.hiresPerMonth, 1)} people a month</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={60}
                        step={1}
                        value={Math.round(fc.drivers.hiresPerMonth)}
                        onChange={(e) => setHires(Number(e.target.value))}
                        className="mt-2 w-full accent-[#1e50cc]"
                        aria-label="People hired each month"
                      />
                      <span className="text-[11px] text-slate-500">The recent trend is {count(fcTrend.trend.hiresPerMonth, 1)} a month (average of the last 6 months).</span>
                    </label>
                    <label className="block">
                      <span className="flex items-baseline justify-between text-xs">
                        <span className="font-bold text-[#0e1b3d]">Pay per head, starting rise</span>
                        <span className="font-extrabold text-brand-blue">{fc.drivers.payGrowthPct >= 0 ? "+" : ""}{fc.drivers.payGrowthPct.toFixed(1)}% a month</span>
                      </span>
                      <input
                        type="range"
                        min={-2}
                        max={3}
                        step={0.1}
                        value={fc.drivers.payGrowthPct}
                        onChange={(e) => setGrowth(Number(e.target.value))}
                        className="mt-2 w-full accent-[#1e50cc]"
                        aria-label="Monthly rise in pay per head"
                      />
                      <span className="text-[11px] text-slate-500">
                        The recent trend is {fcTrend.trend.payGrowthPct >= 0 ? "+" : ""}
                        {fcTrend.trend.payGrowthPct.toFixed(1)}% a month. Each month&apos;s rise is {Math.round(PAY_GROWTH_FADE * 100)}% of the one before, so it fades out.
                      </span>
                    </label>
                    {fc.tenHiresCost !== null && (
                      <p className="rounded-2xl bg-white/70 px-4 py-3 text-xs text-slate-600">
                        Every <b className="text-[#0e1b3d]">10 extra hires a month</b> adds about{" "}
                        <b className="text-[#0e1b3d]">{money(fc.tenHiresCost)}</b> to people cost over the next 6 months.
                      </p>
                    )}
                  </div>
                </Panel>

                <Panel title="How this is worked out" hint="People cost = headcount × (pay per head + non-payroll per head)">
                  <ul className="space-y-2 text-xs leading-relaxed text-slate-600">
                    <li>
                      <b className="text-[#0e1b3d]">Headcount</b> starts at {count(fc.drivers.lastHeadcount)} and grows by the hiring pace above.
                    </li>
                    <li>
                      <b className="text-[#0e1b3d]">Pay per head</b> starts at {moneyFull(fc.drivers.payPerHead)}, the middle value of the last 3
                      months, so one catch-up month does not distort it.
                    </li>
                    <li>
                      <b className="text-[#0e1b3d]">Non-payroll</b> is {moneyFull(fc.drivers.nonPayrollPerHead)} per head a month, the middle value
                      of the last 6 months, so one-off months such as a big event do not repeat in the forecast.
                    </li>
                    <li>
                      <b className="text-[#0e1b3d]">Likely range:</b>{" "}
                      {fc.mape === null
                        ? "not enough history to measure it."
                        : `when this method was run on each of the last ${fc.mapeMonths} months, its next-month figure was off by ${fc.mape.toFixed(1)}% on average. The range is that, widened the further ahead you look.`}
                    </li>
                    <li className="text-slate-400">
                      Incentives, consultants and settlements are left out, the same as the people cost on the other tabs.
                    </li>
                  </ul>
                </Panel>
              </div>

              <Panel title="Month by month" hint={`The next ${horizon} months`}>
                <ScrollTable>
                  <table className="w-full min-w-[560px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/70 text-[10px] uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2">Month</th>
                        <th className="px-3 py-2 text-right">People</th>
                        <th className="px-3 py-2 text-right">Payroll</th>
                        <th className="px-3 py-2 text-right">Non-payroll</th>
                        <th className="px-3 py-2 text-right">People cost</th>
                        <th className="px-3 py-2 text-right">Likely range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {horizonMonths.map((m) => (
                        <tr key={m.key} className="border-b border-slate-100 last:border-0">
                          <th className="px-3 py-2 font-semibold text-[#0e1b3d]">{m.label}</th>
                          <td className="px-3 py-2 text-right tabular-nums">{count(Math.round(m.headcount))}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(m.payroll)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(m.nonPayroll)}</td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-[#0e1b3d]">{money(m.peopleCost)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                            {money(m.low)} to {money(m.high)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollTable>
              </Panel>
              </>
              )}
            </>
          )}
        </>
      )}
      {fc && editingProject && (
        <ProjectBuilder
          key={editingProject.id}
          project={editingProject}
          patch={patchEditing}
          onClose={() => setEditingId(null)}
          onDelete={() => deleteProject(editingProject.id)}
          fc={fc}
          lastActualLabel={d.months[last].label}
          monthOptions={fc.months.map((m) => ({ key: m.key, label: m.label }))}
          ctx={planCtx}
        />
      )}
    </div>
  );
}

/** The title row of the page: heading plus the data-notes flag. */
export function FinancialsHeader({ notes, source }: { notes: string[]; source: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-lg font-bold text-[#0e1b3d]">Financials</h1>
        <p className="text-sm text-slate-500">
          People cost and headcount, month by month. Click any month in a chart, or any card, bar or name, to focus it.
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{source}</p>
      </div>
      <DataNotesFlag notes={notes} />
    </div>
  );
}
