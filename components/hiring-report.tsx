"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GLASS_PANEL } from "@/components/glass-card";
import DataNotesFlag from "@/components/data-notes-flag";
import type { ReportGroup, ReportRow } from "@/lib/metrics/report-calc";
import ScrollTable from "@/components/scroll-table";

export interface ClosedWindowOption {
  label: string;
  href: string;
  active: boolean;
}

type Mode = "ho" | "branch";

function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor" aria-hidden="true">
      <circle cx="10" cy="6.5" r="3.2" />
      <path d="M3.5 17c0-3.6 2.9-5.8 6.5-5.8s6.5 2.2 6.5 5.8z" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </svg>
  );
}

function Seats({ group }: { group: ReportGroup }) {
  const open = group.seats - group.filled;
  const inPipeline = Math.min(group.pipeline, open);
  const empty = open - inPipeline;
  return (
    <div className="my-2.5 flex flex-wrap gap-1" aria-hidden="true">
      {Array.from({ length: group.filled }, (_, i) => (
        <span key={`f${i}`} className="flex h-5 w-5 items-center justify-center rounded-md bg-brand-blue text-white">
          <CheckIcon />
        </span>
      ))}
      {Array.from({ length: inPipeline }, (_, i) => (
        <span key={`p${i}`} className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-200 text-brand-blue-dark">
          <PersonIcon />
        </span>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <span key={`e${i}`} className="h-5 w-5 rounded-md border-[1.5px] border-dashed border-slate-300" />
      ))}
    </div>
  );
}

function sum(groups: ReportGroup[], key: "seats" | "filled" | "pipeline"): number {
  return groups.reduce((n, g) => n + g[key], 0);
}

