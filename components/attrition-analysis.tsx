import Link from "next/link";
import { GLASS_PANEL } from "@/components/glass-card";
import { countText, isSmallGroup, pctText } from "@/lib/metrics/attrition-format";
import type { AttritionAnalysis } from "@/lib/metrics/attrition-analysis";

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white/70 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-[#0e1b3d]">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function BarRow({
  label,
  count,
  max,
  suffix,
  href,
}: {
  label: string;
  count: number;
  max: number;
  suffix?: string;
  /** When set, the row links to the list of those people. */
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="truncate text-[#0e1b3d]">{label}</span>
        <span className="shrink-0 font-bold text-[#0e1b3d]">
          {count}
          {suffix && <span className="ml-1 font-normal text-slate-400">{suffix}</span>}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue-50">
        <div className="h-full rounded-full bg-brand-blue" style={{ width: `${max > 0 ? (count / max) * 100 : 0}%` }} />
      </div>
    </>
  );
  return href ? (
    <Link href={href} title="See these people" className="block rounded-xl px-2 py-1.5 hover:bg-white/80">
      {body}
    </Link>
  ) : (
    <div className="px-2 py-1.5">{body}</div>
  );
}

function Split({ title, parts }: { title: string; parts: { label: string; count: number }[] }) {
  const total = parts.reduce((n, p) => n + p.count, 0);
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-blue-50">
        {parts.map((p, i) => (
          <div
            key={p.label}
            className={i === 0 ? "bg-brand-blue" : i === 1 ? "bg-blue-300" : "bg-slate-200"}
            style={{ width: `${total > 0 ? (p.count / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
        {parts.map((p, i) => (
          <span key={p.label} className="flex items-center gap-1">
            <span
              className={`h-2 w-2 rounded-full ${i === 0 ? "bg-brand-blue" : i === 1 ? "bg-blue-300" : "bg-slate-200"}`}
            />
            {p.label} <b className="text-[#0e1b3d]">{p.count}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The attrition analysis for one group (everyone, a department, a state or an
 * age group): the numbers, why people left and how long they stayed. The list
 * of the people themselves lives on its own page (see `peopleHref`).
 */
export default function AttritionAnalysisPanel({
  scopeLabel,
  scoped,
  everyoneHref,
  peopleHref,
  reasonHref,
  periodText,
  infantDays,
  analysis,
  exitDataLoaded,
}: {
  scopeLabel: string;
  scoped: boolean;
  /** Where "Show everyone" goes. */
  everyoneHref: string;
  /** The separate page listing who left in this group. */
  peopleHref: string;
  /** The same list, narrowed to one reason ("__none__" = no reason recorded). */
  reasonHref: (reason: string) => string;
  periodText: string;
  infantDays: number;
  analysis: AttritionAnalysis;
  exitDataLoaded: boolean;
}) {
  const m = analysis.metrics;
  const maxReason = Math.max(1, ...analysis.reasons.map((r) => r.count));
  const maxTenure = Math.max(1, ...analysis.tenure.map((t) => t.count));
  const regrettableMarked = analysis.regrettable.regrettable + analysis.regrettable.nonRegrettable;
  const voluntaryMarked = analysis.voluntary.voluntary + analysis.voluntary.involuntary;

  return (
    <section className={`${GLASS_PANEL} space-y-5 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Attrition analysis</p>
          <h2 className="mt-0.5 text-lg font-extrabold text-[#0e1b3d]">{scopeLabel}</h2>
          <p className="text-xs text-slate-500">{periodText}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {scoped && (
            <Link
              href={everyoneHref}
              className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-brand-blue hover:bg-white"
            >
              Show everyone
            </Link>
          )}
          <Link
            href={peopleHref}
            className="rounded-full bg-brand-blue px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-blue-dark"
          >
            See the {m.leavers} {m.leavers === 1 ? "person" : "people"} who left →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Tile label="People from before" value={String(m.headcountStart)} sub="On the first day of the period" />
        <Tile label="Joined" value={String(m.joiners)} sub="In this period" />
        <Tile label="Left" value={String(m.leavers)} sub={m.leavers === 1 ? "person" : "people"} />
        <Tile label="People now" value={String(m.headcountEnd)} sub={`Average ${countText(m.averageHeadcount)}`} />
        <Tile
          label="Attrition"
          value={pctText(m.attritionPct)}
          sub={isSmallGroup(m.averageHeadcount) ? `Few people (${countText(m.averageHeadcount)} on average), so this swings a lot` : "Left ÷ average number of people"}
        />
        <Tile
          label="Infant attrition"
          value={pctText(m.infantPctOfJoiners)}
          sub={`${m.infantLeavers} of ${m.joiners} joiners left within ${infantDays} days`}
        />
        <Tile
          label="Left early"
          value={pctText(m.infantShareOfExitsPct)}
          sub={`of all who left (within ${infantDays} days)`}
        />
        <Tile
          label="Reason given"
          value={`${m.leavers - analysis.noReason} of ${m.leavers}`}
          sub={exitDataLoaded ? "Standard reason in the exit sheet" : "Exit sheet not loaded yet"}
        />
      </div>

      {!exitDataLoaded && (
        <p className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs font-medium text-brand-blue-dark">
          The reasons for leaving have not been loaded yet. An admin needs to run the new database step and then
          click Sync now in the Admin panel.
        </p>
      )}

      {m.leavers > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#0e1b3d]">Why people left</h3>
            {analysis.reasons.length === 0 ? (
              <p className="text-xs text-slate-400">No reasons recorded for these leavers.</p>
            ) : (
              analysis.reasons
                .slice(0, 12)
                .map((r) => (
                  <BarRow
                    key={r.reason}
                    label={r.reason}
                    count={r.count}
                    max={maxReason}
                    suffix={`${r.pct.toFixed(0)}%`}
                    href={reasonHref(r.reason)}
                  />
                ))
            )}
            {analysis.reasons.length > 12 && (
              <p className="px-2 text-[11px] text-slate-400">
                + {analysis.reasons.length - 12} smaller reasons (see them on the list page)
              </p>
            )}
            {analysis.noReason > 0 && (
              <BarRow
                label="No reason recorded"
                count={analysis.noReason}
                max={maxReason}
                suffix={`${((analysis.noReason / m.leavers) * 100).toFixed(0)}%`}
                href={reasonHref("__none__")}
              />
            )}
          </div>

          <div className="space-y-5">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#0e1b3d]">How long they stayed</h3>
              {analysis.tenure.map((t) => (
                <BarRow key={t.label} label={t.label} count={t.count} max={maxTenure} />
              ))}
            </div>
            {regrettableMarked > 0 && (
              <Split
                title="Was the loss regrettable?"
                parts={[
                  { label: "Regrettable", count: analysis.regrettable.regrettable },
                  { label: "Non-regrettable", count: analysis.regrettable.nonRegrettable },
                  { label: "Not marked", count: analysis.regrettable.notMarked },
                ]}
              />
            )}
            {voluntaryMarked > 0 && (
              <Split
                title="Voluntary or involuntary"
                parts={[
                  { label: "Voluntary", count: analysis.voluntary.voluntary },
                  { label: "Involuntary", count: analysis.voluntary.involuntary },
                  { label: "Not marked", count: analysis.voluntary.notMarked },
                ]}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
