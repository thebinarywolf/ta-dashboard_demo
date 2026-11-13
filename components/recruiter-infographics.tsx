"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GLASS_PANEL } from "@/components/glass-card";
import RecruiterDetailDialog from "@/components/recruiter-detail-dialog";
import ScrollTable from "@/components/scroll-table";
import {
  CLOSER_NOT_RECORDED,
  JOINTLY_CLOSED,
  drillDown,
  type DrillMetric,
  type DrillQuery,
  type MetricKey,
  type RecruiterAnalytics,
  type RecruiterRow,
} from "@/lib/metrics/recruiter-analytics";

// Blue family only, dark to light.
const C = { dark: "#0c2d70", brand: "#1e50cc", mid: "#5b83db", light: "#9bb5ea", pale: "#dbe8fb", dim: "#d6e2f8" };

type BarMetric = "openNow" | "closed" | "interviews" | "selected" | "avgDaysToClose" | "selectionRate";

const BAR_METRICS: { key: BarMetric; label: string; drill: DrillMetric; unit?: string }[] = [
  { key: "openNow", label: "Open now", drill: "open" },
  { key: "closed", label: "Closed", drill: "closed" },
  { key: "interviews", label: "Interviews", drill: "interviews" },
  { key: "selected", label: "Selected", drill: "selected" },
  { key: "avgDaysToClose", label: "Avg days to close", drill: "closed", unit: "d" },
  { key: "selectionRate", label: "Selection rate", drill: "interviews", unit: "%" },
];

const TREND_METRICS: { key: MetricKey; label: string }[] = [
  { key: "closed", label: "Positions closed" },
  { key: "interviews", label: "Interviews" },
  { key: "selected", label: "Candidates selected" },
  { key: "assigned", label: "Positions assigned" },
];

const METRIC_TITLE: Record<DrillMetric, string> = {
  open: "Open positions",
  closed: "Positions closed",
  openClosed: "Open and closed positions",
  assigned: "Positions assigned",
  interviews: "Interviews",
  selected: "Candidates selected",
  rejected: "Candidates rejected",
  onHold: "Candidates on hold",
};

function monthLabel(m: string): string {
  return new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const heat = (value: number, max: number) =>
  value > 0 && max > 0 ? { backgroundColor: `rgba(30, 80, 204, ${0.1 + 0.55 * (value / max)})` } : undefined;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${
        active ? "bg-brand-blue text-white" : "bg-white/70 text-slate-600 hover:bg-white hover:text-brand-blue"
      }`}
    >
      {children}
    </button>
  );
}

function Panel({
  title,
  hint,
  right,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`${GLASS_PANEL} p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#0e1b3d]">{title}</h2>
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
        </div>
        {right}
      </div>
      <div className="mt-3 [&_.recharts-wrapper]:outline-none [&_.recharts-surface]:outline-none [&_svg]:outline-none">{children}</div>
    </section>
  );
}

