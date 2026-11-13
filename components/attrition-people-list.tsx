"use client";

import { Fragment, useMemo, useState } from "react";
import { formatAge } from "@/lib/format-age";
import type { LeaverDetail } from "@/lib/metrics/attrition-analysis";
import ScrollTable from "@/components/scroll-table";

function formatDay(iso: string | null): string {
  if (!iso) return "–";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The list of people who left, with a search box, an optional reason filter
 *  (set by the page from the link) and a View link for the detailed reason. */
export default function AttritionPeopleList({
  leavers,
  initialReason,
}: {
  leavers: LeaverDetail[];
  /** A reason to start filtered on; "__none__" = no reason recorded. */
  initialReason: string | null;
}) {
  const [query, setQuery] = useState("");
  const [reasonFilter, setReasonFilter] = useState<string | null>(initialReason);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leavers.filter((l) => {
      if (reasonFilter === "__none__") {
        if (l.reason) return false;
      } else if (reasonFilter && l.reason !== reasonFilter) {
        return false;
      }
      if (!q) return true;
      return [l.employeeCode, l.name, l.designation, l.place, l.reason]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [leavers, query, reasonFilter]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-[#0e1b3d]">
          People who left <span className="font-normal text-slate-400">({visible.length})</span>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {reasonFilter && (
            <button
              type="button"
              onClick={() => setReasonFilter(null)}
              title="Show everyone again"
              className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-brand-blue-dark hover:bg-white"
            >
              {reasonFilter === "__none__" ? "No reason recorded" : reasonFilter} ×
            </button>
          )}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, code, branch…"
            aria-label="Search people who left"
            className="w-56 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm text-[#0e1b3d] outline-none focus:border-brand-blue"
          />
        </div>
      </div>

      <ScrollTable outerClassName="mt-3" className="rounded-2xl bg-white/60">
        <table className="w-full min-w-[860px] text-left text-xs">
          <thead className="bg-blue-50 text-[11px] uppercase tracking-wide text-brand-blue-dark">
            <tr>
              <th className="px-3 py-2">Emp code</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Designation</th>
              <th className="px-3 py-2">Branch / place</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2">Left</th>
              <th className="px-3 py-2">Stayed</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l, i) => {
              const key = `${l.employeeCode ?? "none"}-${i}`;
              const open = openKey === key;
              const hasMore = !!(l.detail || l.manager || l.regrettable || l.voluntary);
              return (
                <Fragment key={key}>
                  <tr className="border-t border-slate-200/50">
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#0e1b3d]">{l.employeeCode ?? "–"}</td>
                    <td className="px-3 py-2 text-[#0e1b3d]">
                      {l.name ?? <span className="text-slate-300">–</span>}
                      {l.infant && (
                        <span className="ml-1.5 whitespace-nowrap rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-blue-dark">
                          Left early
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{l.designation ?? <span className="text-slate-300">–</span>}</td>
                    <td className="px-3 py-2 text-slate-600">{l.place ?? <span className="text-slate-300">–</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDay(l.joined)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDay(l.left)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                      {l.tenureDays === null ? "–" : formatAge(l.tenureDays)}
                    </td>
                    <td className="px-3 py-2">
                      {l.reason ? (
                        <span className="whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-brand-blue-dark">
                          {l.reason}
                        </span>
                      ) : (
                        <span className="text-slate-300">{l.hasExitRecord ? "–" : "No exit record"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {hasMore ? (
                        <button
                          type="button"
                          onClick={() => setOpenKey(open ? null : key)}
                          aria-expanded={open}
                          className="font-bold text-brand-blue hover:underline"
                        >
                          {open ? "Hide" : "View"}
                        </button>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-t border-slate-200/50 bg-white/50">
                      <td colSpan={9} className="px-3 py-3">
                        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-brand-blue-dark">
                            Reason for leaving, in detail
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-[#0e1b3d]">
                            {l.detail ?? "No detailed reason was written down."}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500">
                            {l.manager && <span>Reporting manager: <b className="text-[#0e1b3d]">{l.manager}</b></span>}
                            {l.state && <span>State: <b className="text-[#0e1b3d]">{l.state}</b></span>}
                            {l.regrettable && <span>Loss: <b className="text-[#0e1b3d]">{l.regrettable}</b></span>}
                            {l.voluntary && <span>Exit: <b className="text-[#0e1b3d]">{l.voluntary}</b></span>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                  {leavers.length === 0 ? "Nobody left in this period." : "Nobody matches that."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollTable>
    </div>
  );
}
