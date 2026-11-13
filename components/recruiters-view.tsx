import Link from "next/link";
import { requireTabAccess } from "@/lib/auth/guards";
import AccessRestricted from "@/components/access-restricted";
import { GLASS_PANEL } from "@/components/glass-card";
import DataNotesFlag from "@/components/data-notes-flag";
import RecruiterAnalyticsView from "@/components/recruiter-analytics-view";
import RecruiterInfographics from "@/components/recruiter-infographics";
import { getRecruiterAnalytics } from "@/lib/metrics/recruiter-analytics-data";
import { buildQuickRanges } from "@/lib/date-ranges";

const FIELD_CLASS =
  "rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm text-[#0e1b3d] outline-none focus:border-brand-blue";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wide text-slate-500";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function validDate(value: string | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null;
}

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The Recruiters page. "tables" is the original tab; "infographics" is the staging
 *  copy that shows the same numbers as interactive charts. */
export default async function RecruitersView({
  searchParams,
  basePath,
  tabKey,
  variant,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
  basePath: string;
  tabKey: string;
  variant: "tables" | "infographics";
}) {
  const today = new Date().toISOString().slice(0, 10);
  let from = validDate(firstParam(searchParams.from));
  let to = validDate(firstParam(searchParams.to));
  if (from && to && from > to) [from, to] = [to, from];
  const rangeIsSet = !!(from || to);

  // Fetch at the same time as the permission check (they are independent).
  const dataPromise = getRecruiterAnalytics({ from, to, today });
  dataPromise.catch(() => {});

  const { allowed } = await requireTabAccess(tabKey);
  if (!allowed) return <AccessRestricted />;

  const analytics = await dataPromise;
  const presets = buildQuickRanges(today);
  const periodText = rangeIsSet
    ? `${from ? formatDay(from) : "the start"} to ${to ? formatDay(to) : "today"}`
    : "all time";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[#0e1b3d]">Recruiter / TA Performance</h1>
          <p className="text-sm text-slate-500">
            Open and closed positions, interviews and selections per recruiter, by seniority and month by month.
          </p>
        </div>
        <DataNotesFlag notes={analytics.notes} />
      </div>

      <form method="get" className={`${GLASS_PANEL} flex flex-wrap items-end gap-3 p-4`}>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS} htmlFor="from">
            From
          </label>
          <input id="from" name="from" type="date" defaultValue={from ?? ""} className={FIELD_CLASS} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS} htmlFor="to">
            To
          </label>
          <input id="to" name="to" type="date" defaultValue={to ?? ""} className={FIELD_CLASS} />
        </div>
        <button
          type="submit"
          className="rounded-full bg-brand-blue px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-blue-dark"
        >
          Apply
        </button>
        <div className="flex w-full flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-semibold text-slate-400">Quick ranges:</span>
          {presets.map((p) => {
            const active = from === p.from && to === p.to;
            return (
              <Link
                key={p.label}
                href={`${basePath}?from=${p.from}&to=${p.to}`}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  active ? "bg-brand-blue text-white" : "bg-white/70 text-slate-500 hover:bg-white"
                }`}
              >
                {p.label}
              </Link>
            );
          })}
          <Link
            href={basePath}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              !rangeIsSet ? "bg-brand-blue text-white" : "bg-white/70 text-slate-500 hover:bg-white"
            }`}
          >
            All time
          </Link>
        </div>
      </form>

      <p className="text-xs text-slate-400">
        Showing {rangeIsSet ? periodText : "all time"}. Closed positions are counted on the day they closed, interviews on
        the interview date.
      </p>

      {variant === "infographics" ? (
        <RecruiterInfographics analytics={analytics} periodText={periodText} />
      ) : (
        <RecruiterAnalyticsView analytics={analytics} periodText={periodText} />
      )}
    </div>
  );
}
