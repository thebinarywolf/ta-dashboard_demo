"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GLASS_PANEL } from "@/components/glass-card";
import ScrollTable from "@/components/scroll-table";
import type { FinMonth, Series } from "@/lib/metrics/financials-parse";

// Categorical hues in their fixed order (blue, orange, aqua, yellow, magenta, green, violet, red),
// so a team or cost item keeps its colour wherever it appears. Grey is for "everything else".
export const PAL = {
  brand: "#1e50cc",
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  yellow: "#eda100",
  magenta: "#e87ba4",
  green: "#008300",
  violet: "#6250d6",
  red: "#e34948",
  grey: "#94a3b8",
  ink: "#0e1b3d",
  muted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
};
export const CATEGORICAL = [PAL.blue, PAL.orange, PAL.aqua, PAL.yellow, PAL.magenta, PAL.green, PAL.violet, PAL.red];

/** 2.3Cr, 17L, 45000 for axis ticks. */
export function axisMoney(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e7) return `${(n / 1e7).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (a >= 1e5) return `${(n / 1e5).toFixed(a >= 1e6 ? 0 : 1).replace(/\.0$/, "")}L`;
  if (a >= 1e3) return `${Math.round(n / 1e3)}K`;
  return String(Math.round(n));
}

/** What recharts hands a custom bar shape: the rectangle's geometry plus the data row it draws. */
type BarShape = React.ComponentProps<typeof Rectangle> & { payload?: { i?: number; v?: number | null } };

/**
 * Round axis ticks from zero: the smallest step (1, 2, 2.5 or 5 times a power of
 * ten) that covers the data in five steps or fewer, so the top of the chart is
 * never far above the tallest bar.
 */
function niceScale(max: number): { top: number; ticks: number[] } {
  if (!(max > 0)) return { top: 1, ticks: [0, 1] };
  const exp = Math.pow(10, Math.floor(Math.log10(max)) - 1);
  for (const mult of [1, 2, 2.5, 5, 10, 20, 25, 50, 100]) {
    const step = mult * exp;
    const n = Math.ceil(max / step - 1e-9);
    if (n <= 5) return { top: n * step, ticks: Array.from({ length: n + 1 }, (_, k) => k * step) };
  }
  return { top: max, ticks: [0, max] };
}

// ------------------------------------------------------------------ chrome

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

export function Panel({
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
    <section className={`${GLASS_PANEL} min-w-0 p-5 ${className}`}>
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

// ------------------------------------------------------------ month charts

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  values: Series;
}

interface TipPayload {
  dataKey?: unknown;
  value?: unknown;
}

function Tip({
  active,
  payload,
  label,
  series,
  fmt,
  total,
  clickable = true,
}: {
  clickable?: boolean;
  active?: boolean;
  payload?: readonly TipPayload[];
  label?: React.ReactNode;
  series: ChartSeries[];
  fmt: (n: number) => string;
  total: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = series
    .map((s) => ({ s, v: payload.find((p) => p.dataKey === s.key)?.value }))
    .filter((r): r is { s: ChartSeries; v: number } => typeof r.v === "number");
  if (rows.length === 0) return null;
  const sum = rows.reduce((a, r) => a + r.v, 0);
  return (
    <div className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs shadow-[0_10px_30px_rgba(30,80,204,0.18)]">
      <p className="mb-1 font-bold text-[#0e1b3d]">{label}</p>
      {rows.map(({ s, v }) => (
        <p key={s.key} className="flex items-center justify-between gap-4 text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
          <b className="text-[#0e1b3d]">{fmt(v)}</b>
        </p>
      ))}
      {total && rows.length > 1 && (
        <p className="mt-1 flex items-center justify-between gap-4 border-t border-slate-100 pt-1 font-bold text-[#0e1b3d]">
          <span>Total</span>
          <span>{fmt(sum)}</span>
        </p>
      )}
      {clickable && <p className="mt-1 text-[10px] text-slate-400">Click to focus this month</p>}
    </div>
  );
}

/**
 * Months along the bottom, one or more series. Click a month to focus it (the
 * rest of the page follows); click a legend item to hide or show that series.
 */
export function MonthChart({
  months,
  idx,
  series,
  kind,
  focus,
  onFocus,
  fmt,
  axisFmt,
  height = 260,
}: {
  months: FinMonth[];
  /** Which months (absolute positions) are on screen. */
  idx: number[];
  series: ChartSeries[];
  kind: "bar" | "stack" | "line" | "area";
  focus: number;
  onFocus: (i: number) => void;
  fmt: (n: number) => string;
  axisFmt?: (n: number) => string;
  height?: number;
}) {
  const [hidden, setHidden] = useState<string[]>([]);
  const shown = series.filter((s) => !hidden.includes(s.key));
  const rows = idx.map((i) => {
    const row: Record<string, number | string | null> = { i, name: months[i].short };
    for (const s of shown) row[s.key] = s.values[i];
    return row;
  });
  const focusName = idx.includes(focus) ? months[focus].short : null;
  // Bars and areas start at zero and stop at a round number; lines fit their own range.
  const scale = niceScale(
    Math.max(
      0,
      ...idx.map((i) =>
        kind === "stack" ? shown.reduce((a, s) => a + (s.values[i] ?? 0), 0) : Math.max(0, ...shown.map((s) => s.values[i] ?? 0))
      )
    )
  );
  const domain: [number, number] | undefined = kind === "line" ? undefined : [0, scale.top];

  const common = {
    data: rows,
    margin: { top: 8, right: 8, bottom: 0, left: 0 },
    onClick: (s: { activeTooltipIndex?: number | string | null }) => {
      const k = Number(s?.activeTooltipIndex);
      if (Number.isInteger(k) && idx[k] !== undefined) onFocus(idx[k]);
    },
  };
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke={PAL.grid} />
      <XAxis
        dataKey="name"
        tickLine={false}
        axisLine={{ stroke: PAL.axis }}
        tick={{ fill: PAL.muted, fontSize: 11 }}
        interval="preserveStartEnd"
        minTickGap={6}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={52}
        domain={domain}
        ticks={kind === "line" ? undefined : scale.ticks}
        tickCount={kind === "line" ? 6 : undefined}
        tick={{ fill: PAL.muted, fontSize: 11 }}
        tickFormatter={(v: number) => (axisFmt ?? fmt)(v)}
      />
      <Tooltip
        cursor={{ fill: "rgba(30,80,204,0.06)", stroke: PAL.axis }}
        content={(p) => (
          <Tip active={p.active} payload={p.payload} label={p.label} series={shown} fmt={fmt} total={kind === "stack"} clickable={focus >= 0} />
        )}
      />
      {focusName && <ReferenceLine x={focusName} stroke={PAL.brand} strokeDasharray="4 3" strokeOpacity={0.7} />}
    </>
  );

  return (
    <div>
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
          {series.map((s) => {
            const off = hidden.includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={!off}
                title={off ? "Show" : "Hide"}
                onClick={() => setHidden((h) => (off ? h.filter((k) => k !== s.key) : [...h, s.key]))}
                className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold transition hover:bg-white ${
                  off ? "text-slate-400 line-through" : "text-slate-600"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: off ? "#cbd5e1" : s.color }} />
                {s.label}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ height }} className="cursor-pointer">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "line" ? (
            <LineChart {...common}>
              {axes}
              {shown.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: s.color, stroke: "#fff", strokeWidth: 1.5 }}
                  activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          ) : kind === "area" ? (
            <AreaChart {...common}>
              {axes}
              {shown.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  fill={s.color}
                  fillOpacity={0.14}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </AreaChart>
          ) : (
            <BarChart {...common} barCategoryGap="22%">
              {axes}
              {shown.map((s) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  fill={s.color}
                  stackId={kind === "stack" ? "a" : undefined}
                  radius={kind === "stack" ? 0 : [4, 4, 0, 0]}
                  stroke={kind === "stack" ? "#fff" : undefined}
                  strokeWidth={kind === "stack" ? 1.5 : 0}
                  isAnimationActive={false}
                  shape={(p: unknown) => {
                    const q = p as BarShape;
                    return <Rectangle {...q} fillOpacity={focus < 0 || q.payload?.i === focus ? 1 : 0.62} />;
                  }}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Bars up and down from zero, for change month to month. */
export function ChangeChart({
  months,
  idx,
  values,
  focus,
  onFocus,
  fmt,
  height = 200,
}: {
  months: FinMonth[];
  idx: number[];
  values: Series;
  focus: number;
  onFocus: (i: number) => void;
  fmt: (n: number) => string;
  height?: number;
}) {
  const rows = idx.map((i) => ({ i, name: months[i].short, v: values[i] }));
  const series: ChartSeries[] = [{ key: "v", label: "Change", color: PAL.brand, values }];
  return (
    <div style={{ height }} className="cursor-pointer">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          barCategoryGap="22%"
          onClick={(s: { activeTooltipIndex?: number | string | null }) => {
            const k = Number(s?.activeTooltipIndex);
            if (Number.isInteger(k) && idx[k] !== undefined) onFocus(idx[k]);
          }}
        >
          <CartesianGrid vertical={false} stroke={PAL.grid} />
          <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: PAL.axis }} tick={{ fill: PAL.muted, fontSize: 11 }} interval="preserveStartEnd" minTickGap={6} />
          <YAxis tickLine={false} axisLine={false} width={40} tick={{ fill: PAL.muted, fontSize: 11 }} />
          <ReferenceLine y={0} stroke={PAL.axis} />
          <Tooltip
            cursor={{ fill: "rgba(30,80,204,0.06)" }}
            content={(p) => <Tip active={p.active} payload={p.payload} label={p.label} series={series} fmt={fmt} total={false} />}
          />
          <Bar
            dataKey="v"
            radius={[4, 4, 4, 4]}
            isAnimationActive={false}
            shape={(p: unknown) => {
              const q = p as BarShape;
              return (
                <Rectangle
                  {...q}
                  fill={(q.payload?.v ?? 0) >= 0 ? PAL.brand : PAL.orange}
                  fillOpacity={q.payload?.i === focus ? 1 : 0.62}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ------------------------------------------------------------------ donut

export interface Slice {
  label: string;
  value: number;
  color: string;
}

/** A ring split into slices. Hover (or tap) a slice or its row to read it. */
export function Donut({
  slices,
  fmt,
  centerLabel,
}: {
  slices: Slice[];
  fmt: (n: number) => string;
  centerLabel: string;
}) {
  const [hot, setHot] = useState<number | null>(null);
  const total = slices.reduce((a, s) => a + Math.max(0, s.value), 0);
  let offset = 0;
  const r = 15.9155;
  const active = hot !== null ? slices[hot] : null;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="20" cy="20" r={r} fill="none" stroke="#e6eefb" strokeWidth="5" />
          {total > 0 &&
            slices.map((s, i) => {
              const share = (Math.max(0, s.value) / total) * 100;
              const el = (
                <circle
                  key={s.label}
                  cx="20"
                  cy="20"
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hot === i ? 6.2 : 5}
                  strokeDasharray={`${Math.max(0, share - 0.8)} ${100 - Math.max(0, share - 0.8)}`}
                  strokeDashoffset={-offset}
                  opacity={hot === null || hot === i ? 1 : 0.3}
                  style={{ transition: "opacity .2s, stroke-width .2s", cursor: "pointer" }}
                  onMouseEnter={() => setHot(i)}
                  onMouseLeave={() => setHot(null)}
                  onClick={() => setHot(hot === i ? null : i)}
                />
              );
              offset += share;
              return el;
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
          <span className="text-base font-extrabold leading-tight text-[#0e1b3d]">{fmt(active ? active.value : total)}</span>
          <span className="mt-0.5 text-[10px] font-semibold text-slate-500">
            {active ? `${active.label} · ${total > 0 ? Math.round((active.value / total) * 100) : 0}%` : centerLabel}
          </span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-0.5">
        {slices.map((s, i) => (
          <li
            key={s.label}
            onMouseEnter={() => setHot(i)}
            onMouseLeave={() => setHot(null)}
            className={`flex cursor-default items-center justify-between gap-3 rounded-lg px-2 py-1 text-xs transition ${
              hot === i ? "bg-white" : ""
            }`}
          >
            <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="shrink-0 font-bold text-[#0e1b3d]">
              {fmt(s.value)}
              <span className="ml-1 font-normal text-slate-400">{total > 0 ? Math.round((s.value / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------- bar rows

export interface BarRowData {
  key: string;
  label: string;
  value: number | null;
  /** Small text under the label. */
  sub?: string;
  color?: string;
}

/** Ranked horizontal bars. Click a row to select it. */
export function HBars({
  rows,
  fmt,
  selected,
  onSelect,
  empty = "Nothing to show for this period.",
}: {
  rows: BarRowData[];
  fmt: (n: number) => string;
  selected?: string | null;
  onSelect?: (key: string) => void;
  empty?: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value ?? 0));
  if (rows.length === 0 || max === 0) return <p className="text-xs text-slate-400">{empty}</p>;
  return (
    <ul className="space-y-0.5">
      {rows.map((r) => {
        const on = selected === r.key;
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className={`truncate ${on ? "font-bold text-brand-blue" : "text-[#0e1b3d]"}`}>
                {r.label}
                {r.sub && <span className="ml-1.5 font-normal text-slate-400">{r.sub}</span>}
              </span>
              <span className="shrink-0 font-bold text-[#0e1b3d]">{r.value === null ? "–" : fmt(r.value)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-blue-50">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${((r.value ?? 0) / max) * 100}%`, backgroundColor: r.color ?? PAL.brand }}
              />
            </div>
          </>
        );
        return (
          <li key={r.key}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(r.key)}
                aria-pressed={on}
                className={`block w-full rounded-xl px-2 py-1.5 text-left transition hover:bg-white/80 ${on ? "bg-white ring-1 ring-brand-blue/30" : ""}`}
              >
                {body}
              </button>
            ) : (
              <div className="px-2 py-1.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ----------------------------------------------------------- month table

export interface HeatRow {
  key: string;
  label: string;
  values: Series;
  /** Shown under a divider after the main rows. */
  muted?: boolean;
}

/**
 * The sheet's own layout - names down the side, one column per month - with each
 * cell shaded by size. Click a month heading to focus that month, a name to select it.
 */
export function HeatTable({
  months,
  idx,
  rows,
  fmt,
  focus,
  onFocus,
  selected,
  onSelect,
  shade,
  showTotal,
}: {
  months: FinMonth[];
  idx: number[];
  rows: HeatRow[];
  fmt: (n: number) => string;
  focus: number;
  onFocus: (i: number) => void;
  selected?: string | null;
  onSelect?: (key: string) => void;
  /** Scale the shading against the whole table or against each row. */
  shade: "table" | "row";
  showTotal?: boolean;
}) {
  const vals = (r: HeatRow) => idx.map((i) => r.values[i] ?? 0);
  const tableMax = Math.max(1, ...rows.flatMap((r) => vals(r)));
  const cell = (v: number | null, max: number) =>
    v !== null && v > 0 ? { backgroundColor: `rgba(30, 80, 204, ${0.07 + 0.5 * (v / max)})` } : undefined;
  const firstMuted = rows.findIndex((r) => r.muted);

  return (
    <ScrollTable className={`${GLASS_PANEL} max-h-[520px]`}>
      <table className="w-full border-separate border-spacing-0 text-left text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 min-w-[150px] bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500" />
            {idx.map((i) => (
              <th key={i} className="sticky top-0 z-10 bg-white px-1 py-1 text-right">
                <button
                  type="button"
                  onClick={() => onFocus(i)}
                  className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                    focus === i ? "bg-brand-blue text-white" : "text-slate-500 hover:bg-blue-50 hover:text-brand-blue"
                  }`}
                >
                  {months[i].short}
                </button>
              </th>
            ))}
            {showTotal && (
              <th className="sticky top-0 z-10 bg-white px-3 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Total
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const v = vals(r);
            const rowMax = Math.max(1, ...v);
            const on = selected === r.key;
            return (
              <tr key={r.key} className={r.muted ? "text-slate-500" : ""}>
                <th
                  className={`sticky left-0 z-10 border-t px-3 py-1.5 text-left font-semibold ${
                    ri === firstMuted ? "border-slate-300" : "border-slate-100"
                  } ${on ? "bg-blue-50 text-brand-blue" : "bg-white text-[#0e1b3d]"}`}
                >
                  {onSelect ? (
                    <button type="button" onClick={() => onSelect(r.key)} className="text-left hover:text-brand-blue">
                      {r.label}
                    </button>
                  ) : (
                    r.label
                  )}
                  {ri === firstMuted && <span className="block text-[9px] font-normal uppercase text-slate-400">Not in the payroll total</span>}
                </th>
                {idx.map((i) => {
                  const raw = r.values[i];
                  return (
                    <td
                      key={i}
                      style={cell(raw, shade === "row" ? rowMax : tableMax)}
                      className={`whitespace-nowrap border-t px-2 py-1.5 text-right tabular-nums ${
                        ri === firstMuted ? "border-slate-300" : "border-slate-100"
                      } ${focus === i ? "outline outline-1 -outline-offset-1 outline-brand-blue/60" : ""}`}
                    >
                      {raw === null ? <span className="text-slate-300">–</span> : fmt(raw)}
                    </td>
                  );
                })}
                {showTotal && (
                  <td
                    className={`whitespace-nowrap border-t px-3 py-1.5 text-right font-bold tabular-nums text-[#0e1b3d] ${
                      ri === firstMuted ? "border-slate-300" : "border-slate-100"
                    }`}
                  >
                    {fmt(v.reduce((a, b) => a + b, 0))}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollTable>
  );
}

// ------------------------------------------------------------- forecast

export interface ForecastRow {
  name: string;
  actual: number | null;
  forecast: number | null;
  /** Likely range, [low, high]. */
  band: [number, number] | null;
  /** The plain trend, drawn only when the forecast has been changed by hand. */
  trend: number | null;
  /** The forecast plus the planning projects switched on, drawn only when there are any. */
  plan?: number | null;
}

/** Actual months as a solid line, forecast months as a dashed line with a shaded likely range. */
export function ForecastChart({
  rows,
  nowName,
  fmt,
  axisFmt,
  height = 300,
}: {
  rows: ForecastRow[];
  nowName: string;
  fmt: (n: number) => string;
  axisFmt: (n: number) => string;
  height?: number;
}) {
  const scale = niceScale(Math.max(0, ...rows.flatMap((r) => [r.actual ?? 0, r.forecast ?? 0, r.band?.[1] ?? 0, r.trend ?? 0, r.plan ?? 0])));
  const hasTrend = rows.some((r) => r.trend !== null);
  const hasPlan = rows.some((r) => r.plan !== null && r.plan !== undefined);
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ backgroundColor: PAL.brand }} /> Actual
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: PAL.violet }} /> Forecast
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: PAL.violet, opacity: 0.2 }} /> Likely range
        </span>
        {hasTrend && (
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-4 border-t border-dashed" style={{ borderColor: PAL.grey }} /> Recent trend (before your changes)
          </span>
        )}
        {hasPlan && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ backgroundColor: PAL.orange }} /> With your projects
          </span>
        )}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={PAL.grid} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={{ stroke: PAL.axis }}
              tick={{ fill: PAL.muted, fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={6}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={52}
              domain={[0, scale.top]}
              ticks={scale.ticks}
              tick={{ fill: PAL.muted, fontSize: 11 }}
              tickFormatter={(v: number) => axisFmt(v)}
            />
            <Tooltip
              cursor={{ stroke: PAL.axis }}
              content={(p) => {
                const row = p.payload?.[0]?.payload as ForecastRow | undefined;
                if (!p.active || !row) return null;
                const value = row.actual ?? row.forecast;
                if (value === null) return null;
                return (
                  <div className="rounded-xl border border-blue-100 bg-white px-3 py-2 text-xs shadow-[0_10px_30px_rgba(30,80,204,0.18)]">
                    <p className="mb-1 font-bold text-[#0e1b3d]">
                      {row.name} <span className="font-normal text-slate-400">{row.actual !== null ? "actual" : "forecast"}</span>
                    </p>
                    <p className="font-extrabold text-[#0e1b3d]">{fmt(value)}</p>
                    {row.actual === null && row.band && (
                      <p className="text-slate-500">
                        Likely {fmt(row.band[0])} to {fmt(row.band[1])}
                      </p>
                    )}
                    {row.actual === null && row.trend !== null && (
                      <p className="text-slate-400">Recent trend {fmt(row.trend)}</p>
                    )}
                    {row.actual === null && row.plan !== null && row.plan !== undefined && (
                      <p className="font-semibold" style={{ color: PAL.orange }}>
                        With projects {fmt(row.plan)}
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <ReferenceLine x={nowName} stroke={PAL.brand} strokeDasharray="4 3" strokeOpacity={0.7} />
            <Area dataKey="band" stroke="none" fill={PAL.violet} fillOpacity={0.16} isAnimationActive={false} connectNulls />
            {hasTrend && (
              <Line dataKey="trend" stroke={PAL.grey} strokeWidth={1.5} strokeDasharray="3 4" dot={false} activeDot={false} isAnimationActive={false} connectNulls />
            )}
            <Line
              dataKey="actual"
              stroke={PAL.brand}
              strokeWidth={2}
              dot={{ r: 3, fill: PAL.brand, stroke: "#fff", strokeWidth: 1.5 }}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
              connectNulls
            />
            {hasPlan && (
              <Line
                dataKey="plan"
                stroke={PAL.orange}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: PAL.orange, stroke: "#fff", strokeWidth: 1.5 }}
                activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
                isAnimationActive={false}
                connectNulls
              />
            )}
            <Line
              dataKey="forecast"
              stroke={PAL.violet}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 3.5, fill: "#fff", stroke: PAL.violet, strokeWidth: 2, strokeDasharray: "0" }}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- waffle

/**
 * One hundred squares standing for every ₹100 spent. Each item gets as many
 * squares as it has whole rupees of the ₹100. Hover a square or a name to read it.
 */
export function Waffle({ slices, fmt }: { slices: Slice[]; fmt: (n: number) => string }) {
  const [hot, setHot] = useState<number | null>(null);
  const total = slices.reduce((a, s) => a + Math.max(0, s.value), 0);
  // Largest-remainder rounding, so the squares always add up to exactly 100.
  const raw = slices.map((s) => (total > 0 ? (Math.max(0, s.value) / total) * 100 : 0));
  const counts = raw.map(Math.floor);
  let left = 100 - counts.reduce((a, b) => a + b, 0);
  raw
    .map((r, i) => ({ i, rem: r - Math.floor(r) }))
    .sort((a, b) => b.rem - a.rem)
    .forEach(({ i }) => {
      if (left > 0) {
        counts[i] += 1;
        left -= 1;
      }
    });
  const cells = counts.flatMap((n, i) => Array.from({ length: n }, () => i));
  const active = hot !== null ? slices[hot] : null;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="grid w-full max-w-[240px] shrink-0 grid-cols-10 gap-[3px]" onMouseLeave={() => setHot(null)}>
        {cells.map((si, k) => (
          <button
            key={k}
            type="button"
            aria-label={`${slices[si].label}`}
            onMouseEnter={() => setHot(si)}
            onFocus={() => setHot(si)}
            onClick={() => setHot(hot === si ? null : si)}
            className="aspect-square rounded-[3px] transition"
            style={{ backgroundColor: slices[si].color, opacity: hot === null || hot === si ? 1 : 0.22 }}
          />
        ))}
      </div>
      <div className="w-full min-w-0 flex-1">
        <p className="min-h-[2.5rem] text-xs text-slate-500">
          {active ? (
            <>
              <b className="text-[#0e1b3d]">{active.label}</b>: {Math.round((active.value / Math.max(1, total)) * 100)} of every ₹100, which is {fmt(active.value)}.
            </>
          ) : (
            <>Each square is ₹1 of every ₹100 of non-payroll cost. Hover to see which item it is.</>
          )}
        </p>
        <ul className="mt-1 space-y-0.5">
          {slices.map((s, i) => (
            <li
              key={s.label}
              onMouseEnter={() => setHot(i)}
              onMouseLeave={() => setHot(null)}
              className={`flex items-center justify-between gap-3 rounded-lg px-2 py-0.5 text-xs transition ${hot === i ? "bg-white" : ""}`}
            >
              <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="truncate">{s.label}</span>
              </span>
              <span className="shrink-0 font-bold text-[#0e1b3d]">₹{counts[i]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** A row of little bars, one per month, with the focused month at full strength. */
export function MiniBars({ values, color, focusAt }: { values: (number | null)[]; color: string; focusAt: number }) {
  const max = Math.max(0, ...values.map((v) => v ?? 0));
  return (
    <div className="flex h-9 items-end gap-[2px]" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-[2px]"
          style={{
            height: `${max > 0 && v ? Math.max(6, (v / max) * 100) : 4}%`,
            backgroundColor: v ? color : "#e2e8f0",
            opacity: i === focusAt ? 1 : 0.55,
          }}
        />
      ))}
    </div>
  );
}

// -------------------------------------------------------------- sparkline

/** A tiny line of the months on screen, with a dot on the focused one. */
export function Spark({ values, focusAt }: { values: (number | null)[]; focusAt: number }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return <div className="mt-2 h-7" />;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const w = 100;
  const h = 28;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * w;
  const y = (v: number) => h - 4 - ((v - min) / span) * (h - 9);
  const line = pts.map((p) => `${x(p.i)},${y(p.v)}`).join(" ");
  const f = pts.find((p) => p.i === focusAt);
  return (
    <div className="relative mt-2 h-7 w-full">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden className="h-full w-full">
        <polygon points={`${x(pts[0].i)},${h} ${line} ${x(pts[pts.length - 1].i)},${h}`} fill="#dbe8fb" opacity={0.7} />
        <polyline points={line} fill="none" stroke={PAL.brand} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      </svg>
      {f && (
        <span
          aria-hidden
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-blue ring-2 ring-white"
          style={{ left: `${x(f.i)}%`, top: `${(y(f.v) / h) * 100}%` }}
        />
      )}
    </div>
  );
}
