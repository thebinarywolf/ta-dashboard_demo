"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { GLASS_PANEL } from "@/components/glass-card";
import FieldValue from "@/components/field-value";
import LiquidGauge from "@/components/liquid-gauge";
import ScrollTable from "@/components/scroll-table";
import { formatAge } from "@/lib/format-age";
import { joinDateText } from "@/lib/format-join-date";
import type { OpenPositionRow } from "@/lib/local-db/queries";

type Chip = "all" | "hot" | "branch" | "other";

/** The flame in front of a position: lit = hot, dull = not marked (admins, recruiters and Pro Viewers
 *  see the dull one, and click it to mark the position). */
function Flame({ lit, className = "h-5 w-5" }: { lit: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <defs>
        <linearGradient id="flame-lit" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f97316" />
          <stop offset="1" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5c.6 3-1 4.6-2.6 6.4C7.9 10.6 6.5 12.4 6.5 15a5.5 5.5 0 0 0 11 0c0-2-.9-3.4-1.9-4.6-.3 1.2-.9 2-1.7 2.4.5-3-.3-6.6-1.9-10.3Z"
        fill={lit ? "url(#flame-lit)" : "none"}
        stroke={lit ? "#ea580c" : "#cbd5e1"}
        strokeWidth={lit ? 1 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function pendingClass(days: number | null): string {
  if (days === null) return "text-slate-400";
  if (days > 150) return "text-red-600";
  if (days > 60) return "text-amber-600";
  return "text-[#0e1b3d]";
}

interface Split {
  carried: number;
  fresh: number;
}

function StatMini({
  label,
  value,
  split,
  newWord,
}: {
  label: string;
  value: React.ReactNode;
  split?: Split;
  newWord: string;
}) {
  return (
    <div className={`${GLASS_PANEL} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-[#0e1b3d]">{value}</p>
      {split && (
        <p className="mt-1 text-[10px] font-semibold text-slate-400">
          Created earlier <span className="text-[#0e1b3d]">{split.carried}</span> · {newWord}{" "}
          <span className="text-[#0e1b3d]">{split.fresh}</span>
        </p>
      )}
    </div>
  );
}

const STAGE_LABELS: { key: keyof OpenPositionRow["stages"]; label: string }[] = [
  { key: "sourced", label: "Sourced" },
  { key: "interviewed", label: "Interviewed" },
  { key: "selected", label: "Selected" },
  { key: "yetToJoin", label: "Yet to join" },
  { key: "joined", label: "Joined" },
  { key: "rejected", label: "Rejected" },
];

/** The tiles shown when a row is expanded. "Pipeline" is the count the TA tracker
 *  reports for the position (same number as the Pipeline column); the rest
 *  come from the interview log. It sits right after Sourced. */
function stageTiles(p: OpenPositionRow): { key: string; label: string; value: number | null }[] {
  const [sourced, ...rest] = STAGE_LABELS;
  return [
    { key: sourced.key, label: sourced.label, value: p.stages[sourced.key] },
    { key: "pipeline", label: "Pipeline", value: p.pipelineCount ?? null },
    ...rest.map(({ key, label }) => ({ key, label, value: p.stages[key] })),
  ];
}

export default function OpenPositionsTracker({
  positions,
  startLabel,
  periodLabel,
  newWord,
  hotIds,
  canMarkHot,
}: {
  /** Job IDs an admin has marked as hot. */
  hotIds: string[];
  /** Admins, recruiters and Pro Viewers can mark or un-mark a position. */
  canMarkHot: boolean;
  positions: OpenPositionRow[];
  /** First day of the period, e.g. "1 Oct". */
  startLabel: string;
  /** The period itself, e.g. "Oct 2026" or "1 Oct – 6 Oct 2026". */
  periodLabel: string;
  /** What to call positions created inside the period: "This month" or "In range". */
  newWord: string;
}) {
  const [chip, setChip] = useState<Chip>("all");
  // Takes out positions whose seats are all taken by people who are yet to join.
  const [hideCovered, setHideCovered] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();
  const [hot, setHot] = useState<Set<string>>(() => new Set(hotIds));
  const [hotError, setHotError] = useState<string | null>(null);
  // A refresh (or a sync) brings the saved list in again.
  useEffect(() => setHot(new Set(hotIds)), [hotIds]);

  const isHot = (p: OpenPositionRow) => !!p.position_id && hot.has(p.position_id);

  async function toggleHot(p: OpenPositionRow) {
    const id = p.position_id;
    if (!id || !canMarkHot) return;
    const makeHot = !hot.has(id);
    setHotError(null);
    setHot((prev) => {
      const next = new Set(prev);
      if (makeHot) next.add(id);
      else next.delete(id);
      return next;
    });
    try {
      const res = await fetch("/api/hot-positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positionId: id, hot: makeHot }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not save");
      router.refresh();
    } catch (e) {
      // Put it back the way it was.
      setHot((prev) => {
        const next = new Set(prev);
        if (makeHot) next.delete(id);
        else next.add(id);
        return next;
      });
      setHotError(e instanceof Error ? e.message : "Could not save");
    }
  }

  const hotCount = positions.filter(isHot).length;
  const branchCount = positions.filter((p) => p.isBranch).length;
  const otherCount = positions.length - branchCount;

  const coveredCount = positions.filter((p) => p.fullyCovered).length;

  const filtered = useMemo(() => {
    let rows = positions;
    if (chip === "hot") rows = rows.filter((p) => !!p.position_id && hot.has(p.position_id));
    else if (chip === "branch") rows = rows.filter((p) => p.isBranch);
    else if (chip === "other") rows = rows.filter((p) => !p.isBranch);
    return hideCovered ? rows.filter((p) => !p.fullyCovered) : rows;
  }, [positions, chip, hot, hideCovered]);

  // Each metric is summed per position, then split by whether that position
  // was carried forward from an earlier month or created this month.
  const summary = useMemo(() => {
    const zero = (): Split => ({ carried: 0, fresh: 0 });
    const acc = { pipeline: zero(), interviewed: zero(), interviewed7d: zero(), rejected: zero() };
    for (const p of filtered) {
      const key = p.isNewInPeriod ? "fresh" : "carried";
      acc.pipeline[key] += p.pipelineCount ?? 0;
      acc.interviewed[key] += p.interviewed;
      acc.interviewed7d[key] += p.interviewedLast7Days;
      acc.rejected[key] += p.stages.rejected;
    }
    const total = (s: Split) => s.carried + s.fresh;
    return {
      pipeline: { total: total(acc.pipeline), split: acc.pipeline },
      interviewed: { total: total(acc.interviewed), split: acc.interviewed },
      interviewed7d: { total: total(acc.interviewed7d), split: acc.interviewed7d },
      rejected: { total: total(acc.rejected), split: acc.rejected },
    };
  }, [filtered]);

  const chips: { key: Chip; label: string; count: number }[] = [
    { key: "all", label: "All open", count: positions.length },
    { key: "hot", label: hotCount === 1 ? "Hot position" : "Hot positions", count: hotCount },
    { key: "branch", label: "Branch sales", count: branchCount },
    { key: "other", label: "Other departments", count: otherCount },
  ];

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-semibold text-slate-400">
          All open positions, split by when they were created: &quot;Created earlier&quot; = before{" "}
          {startLabel}, &quot;{newWord}&quot; = created {periodLabel}.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatMini
            label="In pipeline"
            value={summary.pipeline.total}
            split={summary.pipeline.split}
            newWord={newWord}
          />
          <StatMini
            label="Interviewed"
            value={summary.interviewed.total}
            split={summary.interviewed.split}
            newWord={newWord}
          />
          <StatMini
            label="Interviewed (7d)"
            value={summary.interviewed7d.total}
            split={summary.interviewed7d.split}
            newWord={newWord}
          />
          <StatMini
            label="Rejected"
            value={summary.rejected.total}
            split={summary.rejected.split}
            newWord={newWord}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setChip(c.key)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              chip === c.key
                ? "bg-brand-blue text-white"
                : "bg-white/70 text-slate-500 hover:bg-white"
            }`}
          >
            {c.key === "hot" && <Flame lit className="h-3.5 w-3.5" />}
            {c.label} ({c.count})
          </button>
        ))}
        {coveredCount > 0 && (
          <button
            type="button"
            onClick={() => setHideCovered((v) => !v)}
            aria-pressed={hideCovered}
            title="Positions where the people yet to join fill every seat needed"
            className={`ml-auto flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition ${
              hideCovered
                ? "border-brand-blue bg-brand-blue text-white"
                : "border-brand-blue/30 bg-blue-50 text-brand-blue hover:bg-white"
            }`}
          >
            {hideCovered ? "Showing without fully covered" : "Hide fully covered"} ({coveredCount})
          </button>
        )}
      </div>
      {coveredCount > 0 && (
        <p className="-mt-2 text-[11px] text-slate-400">
          Blue rows are fully covered: every seat is taken by someone who has joined or is yet to join, so no
          more sourcing is needed. The glass shows seats filled against seats needed.
        </p>
      )}
      {canMarkHot && (
        <p className="-mt-2 text-[11px] text-slate-400">
          Click the grey flame in front of a position to mark it hot. Everyone will see it and can filter by Hot positions.
        </p>
      )}
      {hotError && (
        <p role="alert" className="-mt-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-xs font-medium text-red-700">
          {hotError}
        </p>
      )}

      {/* Scrolls inside its own box so the header row can stay put (a sticky
          header does not work inside a horizontally scrolling wrapper). */}
      <ScrollTable className={`${GLASS_PANEL} max-h-[70vh]`}>
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#f3f7fd] text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_rgba(148,163,184,0.35)]">
            <tr>
              <th className="sticky left-0 z-[2] bg-[#f3f7fd] px-4 py-3">Position</th>
              <th className="px-4 py-3" title="How many people this position needs (Position Open in the sheet)">Requirements</th>
              <th className="px-4 py-3">Sourced</th>
              <th className="px-4 py-3">Pipeline</th>
              <th className="px-4 py-3">Interviewed</th>
              <th className="px-4 py-3">Last 7d</th>
              <th className="px-4 py-3">Ageing</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const isOpen = expandedId === p.id;
              return (
                <Fragment key={p.id}>
                  <tr
                    onClick={() => setExpandedId(isOpen ? null : p.id)}
                    className={`cursor-pointer border-b border-slate-200/50 last:border-0 hover:bg-white/40 ${
                      p.fullyCovered
                        ? "bg-blue-100/70 shadow-[inset_4px_0_0_#1e50cc]"
                        : isOpen
                          ? "bg-white/60"
                          : ""
                    }`}
                  >
                    <td
                      className={`sticky left-0 z-[1] min-w-[10.5rem] max-w-[13rem] px-4 py-3 sm:max-w-none shadow-[1px_0_0_rgba(148,163,184,0.25)] ${
                        p.fullyCovered ? "bg-[#dbe6fa] shadow-[inset_4px_0_0_#1e50cc]" : isOpen ? "bg-[#f9fbff]" : "bg-[#f5f8fe]"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {canMarkHot && p.position_id ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void toggleHot(p);
                            }}
                            title={isHot(p) ? "Hot position. Click to remove" : "Click to mark as a hot position"}
                            aria-label={isHot(p) ? "Remove hot mark" : "Mark as hot"}
                            aria-pressed={isHot(p)}
                            className="mt-0.5 shrink-0 rounded-full p-0.5 transition hover:scale-110 hover:bg-white"
                          >
                            <Flame lit={isHot(p)} />
                          </button>
                        ) : isHot(p) ? (
                          <span title="Hot position" className="mt-0.5 shrink-0 p-0.5">
                            <Flame lit />
                          </span>
                        ) : (
                          // Keeps the titles lined up for people who cannot mark positions.
                          <span className="hidden" />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 font-semibold text-[#0e1b3d]">
                            {p.position_title ?? p.position_id ?? "Untitled"}
                          </div>
                          <div className="text-xs text-slate-400">
                            <FieldValue value={p.department} />
                            {p.state ? ` · ${p.state}` : ""}
                            {p.position_id ? ` · ${p.position_id}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {p.requirements ? (
                        (() => {
                          const seats = p.requirements;
                          const filled = Math.min(seats, p.stages.yetToJoin + p.stages.joined);
                          const pending = seats - filled;
                          return (
                            <div
                              className="flex items-center gap-2"
                              title={`${filled} of ${seats} seats filled (${p.stages.joined} joined, ${p.stages.yetToJoin} yet to join), ${pending} pending`}
                            >
                              <LiquidGauge filled={filled} seats={seats} />
                              <div className="whitespace-nowrap text-[11px] leading-tight">
                                <div className="font-bold text-[#0e1b3d]">
                                  {pending === 0 ? "All filled" : `${pending} pending`}
                                </div>
                                <div className="text-slate-400">of {seats} needed</div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <FieldValue value={null} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.sourced}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.pipelineCount ?? <FieldValue value={null} />}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.interviewed}</td>
                    <td className="px-4 py-3 text-slate-600">{p.interviewedLast7Days}</td>
                    <td className={`px-4 py-3 font-semibold ${pendingClass(p.agingDays)}`}>
                      {p.agingDays !== null ? (
                        <span title={`${p.agingDays} days since the role was assigned`}>
                          {formatAge(p.agingDays)}
                        </span>
                      ) : (
                        <FieldValue value={null} />
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-slate-200/50 bg-white/50 last:border-0">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="flex flex-wrap gap-3">
                          {stageTiles(p).map(({ key, label, value }) => {
                            return (
                              <div
                                key={key}
                                className={`${GLASS_PANEL} min-w-[96px] px-3 py-2 text-center`}
                              >
                                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                  {label}
                                </div>
                                <div className="mt-0.5 text-lg font-extrabold text-[#0e1b3d]">
                                  {value === null ? <FieldValue value={null} /> : value}
                                </div>
                              </div>
                            );
                          })}
                          {(p.joiners.length > 0 || p.stages.yetToJoin > 0) && (
                            <div className="min-w-[220px] flex-1 rounded-2xl bg-blue-50/70 px-4 py-2 text-xs">
                              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                Joining
                              </div>
                              {p.joiners.map((j) => (
                                <div key={j.name} className="mt-1 flex items-baseline justify-between gap-3">
                                  <span className="font-semibold text-[#0e1b3d]">{j.name}</span>
                                  <span className="text-slate-500">{joinDateText(j.doj)}</span>
                                </div>
                              ))}
                              {p.joiners.length < p.stages.yetToJoin && (
                                <div className="mt-1 text-slate-400">
                                  {p.stages.yetToJoin - p.joiners.length} more yet to join, not added to the joiner
                                  tracker yet
                                  {p.joiners.length === 0 && p.comments ? ` (sheet note: ${p.comments})` : ""}
                                </div>
                              )}
                            </div>
                          )}
                          <Link
                            href={`/dashboard/positions/${p.id}`}
                            prefetch={false}
                            className="ml-auto flex items-center rounded-full bg-brand-blue px-4 py-2 text-xs font-bold text-white hover:bg-brand-blue-dark"
                          >
                            View full detail &rarr;
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No open positions in this group.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollTable>
    </div>
  );
}
