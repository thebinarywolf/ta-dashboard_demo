"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GLASS_PANEL } from "@/components/glass-card";
import ScrollTable from "@/components/scroll-table";
import { Chip, ForecastChart, MonthChart, PAL, Panel, axisMoney, type ForecastRow } from "@/components/financials-charts";
import { changePct, count, money, moneyFull } from "@/lib/metrics/financials-format";
import type { ForecastResult } from "@/lib/metrics/financials-forecast";
import type { FinMonth, FinancialsData } from "@/lib/metrics/financials-parse";
import {
  PROJECT_KINDS,
  addToKey,
  duplicateProject,
  newId,
  newLine,
  newOneOff,
  newProject,
  projectImpact,
  sanitizeProjects,
  steadyState,
  sumImpacts,
  type ImpactMonth,
  type PlanProject,
  type ProjectKind,
  type TemplateContext,
} from "@/lib/metrics/financials-projects";

// ---------------------------------------------------------------- saving

const STORAGE_KEY = "ta-finance-projects:v1";

type Projects = PlanProject[];
type SetProjects = (update: (current: Projects) => Projects) => void;

/**
 * Planning projects, kept in this browser. They are read after the page loads
 * (so the server and browser agree on first paint) and saved on every change.
 * If the browser blocks storage the planner still works, it just forgets them.
 */
export function useFinanceProjects(fallbackKey: string): { projects: Projects; setProjects: SetProjects; loaded: boolean; saveFailed: boolean } {
  const [projects, setState] = useState<Projects>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState(sanitizeProjects(JSON.parse(raw), fallbackKey));
    } catch {
      /* storage blocked or unreadable: start empty */
    }
    setLoaded(true);
    // Read once, on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [projects, loaded]);

  return { projects, setProjects: setState, loaded, saveFailed };
}

export interface PlanImpacts {
  keys: string[];
  byId: Map<string, ImpactMonth[]>;
  /** The projects that are switched on, added together. */
  total: ImpactMonth[];
  factorOf: (key: string) => number;
}

/** Every project's month-by-month cost over the forecast months. */
export function usePlanImpacts(projects: Projects, fc: ForecastResult | null): PlanImpacts {
  return useMemo(() => {
    if (!fc) return { keys: [], byId: new Map(), total: [], factorOf: () => 1 };
    const keys = fc.months.map((m) => m.key);
    const factors = new Map(fc.months.map((m) => [m.key, m.payFactor]));
    const lastFactor = fc.months[fc.months.length - 1]?.payFactor ?? 1;
    const factorOf = (key: string) => factors.get(key) ?? lastFactor;
    const byId = new Map(projects.map((p) => [p.id, projectImpact(p, keys, factorOf)]));
    const total = sumImpacts(
      projects.filter((p) => p.enabled).map((p) => byId.get(p.id) ?? []),
      keys
    );
    return { keys, byId, total, factorOf };
  }, [projects, fc]);
}

// ----------------------------------------------------------------- inputs

export const input =
  "rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 text-xs font-semibold text-[#0e1b3d] outline-none focus:border-brand-blue";

/**
 * A number box. It is left to manage its own text so half-typed numbers (an empty
 * box, a trailing dot) do not fight the page; the panel it sits in is keyed by project.
 */
