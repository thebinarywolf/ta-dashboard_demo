"use client";

import { Fragment, useState } from "react";
import FieldValue from "@/components/field-value";

export interface InterviewHistoryRow {
  id: string;
  dateLabel: string | null;
  candidate: string | null;
  round: string | null;
  interviewer: string | null;
  outcome: string | null;
  /** The standard feedback category from the sheet's "Feedback" column. */
  feedback: string | null;
  /** The detailed "Reason for Selection / Rejection" free text. */
  reason: string | null;
}

const OUTCOME_STYLES: Record<string, string> = {
  Selected: "bg-green-50 text-sla-ok",
  Rejected: "bg-red-50 text-sla-breach",
  "On Hold": "bg-amber-50 text-amber-700",
};

// Outcomes where a standard feedback is expected; for others (e.g. interview
// still pending) a blank Feedback is normal, not a data gap.
const DECIDED_OUTCOMES = new Set(["Selected", "Rejected", "On Hold", "Shortlisted"]);

export default function InterviewHistoryTable({ rows }: { rows: InterviewHistoryRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-3">Date</th>
          <th className="px-4 py-3">Candidate</th>
          <th className="px-4 py-3">Round</th>
          <th className="px-4 py-3">Interviewer</th>
          <th className="px-4 py-3">Outcome</th>
          <th className="px-4 py-3">Feedback</th>
          <th className="px-4 py-3">Details</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => {
          const open = openId === c.id;
          return (
            <Fragment key={c.id}>
              <tr className="border-b border-slate-200/50 last:border-0">
                <td className="px-4 py-3 text-slate-600">
                  <FieldValue value={c.dateLabel} />
                </td>
                <td className="px-4 py-3 text-slate-900">
                  <FieldValue value={c.candidate} />
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <FieldValue value={c.round} />
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <FieldValue value={c.interviewer} />
                </td>
                <td className="px-4 py-3">
                  {c.outcome ? (
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        OUTCOME_STYLES[c.outcome] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {c.outcome}
                    </span>
                  ) : (
                    <FieldValue value={null} />
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.feedback ? (
                    <span className="whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-brand-blue-dark">
                      {c.feedback}
                    </span>
                  ) : c.outcome && DECIDED_OUTCOMES.has(c.outcome) ? (
                    <FieldValue value={null} />
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {c.reason ? (
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : c.id)}
                      aria-expanded={open}
                      className="flex items-center gap-1 whitespace-nowrap text-xs font-bold text-brand-blue hover:underline"
                    >
                      {open ? "Hide" : "View"}
                      <svg
                        viewBox="0 0 20 20"
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className={`transition-transform ${open ? "rotate-180" : ""}`}
                      >
                        <path d="M5 8l5 5 5-5" />
                      </svg>
                    </button>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
              {open && c.reason && (
                <tr className="border-b border-slate-200/50 bg-white/50 last:border-0">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-brand-blue-dark">
                        Reason for selection / rejection
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#0e1b3d]">{c.reason}</p>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