/** A ring that fills to a percentage. */
function Ring({ pct, size = 64, label }: { pct: number | null; size?: number; label?: string }) {
  const r = 15.9155;
  const fill = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#e6eefb" strokeWidth="4.5" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={C.brand}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={`${fill} ${100 - fill}`}
          style={{ transition: "stroke-dasharray .5s ease" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-[#0e1b3d]">
        {label ?? (pct === null ? "–" : `${Math.round(pct)}%`)}
      </span>
    </div>
  );
}

/** A tiny line of the last months, drawn as plain SVG. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2 || values.every((v) => v === 0)) return null;
  const max = Math.max(...values, 1);
  const w = 100;
  const h = 28;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 3 - (v / max) * (h - 8)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden className="mt-2 h-7 w-full">
      <polygon points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill={C.pale} />
      <polyline points={pts.join(" ")} fill="none" stroke={C.brand} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Kpi({
  label,
  value,
  sub,
  onClick,
  children,
}: {
  label: string;
  value: string;
  sub: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-[#0e1b3d]">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
      {children}
    </>
  );
  if (!onClick) return <div className={`${GLASS_PANEL} p-4`}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Click to see the list"
      className={`${GLASS_PANEL} p-4 text-left transition hover:ring-2 hover:ring-brand-blue/40`}
    >
      {body}
    </button>
  );
}

const tooltipStyle = {
  contentStyle: { borderRadius: 12, border: "1px solid #dbe8fb", fontSize: 12, boxShadow: "0 6px 20px rgba(30,80,204,.12)" },
  cursor: { fill: "rgba(30,80,204,0.06)" },
};

/** Reads the data row of a clicked chart element (recharts passes it as `payload`). */
function rowOf<T>(d: unknown): T | null {
  const p = (d as { payload?: T } | null)?.payload;
  return p ?? (d as T | null);
}

export default function RecruiterInfographics({
  analytics,
  periodText,
}: {
  analytics: RecruiterAnalytics;
  periodText: string;
}) {
  const { recruiters, totals, seniorities, seniorityMatrix, seniorityTotals, months, monthly, monthlyTotals, jointCombos } =
    analytics;
  const [scope, setScope] = useState<string | null>(null);
  const [barMetric, setBarMetric] = useState<BarMetric>("closed");
  const [trend, setTrend] = useState<MetricKey>("closed");
  const [drill, setDrill] = useState<{ title: string; subtitle: string; query: DrillQuery } | null>(null);
  const closeDrill = useCallback(() => setDrill(null), []);

  const people = recruiters.filter((r) => r.kind === "recruiter");
  const extras = recruiters.filter((r) => r.kind !== "recruiter");
  const scopeRow: RecruiterRow | null = scope ? (recruiters.find((r) => r.name === scope) ?? null) : null;
  const isExtra = !!scopeRow && scopeRow.kind !== "recruiter";
  const stats = scopeRow ?? totals;
  const scopeLabel = scopeRow ? scopeRow.name : "Everyone";

  const drillResult = useMemo(
    () => (drill ? drillDown(analytics.details, drill.query) : null),
    [drill, analytics.details]
  );

  const open = (query: DrillQuery, titleOverride?: string) => {
    const q: DrillQuery = { ...query };
    const parts = [titleOverride ?? METRIC_TITLE[q.metric]];
    if (q.name) parts.push(q.name);
    if (q.combo) parts.push(q.combo);
    if (q.level) parts.push(q.level);
    if (q.month) parts.push(monthLabel(q.month));
    setDrill({ title: parts.join(" · "), subtitle: q.metric === "open" ? "open today" : periodText, query: q });
  };
  const forScope = (metric: DrillMetric, extra: Partial<DrillQuery> = {}): DrillQuery => ({
    metric,
    ...(scopeRow ? { name: scopeRow.name } : {}),
    ...extra,
  });

  // ---- chart data -------------------------------------------------------
  const sparkOf = (metric: MetricKey) =>
    months.map((m) => (scopeRow ? (monthly[metric][scopeRow.name]?.[m] ?? 0) : (monthlyTotals[metric][m] ?? 0)));

  const barDef = BAR_METRICS.find((m) => m.key === barMetric)!;
  const barRows = recruiters
    .filter((r) => r.kind === "recruiter" || barMetric === "closed")
    .map((r) => ({ name: r.name, kind: r.kind, value: r[barMetric] ?? 0, raw: r[barMetric] }))
    .filter((r) => r.raw !== null)
    .sort((a, b) => b.value - a.value);
  const barHeight = Math.max(220, barRows.length * 34 + 40);

  const outcome = [
    { key: "selected" as const, name: "Selected", value: stats.selected, color: C.brand },
    { key: "rejected" as const, name: "Rejected", value: stats.rejected, color: C.light },
    { key: "onHold" as const, name: "On hold", value: stats.onHold, color: C.mid },
    {
      key: "other" as const,
      name: "No outcome",
      value: Math.max(0, stats.interviews - stats.selected - stats.rejected - stats.onHold),
      color: C.pale,
    },
  ].filter((o) => o.value > 0);

  const seniorityData = seniorities.map((l) => {
    const c = scopeRow ? (seniorityMatrix[scopeRow.name]?.[l] ?? { open: 0, closed: 0 }) : (seniorityTotals[l] ?? { open: 0, closed: 0 });
    return { level: l, Open: c.open, Closed: c.closed };
  });
  const seniorityHasData = seniorityData.some((d) => d.Open + d.Closed > 0);

  const trendData = months.map((m) => ({
    month: m,
    label: monthLabel(m),
    value: scopeRow ? (monthly[trend][scopeRow.name]?.[m] ?? 0) : (monthlyTotals[trend][m] ?? 0),
  }));
  const trendHasData = trendData.some((d) => d.value > 0);

  const heatRows = recruiters.filter((r) => r.kind === "recruiter" || trend === "closed");
  const heatMax = Math.max(1, ...heatRows.flatMap((r) => months.map((m) => monthly[trend][r.name]?.[m] ?? 0)));

  if (recruiters.length === 0) {
    return (
      <div className={`${GLASS_PANEL} p-8 text-center text-sm text-slate-400`}>
        No data for this period — try a wider date range, or run a sync from the Admin panel.
      </div>
    );
  }

  const unit = barDef.unit ?? "";

  return (
    <div className="space-y-6">
      {/* Who the charts are showing */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-slate-500">Showing</span>
        <span className="rounded-full bg-brand-blue px-3 py-1 font-bold text-white">{scopeLabel}</span>
        {scopeRow && (
          <button
            type="button"
            onClick={() => setScope(null)}
            className="rounded-full bg-white/70 px-3 py-1 font-bold text-slate-600 hover:bg-white hover:text-brand-blue"
          >
            Show everyone again ✕
          </button>
        )}
        <span className="text-slate-400">· pick a recruiter below to focus every chart on them, click any bar, slice or number to see the list.</span>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi
          label="Open positions"
          value={isExtra ? "–" : String(stats.openNow)}
          sub={scopeRow ? "Open today, assigned to them" : "Open today, across all recruiters"}
          onClick={!isExtra && stats.openNow > 0 ? () => open(forScope("open")) : undefined}
        />
        <Kpi
          label="Positions closed"
          value={String(stats.closed)}
          sub={`${periodText}${scopeRow ? "" : " · each counted once"}`}
          onClick={stats.closed > 0 ? () => open(forScope("closed")) : undefined}
        >
          <Sparkline values={sparkOf("closed")} />
        </Kpi>
        <Kpi
          label="Interviews"
          value={isExtra ? "–" : String(stats.interviews)}
          sub={isExtra ? "Not tracked here" : `${stats.candidates} different candidates`}
          onClick={!isExtra && stats.interviews > 0 ? () => open(forScope("interviews")) : undefined}
        >
          {!isExtra && <Sparkline values={sparkOf("interviews")} />}
        </Kpi>
        <Kpi
          label="Avg days to close"
          value={stats.avgDaysToClose === null ? "–" : `${Math.round(stats.avgDaysToClose)}d`}
          sub="From assigned to closed"
          onClick={stats.closed > 0 ? () => open(forScope("closed"), "Positions closed (days to close)") : undefined}
        />
        <div className={`${GLASS_PANEL} flex items-center justify-between gap-3 p-4`}>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selection rate</p>
            <p className="mt-1 text-xs text-slate-500">Selected of decided</p>
            <p className="mt-1 text-xs font-semibold text-[#0e1b3d]">
              {isExtra ? "–" : `${stats.selected} of ${stats.selected + stats.rejected}`}
            </p>
          </div>
          <Ring pct={isExtra ? null : stats.selectionRate} />
        </div>
      </div>

      {/* Recruiter cards: pick who to focus on */}
      <Panel title="Recruiters" hint="Click a card to focus the charts on that recruiter.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => setScope(null)}
            aria-pressed={scope === null}
            className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
              scope === null ? "border-brand-blue bg-blue-50 ring-2 ring-brand-blue/30" : "border-white/70 bg-white/60 hover:bg-white"
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs font-extrabold text-white">
              ALL
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[#0e1b3d]">Everyone</span>
              <span className="block text-[11px] text-slate-500">
                {totals.openNow} open · {totals.closed} closed · {totals.interviews} interviews
              </span>
            </span>
          </button>
          {people.map((r) => {
            const active = scope === r.name;
            return (
              <button
                key={r.name}
                type="button"
                onClick={() => setScope(active ? null : r.name)}
                aria-pressed={active}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                  active ? "border-brand-blue bg-blue-50 ring-2 ring-brand-blue/30" : "border-white/70 bg-white/60 hover:bg-white"
                }`}
              >
                <Ring pct={r.selectionRate} size={44} label={initials(r.name)} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-[#0e1b3d]">{r.name}</span>
                  <span className="block text-[11px] text-slate-500">
                    {r.openNow} open · {r.closed} closed · {r.interviews} interviews
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {extras.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500">Closed without one owner:</span>
            {extras.map((r) => (
              <Chip key={r.name} active={scope === r.name} onClick={() => setScope(scope === r.name ? null : r.name)}>
                {r.name} · {r.closed}
              </Chip>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-400">
          The ring around each initial is that recruiter&apos;s selection rate.
        </p>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Compare recruiters */}
        <Panel
          title="Compare recruiters"
          hint="Click a bar to see the list behind it."
          className="lg:col-span-3"
          right={
            <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
              {BAR_METRICS.map((m) => (
                <Chip key={m.key} active={barMetric === m.key} onClick={() => setBarMetric(m.key)}>
                  {m.label}
                </Chip>
              ))}
            </div>
          }
        >
          <div style={{ height: barHeight }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barRows} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e6eefb" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} interval={0} />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v) => [`${Math.round(Number(v))}${unit}`, barDef.label]}
                />
                <Bar
                  dataKey="value"
                  radius={[0, 6, 6, 0]}
                  cursor="pointer"
                  label={{ position: "right", fontSize: 11, fill: "#0e1b3d", formatter: (v: unknown) => `${Math.round(Number(v))}${unit}` }}
                  onClick={(d: unknown) => {
                    const row = rowOf<{ name: string; kind: string }>(d);
                    if (!row) return;
                    open({ metric: barDef.drill, name: row.name }, barMetric === "avgDaysToClose" ? "Positions closed (days to close)" : undefined);
                  }}
                >
                  {barRows.map((r) => (
                    <Cell
                      key={r.name}
                      fill={r.kind !== "recruiter" ? C.light : scope === null || scope === r.name ? C.brand : C.dim}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Interview outcomes */}
        <Panel
          title="Interview outcomes"
          hint={`${scopeLabel} · ${periodText}`}
          className="lg:col-span-2"
        >
          {isExtra || outcome.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              {isExtra ? "Interviews are credited to the recruiter who ran them, not to this row." : "No interviews in this period."}
            </p>
          ) : (
            <>
              <div className="relative mx-auto h-56 w-full max-w-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip {...tooltipStyle} />
                    <Pie
                      data={outcome}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="62%"
                      outerRadius="92%"
                      paddingAngle={2}
                      cursor="pointer"
                      onClick={(d: unknown) => {
                        const row = rowOf<{ key: string }>(d);
                        if (!row || row.key === "other") return;
                        open(forScope(row.key as DrillMetric));
                      }}
                    >
                      {outcome.map((o) => (
                        <Cell key={o.key} fill={o.color} stroke="#fff" />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold text-[#0e1b3d]">{stats.interviews}</span>
                  <span className="text-[11px] text-slate-500">interviews</span>
                </div>
              </div>
              <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-600">
                {outcome.map((o) => (
                  <li key={o.key} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />
                    {o.name} <b className="text-[#0e1b3d]">{o.value}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Seniority */}
        <Panel
          title="Positions by seniority"
          hint={`${scopeLabel} · open is today, closed is ${periodText}`}
          className="lg:col-span-2"
        >
          {seniorityHasData ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={seniorityData} margin={{ left: -16, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6eefb" />
                  <XAxis dataKey="level" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip {...tooltipStyle} />
                  <Bar
                    dataKey="Open"
                    stackId="s"
                    fill={C.brand}
                    cursor="pointer"
                    onClick={(d: unknown) => {
                      const row = rowOf<{ level: string }>(d);
                      if (row) open(forScope("open", { level: row.level }));
                    }}
                  />
                  <Bar
                    dataKey="Closed"
                    stackId="s"
                    fill={C.light}
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    onClick={(d: unknown) => {
                      const row = rowOf<{ level: string }>(d);
                      if (row) open(forScope("closed", { level: row.level }));
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">No positions to show.</p>
          )}
          <div className="mt-1 flex justify-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.brand }} /> Open
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.light }} /> Closed
            </span>
          </div>
        </Panel>

        {/* Month by month */}
        <Panel
          title="Month by month"
          hint={`${scopeLabel} · click a bar to see that month`}
          className="lg:col-span-3"
          right={
            <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
              {TREND_METRICS.map((m) => (
                <Chip key={m.key} active={trend === m.key} onClick={() => setTrend(m.key)}>
                  {m.label}
                </Chip>
              ))}
            </div>
          }
        >
          {trendHasData ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ left: -16, right: 8, top: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e6eefb" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(v) => [String(v), TREND_METRICS.find((m) => m.key === trend)!.label]}
                  />
                  <Bar
                    dataKey="value"
                    fill={C.brand}
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    label={{ position: "top", fontSize: 10, fill: "#0e1b3d", formatter: (v: unknown) => (Number(v) > 0 ? String(v) : "") }}
                    onClick={(d: unknown) => {
                      const row = rowOf<{ month: string; value: number }>(d);
                      if (row && row.value > 0) open(forScope(trend, { month: row.month }));
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-400">Nothing in these months.</p>
          )}
        </Panel>
      </div>

      {/* Heat map of everyone, month by month */}
      <Panel
        title="Everyone, month by month"
        hint={`${TREND_METRICS.find((m) => m.key === trend)!.label} · darker means more · same metric as the chart above`}
      >
        <ScrollTable>
          <table className="w-full min-w-[520px] border-separate border-spacing-1 text-center text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-2 py-1 text-left">Recruiter</th>
                {months.map((m) => (
                  <th key={m} className="whitespace-nowrap px-2 py-1 font-semibold">
                    {monthLabel(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatRows.map((r) => (
                <tr key={r.name}>
                  <td className="whitespace-nowrap px-2 py-1 text-left font-semibold text-[#0e1b3d]">{r.name}</td>
                  {months.map((m) => {
                    const v = monthly[trend][r.name]?.[m] ?? 0;
                    return (
                      <td key={m} className="rounded-md p-0" style={heat(v, heatMax) ?? { backgroundColor: "#f3f7fd" }}>
                        {v === 0 ? (
                          <span className="block px-2 py-1.5 text-slate-300">–</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => open({ metric: trend, name: r.name, month: m })}
                            title={`${r.name} · ${monthLabel(m)}`}
                            className={`block w-full rounded-md px-2 py-1.5 font-bold hover:ring-2 hover:ring-brand-blue ${
                              v / heatMax > 0.55 ? "text-white" : "text-[#0e1b3d]"
                            }`}
                          >
                            {v}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      </Panel>

      {/* Closed together */}
      {(analytics.sharedClosures > 0 || extras.some((r) => r.name === CLOSER_NOT_RECORDED)) && (
        <Panel
          title="Positions closed together"
          hint="Closed by more than one recruiter. Counted once in the totals, shown here instead of being credited to each."
        >
          {jointCombos.length > 0 ? (
            <ul className="space-y-2">
              {jointCombos.map((c) => (
                <li key={c.label}>
                  <button
                    type="button"
                    onClick={() => open({ metric: "closed", name: JOINTLY_CLOSED, combo: c.label }, "Jointly closed")}
                    className="group flex w-full items-center gap-3 text-left"
                  >
                    <span className="w-48 shrink-0 truncate text-xs font-semibold text-[#0e1b3d] group-hover:text-brand-blue">
                      {c.label}
                    </span>
                    <span className="h-5 flex-1 rounded-full bg-blue-50">
                      <span
                        className="block h-5 rounded-full bg-brand-blue transition group-hover:bg-brand-blue-dark"
                        style={{ width: `${Math.max(6, (c.count / jointCombos[0].count) * 100)}%` }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right text-xs font-extrabold text-[#0e1b3d]">{c.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">No jointly closed positions in this period.</p>
          )}
          {extras.some((r) => r.name === CLOSER_NOT_RECORDED) && (
            <p className="mt-3 text-xs text-slate-500">
              <button
                type="button"
                onClick={() => open({ metric: "closed", name: CLOSER_NOT_RECORDED })}
                className="font-bold text-brand-blue hover:underline"
              >
                {extras.find((r) => r.name === CLOSER_NOT_RECORDED)!.closed} closed{" "}
                {extras.find((r) => r.name === CLOSER_NOT_RECORDED)!.closed === 1 ? "position has" : "positions have"} no closing
                recruiter recorded
              </button>{" "}
              in the sheet.
            </p>
          )}
        </Panel>
      )}

      {drill && drillResult && (
        <RecruiterDetailDialog title={drill.title} subtitle={drill.subtitle} result={drillResult} onClose={closeDrill} />
      )}
    </div>
  );
}
