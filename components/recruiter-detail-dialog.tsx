"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { DrillResult } from "@/lib/metrics/recruiter-analytics";

function formatDay(iso: string | null): string {
  if (!iso) return "–";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const dash = <span className="text-slate-300">–</span>;
const TH = "whitespace-nowrap px-3 py-2";
const TD = "px-3 py-2 text-slate-600";

/** The positions or interviews behind a number the user clicked, in a panel that
 *  slides in from the right. Close with the button, the backdrop or Esc. */
export default function RecruiterDetailDialog({
  title,
  subtitle,
  result,
  onClose,
}: {
  title: string;
  subtitle: string;
  result: DrillResult;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const positions = useMemo(() => {
    if (result.kind !== "positions") return [];
    return result.positions.filter(
      (p) =>
        !q ||
        [p.code, p.title, p.department, p.seniority, p.assignedTa, p.closedBy]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
    );
  }, [result, q]);
  const interviews = useMemo(() => {
    if (result.kind !== "interviews") return [];
    return result.interviews.filter(
      (i) =>
        !q ||
        [i.candidate, i.positionCode, i.positionTitle, i.interviewer, i.recruiterRaw, i.outcome, i.reason]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q))
    );
  }, [result, q]);

  const total = result.kind === "positions" ? result.positions.length : result.interviews.length;
  const shown = result.kind === "positions" ? positions.length : interviews.length;
  const noun = result.kind === "positions" ? (total === 1 ? "position" : "positions") : total === 1 ? "interview" : "interviews";

  // Rendered on <body> so no wrapper on the page can offset or clip the panel.
  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#0e1b3d]/30 backdrop-blur-[2px]"
      />
      <div className="relative flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-[#0e1b3d]">{title}</h2>
            <p className="text-xs text-slate-500">
              {total} {noun} · {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-brand-blue-dark hover:bg-blue-100"
          >
            Close ✕
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={result.kind === "positions" ? "Search position, department, recruiter…" : "Search candidate, position, interviewer…"}
            aria-label="Search the list"
            className="w-full max-w-sm rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-[#0e1b3d] outline-none focus:border-brand-blue"
          />
          {q && (
            <span className="ml-3 text-xs text-slate-400">
              {shown} of {total}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {result.kind === "positions" ? (
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-blue-50 text-[11px] uppercase tracking-wide text-brand-blue-dark">
                <tr>
                  <th className={TH}>Position</th>
                  <th className={TH}>Department</th>
                  <th className={TH}>Seniority</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Assigned TA</th>
                  <th className={TH}>Closed by</th>
                  <th className={TH}>Assigned on</th>
                  <th className={TH}>Closed on</th>
                  <th className={TH}>Days</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.id} className="border-t border-slate-200/60">
                    <td className="px-3 py-2">
                      <Link href={`/dashboard/positions/${p.id}`} className="font-semibold text-brand-blue hover:underline">
                        {p.title ?? "Untitled"}
                      </Link>
                      {p.code && <span className="block text-[10px] text-slate-400">{p.code}</span>}
                    </td>
                    <td className={TD}>{p.department ?? dash}</td>
                    <td className={TD}>{p.seniority}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          p.status === "Open" ? "bg-blue-50 text-brand-blue-dark" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className={TD}>{p.assignedTa ?? dash}</td>
                    <td className={TD}>{p.closedBy ?? dash}</td>
                    <td className={`${TD} whitespace-nowrap`}>{formatDay(p.assignedOn)}</td>
                    <td className={`${TD} whitespace-nowrap`}>{formatDay(p.dateClosed)}</td>
                    <td className={TD}>{p.daysToClose === null ? dash : `${p.daysToClose}d`}</td>
                  </tr>
                ))}
                {positions.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                      {total === 0 ? "Nothing to show." : "Nothing matches that."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-blue-50 text-[11px] uppercase tracking-wide text-brand-blue-dark">
                <tr>
                  <th className={TH}>Date</th>
                  <th className={TH}>Candidate</th>
                  <th className={TH}>Position</th>
                  <th className={TH}>Round</th>
                  <th className={TH}>Interviewer</th>
                  <th className={TH}>Recruiter</th>
                  <th className={TH}>Outcome</th>
                  <th className={TH}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map((i, idx) => (
                  <tr key={idx} className="border-t border-slate-200/60 align-top">
                    <td className={`${TD} whitespace-nowrap`}>{formatDay(i.date)}</td>
                    <td className="px-3 py-2 font-semibold text-[#0e1b3d]">{i.candidate ?? dash}</td>
                    <td className="px-3 py-2">
                      {i.positionRowId ? (
                        <Link href={`/dashboard/positions/${i.positionRowId}`} className="font-semibold text-brand-blue hover:underline">
                          {i.positionTitle ?? i.positionCode ?? "Position"}
                        </Link>
                      ) : (
                        <span className="text-slate-600">{i.positionTitle ?? i.positionCode ?? dash}</span>
                      )}
                    </td>
                    <td className={TD}>{i.round ?? dash}</td>
                    <td className={TD}>{i.interviewer ?? dash}</td>
                    <td className={TD}>{i.recruiterRaw ?? dash}</td>
                    <td className="px-3 py-2">
                      {i.outcome ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            i.outcome === "Selected"
                              ? "bg-blue-100 text-brand-blue-dark"
                              : i.outcome === "Rejected"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-blue-50 text-slate-500"
                          }`}
                        >
                          {i.outcome}
                        </span>
                      ) : (
                        dash
                      )}
                    </td>
                    <td className={`${TD} min-w-[160px]`}>{i.reason ?? dash}</td>
                  </tr>
                ))}
                {interviews.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                      {total === 0 ? "Nothing to show." : "Nothing matches that."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