export default function HiringReport({
  ho,
  branch,
  excluded,
  windows,
}: {
  ho: ReportGroup[];
  branch: ReportGroup[];
  excluded: { label: string; count: number }[];
  windows: ClosedWindowOption[];
}) {
  const [mode, setMode] = useState<Mode>("ho");
  const [selected, setSelected] = useState<string | null>(null);

  const groups = mode === "ho" ? ho : branch;
  const shown = useMemo(
    () => (selected ? groups.filter((g) => g.name === selected) : groups),
    [groups, selected]
  );

  const seats = sum(groups, "seats");
  const filled = sum(groups, "filled");
  const pipeline = sum(groups, "pipeline");
  const openSeats = seats - filled;
  const completeTeams = groups.filter((g) => g.filled === g.seats).length;
  const pct = seats > 0 ? Math.round((filled / seats) * 100) : 0;
  const pipelineWidth = seats > 0 ? (Math.min(pipeline, openSeats) / seats) * 100 : 0;

  const notes = excluded.map(
    (e) =>
      `${e.count} ${e.count === 1 ? "position is" : "positions are"} marked “${e.label}” and not counted here.`
  );

  // Table rows, split into the two sections of the tracker.
  const sections = useMemo(() => {
    const closed: { group: string; row: ReportRow }[] = [];
    const open: { group: string; row: ReportRow }[] = [];
    for (const g of shown) {
      for (const row of g.rows) (row.status === "closed" ? closed : open).push({ group: g.name, row });
    }
    const byGroup = (a: { group: string }, b: { group: string }) => a.group.localeCompare(b.group);
    return { closed: closed.sort(byGroup), open: open.sort(byGroup) };
  }, [shown]);

  const firstColumn = mode === "ho" ? "Department" : "Location";

  function pick(m: Mode) {
    setMode(m);
    setSelected(null);
  }

  function renderRows(items: { group: string; row: ReportRow }[]) {
    return items.map(({ group, row }, i) => {
      const firstOfGroup = i === 0 || items[i - 1].group !== group;
      const closedCount = row.status === "closed" ? row.seats : row.filled;
      const joining = formatDay(row.latestJoining);
      return (
        <tr key={row.id} className="border-t border-slate-200/50">
          <td className="px-3 py-2 font-semibold text-[#0e1b3d]">{firstOfGroup ? group : ""}</td>
          <td className="px-3 py-2">
            <Link
              href={`/dashboard/positions/${row.id}`}
              className="text-brand-blue underline decoration-brand-blue/30 underline-offset-2 hover:decoration-brand-blue"
            >
              {row.title ?? row.positionId ?? "Untitled"}
            </Link>
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-slate-600">
            {formatDay(row.raised) ?? <span className="text-slate-300">–</span>}
          </td>
          <td className="px-3 py-2 text-center">{row.seats}</td>
          <td className="px-3 py-2 text-center">
            {row.pipeline > 0 ? row.pipeline : <span className="text-slate-300">–</span>}
          </td>
          <td className="px-3 py-2 text-center font-bold text-brand-blue">
            {closedCount > 0 ? closedCount : <span className="font-normal text-slate-300">–</span>}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-slate-600">
            {formatDay(row.closedOn) ?? <span className="text-slate-300">–</span>}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-slate-600">
            {joining ?? <span className="text-slate-300">–</span>}
            {row.joinerCount > 1 && (
              <span className="ml-1 text-[10px] text-slate-400">({row.joinerCount} hires)</span>
            )}
          </td>
        </tr>
      );
    });
  }

  return (
    <div className="space-y-6">
      <div className={`${GLASS_PANEL} p-5`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {mode === "ho" ? "HO · by department" : "Branch · by location"}
            </p>
            <p className="mt-1.5 text-4xl font-extrabold leading-none text-brand-blue">
              {filled}
              <span className="ml-2 text-sm font-semibold text-slate-500">of {seats} seats filled</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-2xl font-extrabold text-brand-blue">{pct}%</p>
            <DataNotesFlag notes={notes} />
          </div>
        </div>
        <div
          className="my-4 flex h-4 overflow-hidden rounded-full bg-blue-50"
          role="img"
          aria-label={`${pct}% of seats filled`}
        >
          <div className="h-full bg-brand-blue" style={{ width: `${seats > 0 ? (filled / seats) * 100 : 0}%` }} />
          <div className="h-full bg-blue-200" style={{ width: `${pipelineWidth}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
          <span>
            <b className="mr-1 text-sm text-[#0e1b3d]">{pipeline}</b>candidates in pipeline
          </span>
          <span>
            <b className="mr-1 text-sm text-[#0e1b3d]">{openSeats}</b>seats still open
          </span>
          <span>
            <b className="mr-1 text-sm text-[#0e1b3d]">{completeTeams}</b>
            {mode === "ho" ? "departments" : "locations"} fully done
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full bg-white/60 p-1 text-xs font-bold">
          {(["ho", "branch"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => pick(m)}
              aria-pressed={mode === m}
              className={`rounded-full px-4 py-1.5 ${mode === m ? "bg-brand-blue text-white" : "text-slate-500 hover:bg-white"}`}
            >
              {m === "ho" ? "HO · by department" : "Branch · by location"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400">Closed positions shown:</span>
          {windows.map((w) => (
            <Link
              key={w.label}
              href={w.href}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                w.active ? "bg-brand-blue text-white" : "bg-white/70 text-slate-500 hover:bg-white"
              }`}
            >
              {w.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded bg-brand-blue text-white">
            <CheckIcon />
          </span>
          Filled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded bg-blue-200 text-brand-blue-dark">
            <PersonIcon />
          </span>
          Candidate in pipeline
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-4 w-4 rounded border-[1.5px] border-dashed border-slate-300" />
          Still open
        </span>
      </div>

      {groups.length === 0 ? (
        <p className={`${GLASS_PANEL} p-6 text-sm text-slate-500`}>Nothing to show for this view.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {groups.map((g) => {
            const done = g.filled === g.seats;
            const gp = Math.round((g.filled / g.seats) * 100);
            const active = selected === g.name;
            return (
              <button
                key={g.name}
                type="button"
                onClick={() => setSelected(active ? null : g.name)}
                aria-pressed={active}
                className={`${GLASS_PANEL} relative p-4 text-left transition hover:bg-white/80 ${
                  active ? "ring-2 ring-brand-blue" : done ? "border-brand-blue/60" : ""
                }`}
              >
                {done && (
                  <span className="absolute right-3 top-3 text-brand-blue" title="All seats filled">
                    <TrophyIcon />
                  </span>
                )}
                <p className="pr-7 text-sm font-bold text-[#0e1b3d]">{g.name}</p>
                <Seats group={g} />
                <div className="h-1.5 overflow-hidden rounded-full bg-blue-50">
                  <div className="h-full rounded-full bg-brand-blue" style={{ width: `${gp}%` }} />
                </div>
                <p className="mt-1.5 flex justify-between text-[11px] text-slate-500">
                  <span>
                    <b className="font-bold text-[#0e1b3d]">{g.filled}</b> of {g.seats} filled
                  </span>
                  <span>{g.pipeline > 0 ? `${g.pipeline} in pipeline` : done ? "Complete" : "No pipeline"}</span>
                </p>
              </button>
            );
          })}
        </div>
      )}

      <div className={`${GLASS_PANEL} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <h2 className="text-sm font-bold text-[#0e1b3d]">
            {mode === "ho" ? "HO recruitment tracker" : "Branch recruitment tracker"}
            {selected ? ` · ${selected}` : ""}
          </h2>
          {selected && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-xs font-bold text-brand-blue underline underline-offset-2"
            >
              Show all {mode === "ho" ? "departments" : "locations"}
            </button>
          )}
        </div>
        <ScrollTable>
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-blue-50 text-[11px] uppercase tracking-wide text-brand-blue-dark">
              <tr>
                <th className="px-3 py-2">{firstColumn}</th>
                <th className="px-3 py-2">Position</th>
                <th className="px-3 py-2">Raised</th>
                <th className="px-3 py-2 text-center"># positions</th>
                <th className="px-3 py-2 text-center">Active pipeline</th>
                <th className="px-3 py-2 text-center"># closed</th>
                <th className="px-3 py-2">Closed on</th>
                <th className="px-3 py-2">Joining</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-blue-50/60 font-bold text-brand-blue-dark">
                <td className="px-3 py-2" colSpan={3}>
                  Total
                </td>
                <td className="px-3 py-2 text-center">{sum(shown, "seats")}</td>
                <td className="px-3 py-2 text-center">{sum(shown, "pipeline")}</td>
                <td className="px-3 py-2 text-center">{sum(shown, "filled")}</td>
                <td className="px-3 py-2" colSpan={2} />
              </tr>
              <tr className="bg-brand-blue text-white">
                <td className="px-3 py-2 font-bold" colSpan={8}>
                  Closed positions ({sections.closed.length})
                </td>
              </tr>
              {sections.closed.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-400" colSpan={8}>
                    No closed positions in this window.
                  </td>
                </tr>
              ) : (
                renderRows(sections.closed)
              )}
              <tr className="bg-brand-blue text-white">
                <td className="px-3 py-2 font-bold" colSpan={8}>
                  Open positions ({sections.open.length})
                </td>
              </tr>
              {sections.open.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-slate-400" colSpan={8}>
                    No open positions.
                  </td>
                </tr>
              ) : (
                renderRows(sections.open)
              )}
            </tbody>
          </table>
        </ScrollTable>
      </div>
    </div>
  );
}