export function Num({ value, onChange, label, step = 1, className = "w-24" }: { value: number; onChange: (n: number) => void; label: string; step?: number; className?: string }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step={step}
      defaultValue={value}
      aria-label={label}
      onChange={(e) => {
        const n = e.target.valueAsNumber;
        if (Number.isFinite(n)) onChange(Math.max(0, n));
      }}
      className={`${input} ${className}`}
    />
  );
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const labelOfKey = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_NAMES[m - 1] ?? "?"} ${y}`;
};

export function MonthSelect({ value, months, onChange, label }: { value: string; months: { key: string; label: string }[]; onChange: (key: string) => void; label: string }) {
  const known = months.some((m) => m.key === value);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={`${input} w-28`}>
      {!known && <option value={value}>{labelOfKey(value)}</option>}
      {months.map((m) => (
        <option key={m.key} value={m.key}>
          {m.label}
        </option>
      ))}
    </select>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-[#0e1b3d]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

// ----------------------------------------------------------------- planner

export default function FinancialsPlanner({
  d,
  fc,
  horizon,
  setHorizon,
  projects,
  setProjects,
  loaded,
  saveFailed,
  impacts,
  chartRows,
  editingId,
  onEdit,
  onCreate,
}: {
  d: FinancialsData;
  fc: ForecastResult;
  horizon: 3 | 6 | 12 | 24;
  setHorizon: (h: 3 | 6 | 12 | 24) => void;
  projects: Projects;
  setProjects: SetProjects;
  loaded: boolean;
  saveFailed: boolean;
  impacts: PlanImpacts;
  chartRows: ForecastRow[];
  /** The project open in the builder, if any. */
  editingId: string | null;
  onEdit: (id: string | null) => void;
  onCreate: (kind: ProjectKind) => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const months = fc.months;
  const enabled = projects.filter((p) => p.enabled);
  const h = Math.min(horizon, months.length);
  const upTo = <T,>(xs: T[]) => xs.slice(0, h);

  const patch = (id: string, change: (p: PlanProject) => PlanProject) => setProjects((all) => all.map((p) => (p.id === id ? change(p) : p)));

  // ---- headline numbers across the projects that are on
  const baseHorizon = upTo(months).reduce((a, m) => a + m.peopleCost, 0);
  const addHorizon = upTo(impacts.total).reduce((a, m) => a + m.total, 0);
  const endMonth = months[h - 1];
  const endImpact = impacts.total[h - 1];
  const fy = fc.fiscalYear;
  const fyExtra = fy ? impacts.total.slice(0, fy.forecastMonths).reduce((a, m) => a + m.total, 0) : 0;

  // ---- export / import
  const exportPlans = () => {
    const blob = new Blob([JSON.stringify(projects, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "finance-planning-projects.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const importPlans = async (file: File) => {
    try {
      // Fresh ids, so importing the same file twice does not make two projects share one.
      const named = sanitizeProjects(JSON.parse(await file.text()), months[0].key).map((p) => ({
        ...p,
        id: newId(),
        lines: p.lines.map((l) => ({ ...l, id: newId() })),
        oneOffs: p.oneOffs.map((o) => ({ ...o, id: newId() })),
      }));
      if (named.length === 0) {
        setImportNote("That file has no projects in it.");
        return;
      }
      setProjects((all) => [...all, ...named]);
      setImportNote(`Added ${named.length} ${named.length === 1 ? "project" : "projects"}.`);
    } catch {
      setImportNote("That file could not be read. Use a file saved with Export.");
    }
  };

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------ headline */}
      {enabled.length === 0 ? (
        <div className={`${GLASS_PANEL} space-y-1 p-5`}>
          <p className="text-sm font-bold text-[#0e1b3d]">Plan something and see what it does to people cost</p>
          <p className="text-sm text-slate-500">
            Opening a new state, adding branches or building a team? Create a project below, fill in who joins and what they cost, and it
            is added on top of the forecast. Change any number and the effect updates straight away.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className={`${GLASS_PANEL} min-w-0 p-4`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Projects add, next {h} months</p>
            <p className="mt-1 truncate text-xl font-extrabold text-[#0e1b3d] sm:text-2xl">{money(addHorizon)}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#0e1b3d]">
              {baseHorizon > 0 ? `${((addHorizon / baseHorizon) * 100).toFixed(1)}% on top of ${money(baseHorizon)}` : ""}
            </p>
            <p className="text-[11px] text-slate-500">
              {enabled.length} {enabled.length === 1 ? "project" : "projects"} switched on
            </p>
          </div>
          <div className={`${GLASS_PANEL} min-w-0 p-4`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">People added by {endMonth.short}</p>
            <p className="mt-1 text-xl font-extrabold text-[#0e1b3d] sm:text-2xl">+{count(endImpact?.headcount ?? 0)}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#0e1b3d]">
              {count(Math.round(endMonth.headcount + (endImpact?.headcount ?? 0)))} in total
            </p>
            <p className="text-[11px] text-slate-500">{count(Math.round(endMonth.headcount))} without projects</p>
          </div>
          <div className={`${GLASS_PANEL} min-w-0 p-4`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">People cost in {endMonth.short}</p>
            <p className="mt-1 truncate text-xl font-extrabold text-[#0e1b3d] sm:text-2xl">{money(endMonth.peopleCost + (endImpact?.total ?? 0))}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#0e1b3d]">
              {(() => {
                const c = changePct(endMonth.peopleCost + (endImpact?.total ?? 0), endMonth.peopleCost);
                return c === null ? "" : `▲ ${c.toFixed(1)}% on the forecast`;
              })()}
            </p>
            <p className="text-[11px] text-slate-500">{money(endMonth.peopleCost)} without projects</p>
          </div>
          <div className={`${GLASS_PANEL} min-w-0 p-4`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{fy ? `${fy.label} in total` : "Financial year"}</p>
            <p className="mt-1 truncate text-xl font-extrabold text-[#0e1b3d] sm:text-2xl">{fy ? money(fy.total + fyExtra) : "–"}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-[#0e1b3d]">{fy ? `+${money(fyExtra)} from projects` : ""}</p>
            <p className="text-[11px] text-slate-500">{fy ? `${money(fy.total)} without projects` : ""}</p>
          </div>
        </div>
      )}

      <Panel
        title="The forecast with your projects"
        hint="Orange is the forecast plus every project that is switched on. The purple line is the forecast without them."
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Look ahead</span>
            {([6, 12, 24] as const).map((x) => (
              <Chip key={x} active={horizon === x} onClick={() => setHorizon(x)}>
                {x} months
              </Chip>
            ))}
          </div>
        }
      >
        <ForecastChart rows={chartRows} nowName={d.months[d.latest].short} fmt={money} axisFmt={axisMoney} height={320} />
      </Panel>

      {/* ------------------------------------------------ project list */}
      <Panel
        title="Your projects"
        hint="Saved in this browser. Use Export to keep a copy or send it to someone."
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={projects.length === 0}
              onClick={exportPlans}
              className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-brand-blue hover:bg-white disabled:opacity-40"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-brand-blue hover:bg-white"
            >
              Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importPlans(f);
                e.target.value = "";
              }}
            />
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Start a new one</span>
          {PROJECT_KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => onCreate(k.key)}
              className="rounded-full bg-brand-blue px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-brand-blue-dark"
            >
              + {k.label}
            </button>
          ))}
        </div>
        {importNote && <p className="mt-2 text-xs font-semibold text-brand-blue-dark">{importNote}</p>}
        {saveFailed && (
          <p className="mt-2 text-xs font-semibold text-amber-700">
            This browser is not letting the page save. Your projects will be lost when you leave, so use Export to keep a copy.
          </p>
        )}

        {!loaded ? (
          <p className="mt-4 text-xs text-slate-400">Loading your projects…</p>
        ) : projects.length === 0 ? (
          <p className="mt-4 text-xs text-slate-400">
            No projects yet. Start one with the buttons above. A new state or new branches starts with 3 people per branch (BM, ABM and BDE) and
            typical pay from your sheet. Change any of it.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 lg:grid-cols-2">
            {projects.map((p) => {
              const s = steadyState(p);
              const keys12 = Array.from({ length: 12 }, (_, k) => addToKey(p.startKey, k));
              const firstYear = projectImpact(p, keys12, impacts.factorOf).reduce((a, m) => a + m.total, 0);
              const on = editingId === p.id;
              return (
                <li key={p.id} className={`${GLASS_PANEL} min-w-0 p-4 ${on ? "ring-2 ring-brand-blue" : ""} ${p.enabled ? "" : "opacity-70"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-[#0e1b3d]">{p.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {PROJECT_KINDS.find((k) => k.key === p.kind)?.label} · starts {labelOfKey(p.startKey)}
                      </p>
                    </div>
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-bold text-slate-600">
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={(e) => patch(p.id, (x) => ({ ...x, enabled: e.target.checked }))}
                        className="h-4 w-4 accent-[#1e50cc]"
                      />
                      In forecast
                    </label>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">People</p>
                      <p className="text-sm font-extrabold text-[#0e1b3d]">{count(s.people)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Full strength</p>
                      <p className="text-sm font-extrabold text-[#0e1b3d]">{money(s.monthly)}<span className="text-[10px] font-normal text-slate-400"> /mo</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">First year</p>
                      <p className="text-sm font-extrabold text-[#0e1b3d]">{money(firstYear)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(p.id)}
                      className="rounded-full bg-brand-blue px-3 py-1 text-[11px] font-bold text-white hover:bg-brand-blue-dark"
                    >
                      {on ? "Editing…" : "Open"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const copy = duplicateProject(p);
                        setProjects((all) => [...all, copy]);
                        onEdit(copy.id);
                      }}
                      className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold text-brand-blue hover:bg-white"
                    >
                      Copy
                    </button>
                    {confirmId === p.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setProjects((all) => all.filter((x) => x.id !== p.id));
                          if (editingId === p.id) onEdit(null);
                          setConfirmId(null);
                        }}
                        onBlur={() => setConfirmId(null)}
                        autoFocus
                        className="rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold text-white"
                      >
                        Delete it for good?
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(p.id)}
                        className="rounded-full bg-white/70 px-3 py-1 text-[11px] font-bold text-slate-500 hover:bg-white hover:text-red-600"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* ------------------------------------------------ comparison table */}
      {enabled.length > 0 && (
        <Panel title="Month by month" hint={`The next ${h} months, forecast against forecast plus projects`}>
          <ScrollTable>
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/70 text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2 text-right">Forecast</th>
                  <th className="px-3 py-2 text-right">Projects add</th>
                  <th className="px-3 py-2 text-right">With projects</th>
                  <th className="px-3 py-2 text-right">People</th>
                </tr>
              </thead>
              <tbody>
                {upTo(months).map((m, i) => {
                  const add = impacts.total[i];
                  return (
                    <tr key={m.key} className="border-b border-slate-100 last:border-0">
                      <th className="px-3 py-2 font-semibold text-[#0e1b3d]">{m.label}</th>
                      <td className="px-3 py-2 text-right tabular-nums">{money(m.peopleCost)}</td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: add.total > 0 ? PAL.orange : undefined }}>
                        {add.total > 0 ? `+${money(add.total)}` : "–"}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums text-[#0e1b3d]">{money(m.peopleCost + add.total)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                        {count(Math.round(m.headcount + add.headcount))}
                        {add.headcount > 0 && <span className="text-slate-400"> (+{count(add.headcount)})</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTable>
        </Panel>
      )}
    </div>
  );
}
