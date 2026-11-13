import Link from "next/link";
import { GLASS_PANEL } from "@/components/glass-card";
import HiredBadge from "@/components/hired-badge";

export interface CohortRow {
  label: string;
  value: number;
  /** When set, the number links to a list of exactly those positions. */
  href?: string;
  /** Show the row as a sub-item of the row above it. */
  indent?: boolean;
}

/** A headline stat with a small "data from ..." caption above it and a
 *  breakdown list beside it. The big number links to the whole group; each
 *  breakdown number links to just that slice. */
export default function CohortStatCard({
  label,
  value,
  valueClassName = "text-[#0e1b3d]",
  caption,
  rows,
  href,
  scene,
  badge,
}: {
  label: string;
  value: number;
  /** A highlighted figure shown beside the illustration, e.g. people hired. */
  badge?: {
    value: number;
    label: string;
    /** When set, the badge flips over now and then (or on click) to show
     *  this second number and its date range. */
    back?: { value: number; from: string; to: string };
  };
  valueClassName?: string;
  caption: string;
  rows: CohortRow[];
  href?: string;
  /** Optional small animated illustration shown along the bottom of the card. */
  scene?: React.ReactNode;
}) {
  const headline = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-extrabold ${valueClassName}`}>{value}</p>    </>
  );

  return (
    <div className={`${GLASS_PANEL} p-4`}>
      <p className="text-[10px] font-semibold text-slate-400">{caption}</p>
      <div className="mt-2 flex items-start justify-between gap-4">
        {href ? (
          <Link
            href={href}
            className="-m-1 block rounded-xl p-1 hover:bg-white/70"
            aria-label={`Show all ${label.toLowerCase()} positions`}
          >
            {headline}
          </Link>
        ) : (
          <div>{headline}</div>
        )}
        <dl className="min-w-0 flex-1 space-y-1.5 border-l border-slate-200/70 pl-4 text-xs">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3">
              <dt className={r.indent ? "pl-3 text-slate-400" : "text-slate-500"}>{r.label}</dt>
              <dd className="font-bold text-[#0e1b3d]">
                {r.href ? (
                  <Link
                    href={r.href}
                    title={`Show these ${r.value} positions`}
                    className="-mx-1.5 rounded-full px-1.5 py-0.5 text-brand-blue underline decoration-brand-blue/30 underline-offset-2 hover:bg-white/80 hover:decoration-brand-blue"
                  >
                    {r.value}
                  </Link>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {scene && (
        <div className="relative mt-3 overflow-hidden rounded-2xl bg-white/50">
          {/* With a badge, the picture is centred in the space beside it so
              the badge never covers the people. */}
          <div className={badge ? "pr-[7.25rem]" : undefined}>{scene}</div>
          {badge && <HiredBadge {...badge} />}
        </div>
      )}
    </div>
  );
}
