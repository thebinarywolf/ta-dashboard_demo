import Link from "next/link";
import { GLASS_PANEL } from "@/components/glass-card";
import type { PositionPeriodStats } from "@/lib/local-db/queries";

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** "Jan 2026" or "Jan 2026 – Sep 2026" — the actual date coverage behind a
 *  period's numbers, so it's clear at a glance what window they represent. */
function dataRangeLabel(stats: PositionPeriodStats): string | null {
  if (!stats.earliestAssigned || !stats.latestAssigned) return null;
  const from = formatMonthYear(stats.earliestAssigned);
  const to = formatMonthYear(stats.latestAssigned);
  return from === to ? from : `${from} – ${to}`;
}

export default function PeriodStatCard({
  label,
  stats,
  totalHref,
  openHref,
  closedHref,
}: {
  label: string;
  stats: PositionPeriodStats;
  totalHref?: string;
  openHref?: string;
  closedHref?: string;
}) {
  const openPct = stats.total > 0 ? Math.round((stats.open / stats.total) * 100) : 0;
  const range = dataRangeLabel(stats);

  return (
    <div className={`${GLASS_PANEL} p-5`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
        {range && (
          <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {range}
          </span>
        )}
      </div>

      {totalHref ? (
        <Link
          href={totalHref}
          className="mt-1 block text-3xl font-extrabold text-[#0e1b3d] hover:underline"
        >
          {stats.total}
        </Link>
      ) : (
        <p className="mt-1 text-3xl font-extrabold text-[#0e1b3d]">{stats.total}</p>
      )}

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-blue"
          style={{ width: `${openPct}%` }}
          title={`${openPct}% still open`}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs font-bold">
        {openHref ? (
          <Link href={openHref} className="text-brand-blue hover:underline">
            {stats.open} open
          </Link>
        ) : (
          <span className="text-brand-blue">{stats.open} open</span>
        )}
        {closedHref ? (
          <Link href={closedHref} className="text-slate-500 hover:underline">
            {stats.closed} closed
          </Link>
        ) : (
          <span className="text-slate-500">{stats.closed} closed</span>
        )}
      </div>
    </div>
  );
}
