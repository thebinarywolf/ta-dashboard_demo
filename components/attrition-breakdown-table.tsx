"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import GlassCard, { GLASS_PANEL } from "@/components/glass-card";
import { countText, isSmallGroup, pctText, SMALL_GROUP_AVERAGE_STAFF } from "@/lib/metrics/attrition-format";
import type { AttritionRow } from "@/lib/metrics/attrition-calc";
import ScrollTable from "@/components/scroll-table";

type SortKey =
  | "label"
  | "headcountStart"
  | "headcountEnd"
  | "joiners"
  | "leavers"
  | "averageHeadcount"
  | "attritionPct"
  | "infantLeavers"
  | "infantShareOfExitsPct";

type SortDir = "asc" | "desc";

/** Clicking a header goes: highest first -> lowest first -> back to the
 *  original order. Names go A-Z first. */
function nextSort(
  current: { key: SortKey; dir: SortDir } | null,
  key: SortKey
): { key: SortKey; dir: SortDir } | null {
  const firstDir: SortDir = key === "label" ? "asc" : "desc";
  if (!current || current.key !== key) return { key, dir: firstDir };
  if (current.dir === firstDir) return { key, dir: firstDir === "asc" ? "desc" : "asc" };
  return null;
}

export default function AttritionBreakdownTable({
  title,
  firstColumn,
  filterPlaceholder,
  rows,
  infantDays,
  scopeKind,
  baseHref,
  selected,
}: {
  title: string;
  firstColumn: string;
  filterPlaceholder: string;
  rows: AttritionRow[];
  infantDays: number;
  /** Which kind of group the rows are; used to build the drill-down link. */
  scopeKind: "dept" | "age" | "state";
  /** Current page URL with the date range and infant window, no scope yet. */
  baseHref: string;
  /** Label of the row currently opened in the analysis panel, if any. */
  selected: string | null;
}) {
  const scopeUrl = (label: string) =>
    `${baseHref}${baseHref.includes("?") ? "&" : "?"}scope=${scopeKind}:${encodeURIComponent(label)}`;
  // Name and percentage open the analysis (on this page, in "More analysis");
  // the Left number opens the separate list of who left.
  const analysisHref = (label: string) => `${scopeUrl(label)}#more-analysis`;
  const peopleHref = (label: string) => `${scopeUrl(label)}&view=people`;
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir } | null>(null);

  // Bars are scaled against the whole list, so they don't rescale as you filter.
  // Small groups are left out of the scale so one extreme % does not flatten every other bar.
  const maxPct = Math.max(1, ...rows.filter((r) => !isSmallGroup(r.averageHeadcount)).map((r) => r.attritionPct ?? 0));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.label.toLowerCase().includes(q)) : rows;
    if (!sort) return filtered;

    const { key, dir } = sort;
    const sign = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (key === "label") return sign * a.label.localeCompare(b.label);
      const av = a[key];
      const bv = b[key];
      // Rows with no value (e.g. no leavers, so no %) always sink to the bottom.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return sign * (av - bv);
    });
  }, [rows, query, sort]);

  const columns: { key: SortKey; label: string }[] = [
    { key: "label", label: firstColumn },
    { key: "headcountStart", label: "People from before" },
    { key: "joiners", label: "Joined" },
    { key: "leavers", label: "Left" },
    { key: "headcountEnd", label: "People now" },
    { key: "averageHeadcount", label: "Average people" },
    { key: "attritionPct", label: "Attrition %" },
    { key: "infantLeavers", label: `Infant attrition (left within ${infantDays} days)` },
    { key: "infantShareOfExitsPct", label: "% of all who left" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-[#0e1b3d]">{title}</h2>
        <div className="flex items-center gap-2">
          {query.trim() && (
            <span className="text-xs text-slate-400">
              Showing {visible.length} of {rows.length}
            </span>
          )}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={filterPlaceholder}
            aria-label={filterPlaceholder}
            className="w-52 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm text-[#0e1b3d] outline-none focus:border-brand-blue"
          />
        </div>
      </div>

      <ScrollTable outerClassName="mt-3" className={`${GLASS_PANEL}`}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    className="px-4 py-3"
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => setSort(nextSort(sort, c.key))}
                      className={`flex items-center gap-1 text-left uppercase tracking-wide hover:text-brand-blue ${
                        active ? "text-brand-blue" : ""
                      }`}
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
            {visible.map((r) => (
              <tr
                key={r.label}
                className={`border-b border-slate-200/50 last:border-0 ${selected === r.label ? "bg-blue-50/70" : ""}`}
              >
                <td className="px-4 py-3 font-semibold">
                  <Link
                    href={analysisHref(r.label)}
                    title={`See the analysis: ${r.label}`}
                    className="text-brand-blue underline decoration-brand-blue/30 underline-offset-2 hover:decoration-brand-blue"
                  >
                    {r.label}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.headcountStart}</td>
                <td className="px-4 py-3 text-slate-600">{r.joiners}</td>
                <td className="px-4 py-3 font-bold">
                  <Link
                    href={peopleHref(r.label)}
                    title={`See who left: ${r.label}`}
                    className="rounded-full px-2 py-0.5 text-brand-blue underline decoration-brand-blue/30 underline-offset-2 hover:bg-white hover:decoration-brand-blue"
                  >
                    {r.leavers}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.headcountEnd}</td>
                <td className="px-4 py-3 text-slate-600">{countText(r.averageHeadcount)}</td>
                <td className="px-4 py-3">
                  <Link href={analysisHref(r.label)} className="block hover:opacity-80">
                    {isSmallGroup(r.averageHeadcount) ? (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-400">{pctText(r.attritionPct)}</span>
                          <span
                            title={`Only ${countText(r.averageHeadcount)} people on average, so this percentage swings a lot. Look at the number who left instead.`}
                            className="whitespace-nowrap rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-blue-dark"
                          >
                            Few people
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-200"
                            style={{ width: `${Math.min(100, ((r.attritionPct ?? 0) / maxPct) * 100)}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-semibold text-[#0e1b3d]">{pctText(r.attritionPct)}</div>
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-brand-blue"
                            style={{ width: `${Math.min(100, ((r.attritionPct ?? 0) / maxPct) * 100)}%` }}
                          />
                        </div>
                      </>
                    )}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.infantLeavers}</td>
                <td className="px-4 py-3 text-slate-600">{pctText(r.infantShareOfExitsPct)}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                  {rows.length === 0
                    ? "No people and no leavers in this period."
                    : `Nothing matches "${query.trim()}".`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollTable>
      <p className="mt-2 text-xs text-slate-400">
        Attrition % = Left ÷ Average people × 100. &quot;Few people&quot; = under {SMALL_GROUP_AVERAGE_STAFF} people on
        average, where the percentage swings a lot. People from before + Joined − Left = People now. Click a
        number to open the list of who left, or a name or a percentage for the analysis. Click a heading to sort.
      </p>
    </div>
  );
}
