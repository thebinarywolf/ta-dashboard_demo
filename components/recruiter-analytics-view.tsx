"use client";

import { useCallback, useMemo, useState } from "react";
import { GLASS_PANEL } from "@/components/glass-card";
import RecruiterDetailDialog from "@/components/recruiter-detail-dialog";
import ScrollTable from "@/components/scroll-table";
import {
  drillDown,
  type DrillMetric,
  type DrillQuery,
  type MetricKey,
  type RecruiterAnalytics,
  type RecruiterRow,
} from "@/lib/metrics/recruiter-analytics";

type SortKey = keyof Omit<RecruiterRow, "name" | "kind"> | "name";

const COLUMNS: { key: SortKey; label: string; hint?: string }[] = [
  { key: "name", label: "Recruiter" },
  { key: "openNow", label: "Open now", hint: "Positions still open, assigned to this recruiter (today)" },
  { key: "assigned", label: "Assigned", hint: "Positions assigned in the period" },
  { key: "closed", label: "Closed", hint: "Positions closed in the period" },
  { key: "avgDaysToClose", label: "Avg days to close" },
  { key: "interviews", label: "Interviews", hint: "Interviews in the period" },
  { key: "candidates", label: "Candidates", hint: "Different candidates interviewed" },
  { key: "selected", label: "Selected" },
  { key: "rejected", label: "Rejected" },
  { key: "selectionRate", label: "Selection rate", hint: "Selected ÷ (Selected + Rejected)" },
];

const METRICS: { key: MetricKey; label: string }[] = [
  { key: "closed", label: "Positions closed" },
  { key: "interviews", label: "Interviews" },
  { key: "selected", label: "Candidates selected" },
  { key: "assigned", label: "Positions assigned" },
];

type SeniorityMode = "open" | "closed" | "both";

function monthLabel(m: string): string {
  return new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

const heat = (value: number, max: number) =>
  value > 0 && max > 0 ? { backgroundColor: `rgba(30, 80, 204, ${0.08 + 0.4 * (value / max)})` } : undefined;

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full bg-white/60 p-1 text-xs font-bold">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={`rounded-full px-3 py-1.5 ${value === o.key ? "bg-brand-blue text-white" : "text-slate-500 hover:bg-white"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

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

/** A number that opens the list behind it when clicked (a plain number when 0). */
function Count({
  n,
  onClick,
  className = "",
}: {
  n: number;
  onClick: () => void;
  className?: string;
}) {
  if (n === 0) return <span className={className}>{n}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Click to see the list"
      className={`-mx-1.5 rounded-md px-1.5 py-0.5 font-[inherit] underline decoration-dotted decoration-brand-blue/40 underline-offset-4 hover:bg-white hover:text-brand-blue hover:decoration-brand-blue ${className}`}
    >
      {n}
    </button>
  );
}

