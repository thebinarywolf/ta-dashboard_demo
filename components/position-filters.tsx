"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GLASS_PANEL } from "@/components/glass-card";
import type { PositionSuggestion } from "@/lib/local-db/queries";
import { buildQuickRanges } from "@/lib/date-ranges";
import { startNavProgress } from "@/components/navigation-progress";

const FIELD_CLASS =
  "rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm text-[#0e1b3d] outline-none focus:border-brand-blue";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wide text-slate-500";

function DepartmentMultiSelect({
  departments,
  selected,
  onChange,
}: {
  departments: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggle(dept: string) {
    const next = selected.includes(dept)
      ? selected.filter((d) => d !== dept)
      : [...selected, dept];
    onChange(next);
  }

  const label =
    selected.length === 0
      ? "All departments"
      : selected.length <= 2
        ? selected.join(", ")
        : `${selected.length} departments`;

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <label className={LABEL_CLASS}>Department</label>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${FIELD_CLASS} min-w-[170px] text-left`}
      >
        {label}
      </button>
      {open && (
        <div className="absolute top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#0e1b3d] hover:bg-slate-50">
            <input
              type="checkbox"
              checked={selected.length === 0}
              onChange={() => onChange([])}
            />
            All departments
          </label>
          <div className="my-1 border-t border-slate-100" />
          {departments.map((d) => (
            <label
              key={d}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#0e1b3d] hover:bg-slate-50"
            >
              <input type="checkbox" checked={selected.includes(d)} onChange={() => toggle(d)} />
              {d}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PositionFilters({
  departments,
  suggestions,
}: {
  departments: string[];
  suggestions: PositionSuggestion[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  // Re-sync the search box whenever the URL's own `q` changes for a reason
  // other than typing in this box — e.g. "Clear filters", or navigating via
  // one of the stat-card links — since useState's initial value only applies
  // on first mount, not on every render.
  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  const selectedDepartments = (searchParams.get("department") ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startNavProgress();
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  const suggestionValues = Array.from(
    new Set(
      suggestions.flatMap((p) => [p.position_id, p.position_title].filter((v): v is string => !!v))
    )
  );

  const today = new Date().toISOString().slice(0, 10);
  const quickRanges = buildQuickRanges(today);
  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";

  function applyRange(from: string, to: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", from);
    params.set("to", to);
    startNavProgress();
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters =
    searchParams.has("q") ||
    searchParams.has("department") ||
    searchParams.has("from") ||
    searchParams.has("to");

  return (
    <div className={`${GLASS_PANEL} relative z-30 flex flex-wrap items-end gap-3 p-4`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParam("q", search);
        }}
        className="flex items-end gap-2"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="pos-search" className={LABEL_CLASS}>Search</label>
          <input
            id="pos-search"
            type="text"
            list="position-suggestions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Job ID or position title"
            className={`${FIELD_CLASS} w-56`}
          />
          <datalist id="position-suggestions">
            {suggestionValues.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
        </div>
        <button
          type="submit"
          className="rounded-full bg-brand-blue px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-blue-dark"
        >
          Search
        </button>
      </form>

      <DepartmentMultiSelect
        departments={departments}
        selected={selectedDepartments}
        onChange={(next) => updateParam("department", next.join(","))}
      />

      <div className="flex flex-col gap-1">
        <label htmlFor="pos-from" className={LABEL_CLASS}>Assigned from</label>
        <input
          id="pos-from"
          type="date"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => updateParam("from", e.target.value)}
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="pos-to" className={LABEL_CLASS}>Assigned to</label>
        <input
          id="pos-to"
          type="date"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => updateParam("to", e.target.value)}
          className={FIELD_CLASS}
        />
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setSearch("");
            startNavProgress();
            router.push(pathname);
          }}
          className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200"
        >
          Clear filters
        </button>
      )}
      <div className="flex w-full flex-wrap items-center gap-2 pt-1">
        <span className="text-xs font-semibold text-slate-400">Quick ranges:</span>
        {quickRanges.map((r) => {
          const active = currentFrom === r.from && currentTo === r.to;
          return (
            <button
              key={r.label}
              type="button"
              onClick={() => applyRange(r.from, r.to)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                active ? "bg-brand-blue text-white" : "bg-white/70 text-slate-500 hover:bg-white"
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
