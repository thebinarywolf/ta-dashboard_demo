"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GLASS_PANEL } from "@/components/glass-card";
import { countText, isSmallGroup, pctText } from "@/lib/metrics/attrition-format";
import type { AttritionRow } from "@/lib/metrics/attrition-calc";

export type InfographicFilter = { kind: "all" } | { kind: "dept"; name: string } | { kind: "state"; name: string };

type DeptMetric = "pct" | "left" | "infant";

const DEPT_METRICS: { key: DeptMetric; label: string }[] = [
  { key: "pct", label: "Attrition %" },
  { key: "left", label: "People left" },
  { key: "infant", label: "Left early" },
];

function Chip({
  active,
  onClick,
  children,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  hint?: string;
}) {
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
      {hint !== undefined && (
        <span className={`ml-1.5 font-normal ${active ? "text-white/80" : "text-slate-400"}`}>{hint}</span>
      )}
    </button>
  );
}

/** A ring that fills to the attrition %, capped at a full circle. */
function Ring({ pct, size = 72, muted = false }: { pct: number | null; size?: number; muted?: boolean }) {
  const r = 15.9155; // circumference = 100
  const fill = Math.max(0, Math.min(100, pct ?? 0));
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden className="-rotate-90 shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#e6eefb" strokeWidth="4.5" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke={muted ? "#a9c1f0" : "#1e50cc"}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeDasharray={`${fill} ${100 - fill}`}
        style={{ transition: "stroke-dasharray .5s ease" }}
      />
    </svg>
  );
}