function SummaryTile({
  label,
  value,
  sub,
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-[#0e1b3d]">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
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
      <p className="mt-1 text-[11px] font-bold text-brand-blue">See the list →</p>
    </button>
  );
}

const fmtDays = (d: number | null) => (d === null ? "–" : `${Math.round(d)}d`);
const fmtPct = (p: number | null) => (p === null ? "–" : `${Math.round(p)}%`);

export default function RecruiterAnalyticsView({
  analytics,
  periodText,
}: {
  analytics: RecruiterAnalytics;
  periodText: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const [seniorityMode, setSeniorityMode] = useState<SeniorityMode>("both");
  const [metric, setMetric] = useState<MetricKey>("closed");
  const [drill, setDrill] = useState<{ title: string; subtitle: string; query: DrillQuery } | null>(null);
  const drillResult = useMemo(
    () => (drill ? drillDown(analytics.details, drill.query) : null),
    [drill, analytics.details]
  );
  const closeDrill = useCallback(() => setDrill(null), []);

  /** Opens the list behind a clicked number. */
  const open = (query: DrillQuery, titleOverride?: string) => {
    const parts = [titleOverride ?? METRIC_TITLE[query.metric]];
    if (query.name) parts.push(query.name);
    if (query.level) parts.push(query.level);
    if (query.month) parts.push(monthLabel(query.month));
    setDrill({
      title: parts.join(" · "),
      subtitle: query.metric === "open" ? "open today" : periodText,
      query,
    });
  };

  const { recruiters, totals, seniorities, seniorityMatrix, months, monthly, seniorityTotals, monthlyTotals } = analytics;
  // The "Jointly closed" / "Closer not recorded" rows only have closed positions, so
  // they are shown where closed positions are shown.
  const seniorityMetric: DrillMetric =
    seniorityMode === "open" ? "open" : seniorityMode === "closed" ? "closed" : "openClosed";
  const seniorityRows = recruiters.filter((r) => r.kind === "recruiter" || seniorityMode !== "open");
  const monthRows = recruiters.filter((r) => r.kind === "recruiter" || metric === "closed");

  const rows = useMemo(() => {
    // The two summary rows (jointly closed / closer not recorded) always stay last.
    const people = recruiters.filter((r) => r.kind === "recruiter");
    const extra = recruiters.filter((r) => r.kind !== "recruiter");
    if (!sort) return [...people, ...extra];
    const sign = sort.dir === "asc" ? 1 : -1;
    const sorted = [...people].sort((a, b) => {
      if (sort.key === "name") return sign * a.name.localeCompare(b.name);
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sign * (av - bv);
    });
    return [...sorted, ...extra];
  }, [recruiters, sort]);

  function clickSort(key: SortKey) {
    const first = key === "name" ? "asc" : "desc";
    if (!sort || sort.key !== key) return setSort({ key, dir: first });
    if (sort.dir === first) return setSort({ key, dir: first === "asc" ? "desc" : "asc" });
    setSort(null);
  }

  // Seniority matrix values for the chosen mode.
  const seniorityCell = (name: string, level: string) => {
    const c = seniorityMatrix[name]?.[level] ?? { open: 0, closed: 0 };
    return { open: c.open, closed: c.closed, shown: seniorityMode === "open" ? c.open : seniorityMode === "closed" ? c.closed : c.open + c.closed };
  };
  const seniorityMax = Math.max(
    1,
    ...seniorityRows.flatMap((r) => seniorities.map((l) => seniorityCell(r.name, l).shown))
  );
  // Totals count each position once, even when a closed position is shared.
  const seniorityColTotal = (level: string) => {
    const t = seniorityTotals[level] ?? { open: 0, closed: 0 };
    return seniorityMode === "open" ? t.open : seniorityMode === "closed" ? t.closed : t.open + t.closed;
  };

  // Month matrix for the chosen metric.
  const monthData = monthly[metric];
  const monthMax = Math.max(1, ...monthRows.flatMap((r) => months.map((m) => monthData[r.name]?.[m] ?? 0)));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryTile
          label="Open positions"
          value={String(totals.openNow)}
          sub="Still open today, across all recruiters"
          onClick={totals.openNow > 0 ? () => open({ metric: "open" }) : undefined}
        />
        <SummaryTile
          label="Positions closed"
          value={String(totals.closed)}
          sub={`${periodText} · each position counted once`}
          onClick={totals.closed > 0 ? () => open({ metric: "closed" }) : undefined}
        />
        <SummaryTile
          label="Interviews"
          value={String(totals.interviews)}
          sub={`${totals.candidates} different candidates · ${periodText}`}
          onClick={totals.interviews > 0 ? () => open({ metric: "interviews" }) : undefined}
        />
        <SummaryTile
          label="Avg days to close"
          value={fmtDays(totals.avgDaysToClose)}
          sub={`From assigned to closed · ${periodText}`}
          onClick={totals.closed > 0 ? () => open({ metric: "closed" }, "Positions closed (days to close)") : undefined}
        />
      </div>

      <div>
        <h2 className="text-sm font-bold text-[#0e1b3d]">By recruiter</h2>
        <ScrollTable outerClassName="mt-3" className={`${GLASS_PANEL}`}>
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {COLUMNS.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th
                      key={c.key}
                      title={c.hint}
                      aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
                      className="px-4 py-3"
                    >
                      <button
                        type="button"
                        onClick={() => clickSort(c.key)}
                        className={`flex items-center gap-1 text-left uppercase tracking-wide hover:text-brand-blue ${active ? "text-brand-blue" : ""}`}
                      >
                        {c.label}
                        <span aria-hidden className="text-[10px]">
                          {active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const person = r.kind === "recruiter";
                const dash = <span className="text-slate-300">–</span>;
                return (
                  <tr
                    key={r.name}
                    className={`border-b border-slate-200/50 last:border-0 ${person ? "" : "bg-blue-50/30"}`}
                  >
                    <td className="px-4 py-3">
                      <span className={person ? "font-semibold text-[#0e1b3d]" : "font-semibold italic text-slate-600"}>
                        {r.name}
                      </span>
                      {r.kind === "joint" && (
                        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                          Closed by more than one recruiter
                          {analytics.jointCombos.length > 0 && (
                            <>
                              {": "}
                              {analytics.jointCombos.map((c) => `${c.label} (${c.count})`).join(", ")}
                            </>
                          )}
                        </span>
                      )}
                      {r.kind === "unrecorded" && (
                        <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
                          No &quot;closed by&quot; recruiter in the sheet
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-brand-blue">
                      {person ? <Count n={r.openNow} onClick={() => open({ metric: "open", name: r.name })} /> : dash}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {person ? <Count n={r.assigned} onClick={() => open({ metric: "assigned", name: r.name })} /> : dash}
                    </td>
                    <td className="px-4 py-3 font-bold text-[#0e1b3d]">
                      <Count n={r.closed} onClick={() => open({ metric: "closed", name: r.name })} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.avgDaysToClose === null ? (
                        fmtDays(r.avgDaysToClose)
                      ) : (
                        <button
                          type="button"
                          onClick={() => open({ metric: "closed", name: r.name }, "Positions closed (days to close)")}
                          title="Click to see the list"
                          className="-mx-1.5 rounded-md px-1.5 py-0.5 underline decoration-dotted decoration-brand-blue/40 underline-offset-4 hover:bg-white hover:text-brand-blue"
                        >
                          {fmtDays(r.avgDaysToClose)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-[#0e1b3d]">
                      {person ? <Count n={r.interviews} onClick={() => open({ metric: "interviews", name: r.name })} /> : dash}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {person ? (
                        <Count
                          n={r.candidates}
                          onClick={() => open({ metric: "interviews", name: r.name }, "Candidates interviewed")}
                        />
                      ) : (
                        dash
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {person ? <Count n={r.selected} onClick={() => open({ metric: "selected", name: r.name })} /> : dash}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {person ? <Count n={r.rejected} onClick={() => open({ metric: "rejected", name: r.name })} /> : dash}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{person ? fmtPct(r.selectionRate) : dash}</td>
                  </tr>
                );
              })}
              {recruiters.length > 0 && (
                <tr className="bg-blue-50/60 font-bold text-brand-blue-dark">
                  <td className="px-4 py-3">All recruiters</td>
                  <td className="px-4 py-3">
                    <Count n={totals.openNow} onClick={() => open({ metric: "open" })} />
                  </td>
                  <td className="px-4 py-3">
                    <Count n={totals.assigned} onClick={() => open({ metric: "assigned" })} />
                  </td>
                  <td className="px-4 py-3">
                    <Count n={totals.closed} onClick={() => open({ metric: "closed" })} />
                  </td>
                  <td className="px-4 py-3">{fmtDays(totals.avgDaysToClose)}</td>
                  <td className="px-4 py-3">
                    <Count n={totals.interviews} onClick={() => open({ metric: "interviews" })} />
                  </td>
                  <td className="px-4 py-3">
                    <Count n={totals.candidates} onClick={() => open({ metric: "interviews" }, "Candidates interviewed")} />
                  </td>
                  <td className="px-4 py-3">
                    <Count n={totals.selected} onClick={() => open({ metric: "selected" })} />
                  </td>
                  <td className="px-4 py-3">
                    <Count n={totals.rejected} onClick={() => open({ metric: "rejected" })} />
                  </td>
                  <td className="px-4 py-3">{fmtPct(totals.selectionRate)}</td>
                </tr>
              )}
              {recruiters.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-slate-400">
                    No data for this period — try a wider date range, or run a sync from the Admin panel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollTable>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#0e1b3d]">Positions by seniority</h2>
            <p className="text-xs text-slate-500">
              Open is today&apos;s snapshot; closed is for the period. Darker means more.
            </p>
          </div>
          <Segmented
            value={seniorityMode}
            onChange={setSeniorityMode}
            options={[
              { key: "both", label: "Open + closed" },
              { key: "open", label: "Open now" },
              { key: "closed", label: "Closed" },
            ]}
          />
        </div>
        <ScrollTable outerClassName="mt-3" className={`${GLASS_PANEL}`}>
          <table className="w-full min-w-[560px] text-center text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Recruiter</th>
                {seniorities.map((l) => (
                  <th key={l} className="px-3 py-3">
                    {l}
                  </th>
                ))}
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {seniorityRows.map((r) => {
                const total = seniorities.reduce((n, l) => n + seniorityCell(r.name, l).shown, 0);
                return (
                  <tr key={r.name} className="border-b border-slate-200/50 last:border-0">
                    <td className="px-4 py-2.5 text-left font-semibold text-[#0e1b3d]">{r.name}</td>
                    {seniorities.map((l) => {
                      const c = seniorityCell(r.name, l);
                      return (
                        <td key={l} className="px-3 py-2.5 font-semibold text-[#0e1b3d]" style={heat(c.shown, seniorityMax)}>
                          {c.shown === 0 ? (
                            <span className="font-normal text-slate-300">–</span>
                          ) : (
                            <Count n={c.shown} onClick={() => open({ metric: seniorityMetric, name: r.name, level: l })} />
                          )}
                          {seniorityMode === "both" && c.shown > 0 && (
                            <span className="ml-1 text-[10px] font-normal text-slate-500">
                              ({c.open} open)
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 font-bold text-brand-blue">
                      <Count n={total} onClick={() => open({ metric: seniorityMetric, name: r.name })} />
                    </td>
                  </tr>
                );
              })}
              {recruiters.length > 0 && (
                <tr className="bg-blue-50/60 font-bold text-brand-blue-dark">
                  <td className="px-4 py-2.5 text-left">All recruiters</td>
                  {seniorities.map((l) => (
                    <td key={l} className="px-3 py-2.5">
                      <Count n={seniorityColTotal(l)} onClick={() => open({ metric: seniorityMetric, level: l })} />
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    <Count
                      n={seniorities.reduce((n, l) => n + seniorityColTotal(l), 0)}
                      onClick={() => open({ metric: seniorityMetric })}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollTable>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#0e1b3d]">Month by month</h2>
            <p className="text-xs text-slate-500">How each recruiter did in every month of the period. Darker means more.</p>
          </div>
          <Segmented value={metric} onChange={setMetric} options={METRICS} />
        </div>
        <ScrollTable outerClassName="mt-3" className={`${GLASS_PANEL}`}>
          <table className="w-full min-w-[560px] text-center text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Recruiter</th>
                {months.map((m) => (
                  <th key={m} className="whitespace-nowrap px-3 py-3">
                    {monthLabel(m)}
                  </th>
                ))}
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((r) => {
                const total = months.reduce((n, m) => n + (monthData[r.name]?.[m] ?? 0), 0);
                return (
                  <tr key={r.name} className="border-b border-slate-200/50 last:border-0">
                    <td className="px-4 py-2.5 text-left font-semibold text-[#0e1b3d]">{r.name}</td>
                    {months.map((m) => {
                      const v = monthData[r.name]?.[m] ?? 0;
                      return (
                        <td key={m} className="px-3 py-2.5 font-semibold text-[#0e1b3d]" style={heat(v, monthMax)}>
                          {v === 0 ? (
                            <span className="font-normal text-slate-300">–</span>
                          ) : (
                            <Count n={v} onClick={() => open({ metric, name: r.name, month: m })} />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5 font-bold text-brand-blue">
                      <Count n={total} onClick={() => open({ metric, name: r.name })} />
                    </td>
                  </tr>
                );
              })}
              {recruiters.length > 0 && (
                <tr className="bg-blue-50/60 font-bold text-brand-blue-dark">
                  <td className="px-4 py-2.5 text-left">All recruiters</td>
                  {months.map((m) => (
                    <td key={m} className="px-3 py-2.5">
                      <Count n={monthlyTotals[metric][m] ?? 0} onClick={() => open({ metric, month: m })} />
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    <Count
                      n={months.reduce((n, m) => n + (monthlyTotals[metric][m] ?? 0), 0)}
                      onClick={() => open({ metric })}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollTable>
      </div>

      {drill && drillResult && (
        <RecruiterDetailDialog
          title={drill.title}
          subtitle={drill.subtitle}
          result={drillResult}
          onClose={closeDrill}
        />
      )}
    </div>
  );
}