function Tile({ label, value, sub, ring }: { label: string; value: string; sub: string; ring?: { pct: number | null; muted: boolean } }) {
  return (
    <div className={`${GLASS_PANEL} flex items-center justify-between gap-3 p-4`}>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-1 text-3xl font-extrabold text-[#0e1b3d]">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{sub}</p>
      </div>
      {ring && <Ring pct={ring.pct} muted={ring.muted} />}
    </div>
  );
}

/** From before + Joined − Left = People now, drawn as a waterfall. */
function Waterfall({ row }: { row: AttritionRow }) {
  // 20% headroom so the number above the tallest bar stays inside the chart.
  const top = Math.max(1, row.headcountStart + row.joiners, row.headcountEnd) * 1.2;
  const h = (n: number) => `${(n / top) * 100}%`;
  const cols: { label: string; value: number; bottom: number; kind: "total" | "up" | "down" }[] = [
    { label: "People from before", value: row.headcountStart, bottom: 0, kind: "total" },
    { label: "Joined", value: row.joiners, bottom: row.headcountStart, kind: "up" },
    { label: "Left", value: row.leavers, bottom: row.headcountStart + row.joiners - row.leavers, kind: "down" },
    { label: "People now", value: row.headcountEnd, bottom: 0, kind: "total" },
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="relative grid min-h-[150px] flex-1 grid-cols-4 gap-3 border-b border-slate-200/70">
        {cols.map((c) => (
          <div key={c.label} className="relative">
            <div
              className={`absolute inset-x-0 rounded-t-lg ${
                c.kind === "total"
                  ? "bg-brand-blue"
                  : c.kind === "up"
                    ? "bg-blue-300"
                    : "border-2 border-dashed border-brand-blue bg-white"
              }`}
              style={{ bottom: h(c.bottom), height: h(c.value), minHeight: c.value > 0 ? 3 : 0, transition: "all .5s ease" }}
            />
            <span
              className="absolute inset-x-0 text-center text-sm font-extrabold text-[#0e1b3d]"
              style={{ bottom: `calc(${h(c.bottom + c.value)} + 4px)` }}
            >
              {c.kind === "up" ? "+" : c.kind === "down" ? "−" : ""}
              {c.value}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-3 text-center text-[11px] font-semibold uppercase leading-tight tracking-wide text-slate-500">
        {cols.map((c) => (
          <span key={c.label}>{c.label}</span>
        ))}
      </div>
    </div>
  );
}

export default function AttritionInfographics({
  infantDays,
  baseHref,
  overall,
  departments,
  states,
  ages,
  ageByDept,
  ageByState,
  initial,
}: {
  infantDays: number;
  /** Current page URL with the dates, group and infant window (no scope). */
  baseHref: string;
  overall: AttritionRow;
  departments: AttritionRow[];
  /** Branch Sales, split by state. */
  states: AttritionRow[];
  ages: AttritionRow[];
  ageByDept: Record<string, AttritionRow[]>;
  ageByState: Record<string, AttritionRow[]>;
  initial: InfographicFilter;
}) {
  const [filter, setFilter] = useState<InfographicFilter>(initial);
  const [deptMetric, setDeptMetric] = useState<DeptMetric>("pct");

  const toggle = (next: InfographicFilter) =>
    setFilter((cur) => (cur.kind === next.kind && cur.kind !== "all" && next.kind !== "all" && cur.name === next.name ? { kind: "all" } : next));

  const row =
    filter.kind === "dept"
      ? (departments.find((d) => d.label === filter.name) ?? overall)
      : filter.kind === "state"
        ? (states.find((s) => s.label === filter.name) ?? overall)
        : overall;
  const ageRows =
    filter.kind === "dept"
      ? (ageByDept[filter.name] ?? [])
      : filter.kind === "state"
        ? (ageByState[filter.name] ?? [])
        : ages;
  const title = filter.kind === "all" ? "Everyone" : filter.kind === "dept" ? filter.name : `Branch Sales · ${filter.name}`;
  const small = filter.kind !== "all" && isSmallGroup(row.averageHeadcount);

  const scopeKey = filter.kind === "all" ? "all" : `${filter.kind === "dept" ? "dept" : "state"}:${filter.name}`;
  const scopeUrl = `${baseHref}&scope=${encodeURIComponent(scopeKey)}`;
  const peopleHref = (reason?: string) => `${scopeUrl}&view=people${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`;

  // Department bars: sorted by the chosen measure.
  const deptValue = (r: AttritionRow) =>
    deptMetric === "pct" ? (r.attritionPct ?? 0) : deptMetric === "left" ? r.leavers : r.infantLeavers;
  const sortedDepts = useMemo(
    () => [...departments].sort((a, b) => deptValue(b) - deptValue(a) || a.label.localeCompare(b.label)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [departments, deptMetric]
  );
  // The scale ignores tiny groups so one extreme % doesn't flatten every other bar.
  const deptMax = Math.max(
    1,
    ...departments.filter((d) => deptMetric !== "pct" || !isSmallGroup(d.averageHeadcount)).map(deptValue)
  );
  const deptText = (r: AttritionRow) => (deptMetric === "pct" ? pctText(r.attritionPct) : String(deptValue(r)));
  const deptSelected = (r: AttritionRow) =>
    (filter.kind === "dept" && filter.name === r.label) || (filter.kind === "state" && r.label === "Branch Sales");

  const ageMax = Math.max(1, ...ageRows.filter((r) => !isSmallGroup(r.averageHeadcount)).map((r) => r.attritionPct ?? 0));
  const stateMax = Math.max(1, ...states.filter((r) => !isSmallGroup(r.averageHeadcount)).map((r) => r.attritionPct ?? 0));

  return (
    <div className="space-y-6">
      {/* Quick filters */}
      <div className={`${GLASS_PANEL} space-y-3 p-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 shrink-0 text-[10px] font-bold uppercase tracking-wide text-slate-500">Quick filter</span>
          <Chip active={filter.kind === "all"} onClick={() => setFilter({ kind: "all" })} hint={String(overall.leavers)}>
            Everyone
          </Chip>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-24 shrink-0 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Department</span>
          <div className="flex flex-wrap gap-1.5">
            {departments.map((d) => (
              <Chip
                key={d.label}
                active={filter.kind === "dept" && filter.name === d.label}
                onClick={() => toggle({ kind: "dept", name: d.label })}
                hint={String(d.leavers)}
              >
                {d.label}
              </Chip>
            ))}
          </div>
        </div>
        {states.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="w-24 shrink-0 pt-2 text-[10px] font-bold uppercase leading-tight tracking-wide text-slate-500">
              Branch Sales state
            </span>
            <div className="flex flex-wrap gap-1.5">
              {states.map((s) => (
                <Chip
                  key={s.label}
                  active={filter.kind === "state" && filter.name === s.label}
                  onClick={() => toggle({ kind: "state", name: s.label })}
                  hint={String(s.leavers)}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <p className="text-[11px] text-slate-400">The number beside each name is how many people left in this period.</p>
      </div>

      {/* Headline for the current filter */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-[#0e1b3d]">{title}</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href={peopleHref()}
            className="rounded-full bg-white/70 px-3.5 py-1.5 text-xs font-bold text-brand-blue hover:bg-white"
          >
            See who left ({row.leavers}) →
          </Link>
          <Link
            href={`${scopeUrl}#more-analysis`}
            className="rounded-full bg-white/70 px-3.5 py-1.5 text-xs font-bold text-brand-blue hover:bg-white"
          >
            Why they left →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Attrition"
          value={pctText(row.attritionPct)}
          sub={`${row.leavers} ${row.leavers === 1 ? "person" : "people"} left · avg ${countText(row.averageHeadcount)} people${small ? " (few people)" : ""}`}
          ring={{ pct: row.attritionPct, muted: small }}
        />
        <Tile
          label="Infant attrition"
          value={pctText(row.infantPctOfJoiners)}
          sub={`${row.infantLeavers} left within ${infantDays} days · of ${row.joiners} new joiners`}
          ring={{ pct: row.infantPctOfJoiners, muted: false }}
        />
        <Tile label="New joiners" value={String(row.joiners)} sub="People who joined in this period" />
        <Tile label="People now" value={String(row.headcountEnd)} sub={`${row.headcountStart} at the start of the period`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Waterfall */}
        <div className={`${GLASS_PANEL} p-5 lg:col-span-2`}>
          <h3 className="text-sm font-bold text-[#0e1b3d]">How the team changed</h3>
          <p className="mb-3 text-xs text-slate-500">People from before + Joined − Left = People now</p>
          <div className="h-[210px]">
            <Waterfall row={row} />
          </div>
        </div>

        {/* Departments */}
        <div className={`${GLASS_PANEL} p-5 lg:col-span-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#0e1b3d]">By department</h3>
              <p className="text-xs text-slate-500">Click a bar to filter everything on this page.</p>
            </div>
            <div className="flex gap-1 rounded-full bg-white/60 p-1 text-[11px] font-bold">
              {DEPT_METRICS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setDeptMetric(m.key)}
                  aria-pressed={deptMetric === m.key}
                  className={`rounded-full px-3 py-1 ${deptMetric === m.key ? "bg-brand-blue text-white" : "text-slate-500 hover:bg-white"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
            {sortedDepts.map((d) => {
              const few = deptMetric === "pct" && isSmallGroup(d.averageHeadcount);
              const selected = deptSelected(d);
              return (
                <button
                  key={d.label}
                  type="button"
                  onClick={() => toggle({ kind: "dept", name: d.label })}
                  title={`${d.label}: ${d.leavers} left of ${countText(d.averageHeadcount)} on average`}
                  className={`grid w-full grid-cols-[7.5rem_1fr_3.5rem] items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-white/80 ${
                    selected ? "bg-blue-50 ring-1 ring-brand-blue/40" : ""
                  }`}
                >
                  <span className={`truncate font-semibold ${selected ? "text-brand-blue" : "text-[#0e1b3d]"}`}>{d.label}</span>
                  <span className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={`block h-full rounded-full ${few ? "bg-blue-200" : "bg-brand-blue"}`}
                      style={{ width: `${Math.min(100, (deptValue(d) / deptMax) * 100)}%`, transition: "width .5s ease" }}
                    />
                  </span>
                  <span className={`text-right font-bold ${few ? "text-slate-400" : "text-[#0e1b3d]"}`}>{deptText(d)}</span>
                </button>
              );
            })}
          </div>
          {deptMetric === "pct" && (
            <p className="mt-2 text-[11px] text-slate-400">Pale bars = few people (under 3 on average), so the % swings a lot.</p>
          )}
        </div>
      </div>

      {/* Branch Sales by state */}
      {states.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-[#0e1b3d]">Branch Sales by state</h3>
          <p className="text-xs text-slate-500">Ring = attrition %. Click a state to filter everything on this page.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {states.map((s) => {
              const selected = filter.kind === "state" && filter.name === s.label;
              const few = isSmallGroup(s.averageHeadcount);
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => toggle({ kind: "state", name: s.label })}
                  aria-pressed={selected}
                  className={`${GLASS_PANEL} flex items-center gap-3 p-4 text-left transition hover:ring-2 hover:ring-brand-blue/40 ${
                    selected ? "ring-2 ring-brand-blue" : ""
                  }`}
                >
                  <div className="relative">
                    <Ring pct={((s.attritionPct ?? 0) / stateMax) * 100} size={64} muted={few} />
                    <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-[#0e1b3d]">
                      {s.attritionPct === null ? "–" : `${Math.round(s.attritionPct)}%`}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#0e1b3d]">{s.label}</p>
                    <p className="text-xs text-slate-500">
                      <b className="text-brand-blue">{s.leavers}</b> left · {s.headcountEnd} now
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {s.joiners} joined · {s.infantLeavers} left early
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Age groups */}
      <div className={`${GLASS_PANEL} p-5`}>
        <h3 className="text-sm font-bold text-[#0e1b3d]">By age group · {title}</h3>
        <p className="mb-3 text-xs text-slate-500">Column height = attrition %. The number on top is how many left.</p>
        {ageRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No people in this group for the period.</p>
        ) : (
          <div className="flex h-[200px] items-end gap-3 border-b border-slate-200/70 sm:gap-5">
            {ageRows.map((r) => {
              const few = isSmallGroup(r.averageHeadcount);
              const height = Math.max(r.leavers > 0 ? 4 : 0, Math.min(100, ((r.attritionPct ?? 0) / ageMax) * 100));
              return (
                <div key={r.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                  <span className="text-xs font-bold text-[#0e1b3d]">{r.leavers}</span>
                  <span className={`text-[10px] font-semibold ${few ? "text-slate-300" : "text-slate-500"}`}>{pctText(r.attritionPct)}</span>
                  <div
                    className={`mt-1 w-full max-w-[64px] rounded-t-lg ${few ? "bg-blue-200" : "bg-brand-blue"}`}
                    style={{ height: `${height * 0.62}%`, transition: "height .5s ease" }}
                    title={`${r.label}: ${r.leavers} left, ${pctText(r.attritionPct)}${few ? " (few people)" : ""}`}
                  />
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-2 flex gap-3 sm:gap-5">
          {ageRows.map((r) => (
            <span key={r.label} className="min-w-0 flex-1 text-center text-[11px] font-semibold text-slate-500">
              {r.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
