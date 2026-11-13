import Link from "next/link";
import { Suspense } from "react";
import { getDashboardOverview } from "@/lib/metrics/overview";
import { getLastSyncInfo } from "@/lib/metrics/sync-status";
import { countPeopleHired, getEmployeesSnapshot } from "@/lib/metrics/attrition";
import { listAllProfiles } from "@/lib/access/profiles";
import { requireTabAccess } from "@/lib/auth/guards";
import { getCurrentProfile } from "@/lib/auth/current-user";
import type { DashboardFilters } from "@/lib/local-db/queries";
import FieldValue from "@/components/field-value";
import AccessRestricted from "@/components/access-restricted";
import GlassCard, { GLASS_PANEL } from "@/components/glass-card";
import ScrollTable from "@/components/scroll-table";
import CohortStatCard from "@/components/cohort-stat-card";
import PositionFilters from "@/components/position-filters";
import PeriodStatCard from "@/components/period-stat-card";
import OpenPositionsTracker from "@/components/open-positions-tracker";
import DataNotesFlag from "@/components/data-notes-flag";
import { canMarkHotPositions, getHotPositionIds } from "@/lib/metrics/hot-positions";
import { ClosedScene, CreatedScene, OpenScene } from "@/components/stat-scenes";

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "1 Jan", or "1 Jan '26" when the year needs showing. */
function shortDate(iso: string, withYear: boolean): string {
  return withYear ? `${formatDayMonth(iso)} '${iso.slice(2, 4)}` : formatDayMonth(iso);
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseListParam(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : value;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function daysBetweenIso(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / (1000 * 60 * 60 * 24));
}

/** Builds a link that keeps every current filter but overrides `status`,
 *  landing back on the positions table. `cohort`: omit to keep the current
 *  one, pass `null` to clear it, or "earlier" / "new" to list just that slice
 *  of the headline cards. */
function statusHref(
  searchParams: { [key: string]: string | string[] | undefined },
  status: "open" | "closed" | "all",
  cohort?: "earlier" | "new" | null
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "status" || (cohort !== undefined && key === "cohort")) continue;
    const v = firstParam(value);
    if (v) params.set(key, v);
  }
  params.set("status", status);
  if (cohort) params.set("cohort", cohort);
  return `?${params.toString()}#all-positions-table`;
}

export default async function PositionTrackingPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const status =
    firstParam(searchParams.status) === "closed"
      ? "closed"
      : firstParam(searchParams.status) === "all"
        ? "all"
        : "open";

  const cohortParam =
    firstParam(searchParams.cohort) === "earlier" || firstParam(searchParams.cohort) === "new"
      ? (firstParam(searchParams.cohort) as "earlier" | "new")
      : undefined;

  const filters: DashboardFilters = {
    department: parseListParam(searchParams.department),
    dateFrom: firstParam(searchParams.from) || undefined,
    dateTo: firstParam(searchParams.to) || undefined,
    search: firstParam(searchParams.q) || undefined,
    status,
    cohort: cohortParam,
  };

  // Start fetching the data at the same moment as the permission check rather
  // than after it — they do not depend on each other, so this saves a full
  // round trip to the database on every page load and filter change.
  const dataPromise = Promise.all([
    getDashboardOverview(filters),
    getLastSyncInfo(),
    getCurrentProfile().then((p) => (p?.role === "admin" ? listAllProfiles() : [])),
    // For "people hired" on the Closed card; the page still works without it.
    getEmployeesSnapshot().catch(() => null),
    // Positions an admin has marked hot (the flame).
    getHotPositionIds(),
  ]);
  dataPromise.catch(() => {}); // avoid an unhandled rejection if access is denied below

  const { allowed, profile } = await requireTabAccess("positions");
  if (!allowed) return <AccessRestricted />;

  const [overview, lastSync, pendingProfiles, peopleSnapshot, hotIds] = await dataPromise;
  const mostRejected = overview.mostRejectedPositions;

  const c = overview.cohorts;
  // People hired in the period = the Attrition tab's "New joiners". Falls back
  // to the position count if Qandle has no people loaded.
  const peopleHired =
    peopleSnapshot && peopleSnapshot.employees.length > 0
      ? countPeopleHired(peopleSnapshot.employees, { from: c.periodStart, to: c.periodEnd })
      : null;
  // The badge's front always shows this calendar month, whatever the filter.
  const todayIso = new Date().toISOString().slice(0, 10);
  const peopleHiredThisMonth =
    peopleSnapshot && peopleSnapshot.employees.length > 0
      ? countPeopleHired(peopleSnapshot.employees, { from: `${todayIso.slice(0, 7)}-01`, to: todayIso })
      : null;
  // In the default (no date range) case the period starts on the 1st of
  // the current month.
  const monthLabel = formatMonthYear(c.periodStart);
  const hasRange = c.isCustomRange;
  const dataFromLabel = c.dataFrom ? `Data from ${formatMonthYear(c.dataFrom)}` : "No dated positions yet";
  const cohortCaption = hasRange
    ? `${dataFromLabel} · Period ${formatDay(c.periodStart)} – ${formatDay(c.periodEnd)}`
    : dataFromLabel;
  // Plain-language row labels. "Created" always means the Role assigned on
  // date; the period is the current month, or the selected date range.
  const startDay = formatDayMonth(c.periodStart);
  const endDay = formatDayMonth(c.periodEnd);
  const createdInPeriod = hasRange ? `Created ${startDay} – ${endDay}` : "Created this month";
  const createdEarlier = `Created before ${startDay}`;
  // Closed and Open rows say what happened to the positions created in each group.
  const closedEarlier = `${createdEarlier}, closed`;
  const closedInPeriod = `${createdInPeriod}, closed`;
  const stillOpenEarlier = `${createdEarlier}, still open`;
  const stillOpenInPeriod = `${createdInPeriod}, still open`;

  // Data-quality notes, shown behind the flag icon rather than as page text.
  const dataNotes: string[] = [];
  if (c.closed.withoutCloseDate > 0) {
    dataNotes.push(
      `${c.closed.withoutCloseDate} closed ${c.closed.withoutCloseDate === 1 ? "position has" : "positions have"} no closing date in the sheet, so ${c.closed.withoutCloseDate === 1 ? "it counts" : "they count"} as closed in every period, including months before ${c.closed.withoutCloseDate === 1 ? "it" : "they"} actually closed.`
    );
  }
  if (c.otherStatuses.length > 0) {
    const otherTotal = c.otherStatuses.reduce((n, o) => n + o.count, 0);
    dataNotes.push(
      `Created also counts ${c.otherStatuses.map((o) => `${o.count} marked “${o.label}”`).join(", ")}, which ${otherTotal === 1 ? "is" : "are"} neither open nor closed.`
    );
  }

  // Open positions whose seats are all taken (joined or yet to join), and the rest.
  const coveredOpen = overview.openPositionsDetail.filter((p) => p.fullyCovered).length;
  const stillNeedPeople = overview.openPositionsDetail.length - coveredOpen;

  const oldestOpen = overview.oldestOpenPosition;
  const maxDayCount = Math.max(1, ...overview.interviewsByDayLast7Days);
  const pendingUsers = pendingProfiles.filter((p) => p.status === "pending");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-[#0e1b3d]">
          Welcome back, {profile.full_name ?? profile.email.split("@")[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Requisition status, pipeline, and interview activity across all positions.
        </p>
      </div>

      <Suspense fallback={<div className={`h-[76px] rounded-[22px] bg-white/40`} />}>
        <PositionFilters departments={overview.departments} suggestions={overview.searchSuggestions} />
      </Suspense>

      {/* --- Primary: open-positions tracking --- */}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CohortStatCard
          label="Created"
          scene={<CreatedScene />}
          value={c.created.total}
          caption={cohortCaption}
          href={statusHref(searchParams, "all", null)}
          rows={[
            { label: createdEarlier, value: c.created.carriedForward, href: statusHref(searchParams, "all", "earlier") },
            { label: createdInPeriod, value: c.created.newInPeriod, href: statusHref(searchParams, "all", "new") },
          ]}
        />
        <CohortStatCard
          label="Closed"
          scene={<ClosedScene />}
          value={c.closed.total}
          badge={
            peopleHired !== null && peopleHiredThisMonth !== null
              ? {
                  // Front: hired this calendar month.
                  value: peopleHiredThisMonth,
                  label: "hired this month",
                  // Back: hired between the period's From and To dates.
                  back: {
                    value: peopleHired,
                    // Short dates ("1 Jan – 17 Oct"; years only when they differ)
                    // so the badge stays small.
                    from: shortDate(c.periodStart, c.periodStart.slice(0, 4) !== c.periodEnd.slice(0, 4)),
                    to: shortDate(c.periodEnd, c.periodStart.slice(0, 4) !== c.periodEnd.slice(0, 4)),
                  },
                }
              : undefined
          }
          caption={cohortCaption}
          href={statusHref(searchParams, "closed", null)}
          rows={[
            { label: closedEarlier, value: c.closed.carriedForward, href: statusHref(searchParams, "closed", "earlier") },
            { label: closedInPeriod, value: c.closed.newInPeriod, href: statusHref(searchParams, "closed", "new") },
          ]}
        />
        <CohortStatCard
          label="Open"
          scene={<OpenScene />}
          value={c.open.total}
          valueClassName="text-brand-blue"
          caption={cohortCaption}
          href={statusHref(searchParams, "open", null)}
          rows={[
            { label: stillOpenEarlier, value: c.open.carriedForward, href: statusHref(searchParams, "open", "earlier") },
            { label: stillOpenInPeriod, value: c.open.newInPeriod, href: statusHref(searchParams, "open", "new") },
            // Of the open positions: all seats are taken (joined or yet to join), vs still hiring.
            { label: "Hired, yet to join", value: coveredOpen },
            { label: "Open (excluding yet to join)", value: stillNeedPeople },
          ]}
        />
      </div>

      <div className="-mt-4 flex items-start justify-between gap-3">
        <details className="min-w-0 flex-1 text-xs text-slate-500">
          <summary className="cursor-pointer font-semibold text-brand-blue">
            How to read these numbers
          </summary>
          <div className="mt-2 max-w-3xl space-y-1.5 leading-relaxed">
            <p>
              A position counts as <strong>created</strong> on its &quot;Role assigned on&quot; date.
              The period is {hasRange ? "the date range you selected" : "the current month"} (
              {formatDayMonth(c.periodStart)} to {formatDayMonth(c.periodEnd)}).
            </p>
            <p>
              <strong>Created</strong> is every position created up to the end of the period, split into those
              created before {formatDayMonth(c.periodStart)} and those created inside the period.
            </p>
            <p>
              A position is open from its &quot;Role assigned on&quot; date until its &quot;Date closed&quot;.{" "}
              Both cards show the position as it stood on the last day of the period.{" "}
              <strong>Closed</strong> counts every position closed by then, from the start of the data.{" "}
              <strong>Open</strong> counts positions created by then and not yet closed. Each is split by when the
              position was created: before {formatDayMonth(c.periodStart)}, or inside the period. So Closed + Open
              (+ any on hold or cancelled) = Created.
            </p>
            {peopleHired !== null && (
              <p>
                <strong>People hired</strong> (the flipping badge on the Closed card) counts employees by their
                joining date in Qandle. One side shows this month; the other shows the selected From – To dates,
                the same as New joiners on the Attrition tab. Click the badge to flip it. One position can
                have several seats, and some people join without a position here, so it will not always equal the
                positions closed.
              </p>
            )}
          </div>
        </details>
        <DataNotesFlag notes={dataNotes} />
      </div>

      <OpenPositionsTracker
        hotIds={hotIds}
        canMarkHot={canMarkHotPositions(profile)}
        positions={overview.openPositionsDetail}
        startLabel={startDay}
        periodLabel={hasRange ? `${formatDay(c.periodStart)} – ${formatDay(c.periodEnd)}` : monthLabel}
        newWord={hasRange ? "In range" : "This month"}
      />

      {/* --- Secondary: everything else --- */}

      <div className="flex items-center gap-3 pt-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">More metrics</h2>
        <div className="h-px flex-1 bg-slate-200/70" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <PeriodStatCard label="Year to date" stats={overview.ytd} />
        <PeriodStatCard label="Month to date" stats={overview.mtd} />
      </div>

      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
          profile.role === "admin" ? "lg:grid-cols-4" : "lg:grid-cols-2"
        }`}
      >
        {oldestOpen ? (
          <Link
            href={`/dashboard/positions/${oldestOpen.id}`}
            className="relative min-h-[200px] overflow-hidden rounded-[22px] p-5 text-white shadow-[0_10px_30px_rgba(30,80,204,0.10)] transition hover:brightness-110"
            style={{ background: "linear-gradient(150deg, #1e50cc, #0e1b3d)" }}
          >
            <div className="text-[11px] font-bold uppercase tracking-wide text-white/75">
              Oldest open position
            </div>
            <div className="mt-1.5 text-4xl font-extrabold">
              {oldestOpen.aging_days ?? "—"}
              <span className="text-lg font-bold">d</span>
            </div>
            <div className="mt-2.5 text-sm font-bold">
              {oldestOpen.position_title ?? oldestOpen.position_id ?? "Untitled"}
            </div>
            <div className="text-xs text-white/80">
              {oldestOpen.position_id ?? "No job code"} · Assigned to{" "}
              {oldestOpen.assigned_ta ?? "no one"}
            </div>
          </Link>
        ) : (
          <GlassCard className="flex min-h-[200px] items-center justify-center p-5 text-sm text-slate-400">
            No open positions match these filters
          </GlassCard>
        )}

        <GlassCard className="flex min-h-[200px] flex-col p-5">
          <span className="text-sm font-bold text-[#0e1b3d]">Pipeline this week</span>
          <div className="mt-1 text-2xl font-extrabold text-[#0e1b3d]">
            {overview.interviewedLast7Days}{" "}
            <span className="text-xs font-semibold text-slate-500">interviewed</span>
          </div>
          <div className="mt-4 flex flex-grow items-end gap-2">
            {overview.interviewsByDayLast7Days.map((count, i) => (
              <div
                key={i}
                className="w-full rounded-md bg-brand-blue"
                style={{
                  height: `${Math.max(6, (count / maxDayCount) * 100)}%`,
                  opacity: count === maxDayCount && count > 0 ? 1 : 0.3,
                }}
                title={`${count} interviewed`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-semibold text-slate-400">
            {DAY_LABELS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
        </GlassCard>

        {/* Sync status is an admin concern; other roles never see it. */}
        {profile.role === "admin" && (
        <GlassCard className="flex min-h-[200px] flex-col items-center justify-center p-5">
          <span className="self-start text-sm font-bold text-[#0e1b3d]">Last sync</span>
          <div
            className="relative mt-2 flex h-28 w-28 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(#1e50cc ${lastSync ? 78 : 0}%, rgba(30,80,204,0.14) 0)`,
            }}
          >
            <div className="flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-white/85">
              <div className="text-base font-extrabold text-[#0e1b3d]">
                {timeAgo(lastSync?.finished_at ?? null)}
              </div>
              <div className="text-[10px] font-semibold text-slate-400">
                {lastSync?.rows_synced ?? 0} rows
              </div>
            </div>
          </div>
          <Link
            href="/admin"
            className="mt-3 rounded-full bg-brand-blue px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-blue-dark"
          >
            Sync now
          </Link>
        </GlassCard>
        )}

        {profile.role === "admin" && (
          <div className="min-h-[200px] rounded-[22px] bg-[#0e1b3d] p-5 text-white">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold">Pending approvals</span>
              <span className="text-xs font-bold text-[#9db4ec]">{pendingUsers.length}</span>
            </div>
            <div className="mt-3 flex flex-col gap-0.5">
              {pendingUsers.slice(0, 3).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between border-b border-white/10 py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold">{u.full_name ?? u.email}</div>
                    <div className="text-[10px] text-[#8b96b8]">
                      Requested {new Date(u.requested_at).toLocaleDateString("en-IN")}
                    </div>
                  </div>
                </div>
              ))}
              {pendingUsers.length === 0 && (
                <p className="py-2 text-xs text-[#8b96b8]">Nothing waiting on you.</p>
              )}
            </div>
            <Link
              href="/admin"
              className="mt-3 block rounded-full bg-white/10 py-2 text-center text-xs font-bold hover:bg-white/15"
            >
              Review all in Admin
            </Link>
          </div>
        )}
      </div>

      {/* Two columns: the two smaller blocks stacked on the left, the wide
          source table on the right, so neither side leaves a big empty gap. */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
        <div>
          <h2 className="text-sm font-bold text-[#0e1b3d]">Offer acceptance rate</h2>
          <GlassCard className="mt-3 flex items-center gap-4 px-5 py-4">
            <div className="text-3xl font-extrabold text-[#0e1b3d]">
              {overview.offerAcceptanceRate !== null ? (
                `${Math.round(overview.offerAcceptanceRate * 100)}%`
              ) : (
                <FieldValue value={null} />
              )}
            </div>
            <div className="border-l border-slate-200/70 pl-4 text-xs leading-relaxed text-slate-500">
              Share of offers that were not dropped (joiner-tracker rows not marked &quot;Drop&quot;).
              <div className="text-slate-400">
                Based on {overview.offerAcceptanceSampleSize} joiner-tracker rows with a status
              </div>
            </div>
          </GlassCard>
        </div>

        <div>
          <h2 className="text-sm font-bold text-[#0e1b3d]">Avg time-to-fill by seniority</h2>
          <p className="mt-1 text-xs text-slate-500">
            Days from role assignment to closing, for closed roles only.
          </p>
          <GlassCard className="mt-3 divide-y divide-slate-200/60">
            {overview.avgTimeToFillBySeniority.map((row) => (
              <div key={row.seniority} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold text-[#0e1b3d]">{row.seniority}</span>
                <span className="text-sm text-slate-600">
                  {row.avgDays !== null ? (
                    <>
                      {row.avgDays}d{" "}
                      <span className="text-xs text-slate-400">
                        ({row.sampleSize} closed)
                      </span>
                    </>
                  ) : (
                    <FieldValue value={null} />
                  )}
                </span>
              </div>
            ))}
          </GlassCard>
        </div>

        </div>

        <div className="min-w-0 lg:col-span-3">
          <h2 className="text-sm font-bold text-[#0e1b3d]">Interviews per hire by source</h2>
          <p className="mt-1 text-xs text-slate-500">
            {overview.interviewSourceDataAvailable ? (
              <>
                <strong className="text-[#0e1b3d]">Interviews per hire</strong> = how many interviews it takes, on
                average, to hire one person from that source (interviews ÷ hires). Lower is better: 2.0 means about 2
                interviews for every person hired. Interviews and hires are counted separately for each source.
              </>
            ) : (
              "The Daily Candidate Feedback sheet doesn't record a Source per interview, so only hires by source can be shown below."
            )}
          </p>
          <ScrollTable outerClassName="mt-3" className={GLASS_PANEL}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="sticky left-0 z-[2] bg-[#f3f7fd] px-4 py-2.5">Source</th>
                  <th className="px-4 py-2.5">Interviews</th>
                  <th className="px-4 py-2.5">Hires</th>
                  <th className="px-4 py-2.5" title="Interviews ÷ hires. Lower is better.">
                    Interviews per hire
                  </th>
                </tr>
              </thead>
              <tbody>
                {overview.interviewsPerHireBySource
                  .filter((row) => overview.interviewSourceDataAvailable || row.hires > 0)
                  .map((row) => (
                    <tr key={row.source} className="border-b border-slate-200/50 last:border-0">
                      <td className="sticky left-0 z-[1] min-w-[9rem] max-w-[12rem] bg-[#f5f8fe] shadow-[1px_0_0_rgba(148,163,184,0.25)] sm:max-w-none px-4 py-2.5 font-semibold text-[#0e1b3d]">{row.source}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {overview.interviewSourceDataAvailable ? row.interviews : <FieldValue value={null} />}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{row.hires}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {!overview.interviewSourceDataAvailable ? (
                          <FieldValue value={null} />
                        ) : row.perHire !== null && row.interviews === 0 ? (
                          <span
                            title="Hires are recorded for this source, but no interviews carry this source name, so the ratio can't be worked out"
                            className="whitespace-nowrap rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-brand-blue-dark"
                          >
                            No interviews recorded
                          </span>
                        ) : row.perHire !== null ? (
                          <span className="font-semibold text-[#0e1b3d]">
                            {row.perHire.toFixed(1)}
                            <span className="ml-1 text-xs font-normal text-slate-400">interviews</span>
                          </span>
                        ) : (
                          <span
                            title={`${row.interviews} ${row.interviews === 1 ? "interview" : "interviews"} so far, but nobody from this source has been hired yet`}
                            className="whitespace-nowrap rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-brand-blue-dark"
                          >
                            No hires yet
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                {overview.interviewsPerHireBySource.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                      No data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollTable>
        </div>
      </div>

      <div id="all-positions-table" className="scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#0e1b3d]">
              {status === "closed"
                ? "Closed positions"
                : status === "all"
                  ? "All positions"
                  : "Open positions"}
            </h2>
            <p className="text-xs text-slate-500">
              Browse and search every position, including closed ones.
            </p>
            {cohortParam && (
              <p className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-blue-dark">
                <span>
                  Only positions {cohortParam === "earlier" ? `created before ${startDay}` : createdInPeriod.replace(/^Created/, "created")}
                </span>
                <Link
                  href={statusHref(searchParams, status, null)}
                  className="font-bold text-brand-blue underline underline-offset-2"
                >
                  Show all
                </Link>
              </p>
            )}
          </div>
          <div className="flex gap-1 rounded-full bg-white/60 p-1 text-xs font-bold">
            {(["open", "closed", "all"] as const).map((s) => (
              <Link
                key={s}
                href={statusHref(searchParams, s)}
                className={`rounded-full px-3 py-1 capitalize ${
                  status === s ? "bg-brand-blue text-white" : "text-slate-500 hover:bg-white"
                }`}
              >
                {s}
              </Link>
            ))}
          </div>
        </div>
        <ScrollTable outerClassName="mt-3" className={`${GLASS_PANEL} max-h-[70vh]`}>
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-[#f3f7fd] text-xs uppercase tracking-wide text-slate-500 shadow-[0_1px_0_rgba(148,163,184,0.35)]">
              <tr>
                <th className="sticky left-0 z-[2] bg-[#f3f7fd] px-4 py-3">Position</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">New/Repl.</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Seniority</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Assigned TA</th>
                <th className="px-4 py-3">Assigned on</th>
                <th className="px-4 py-3">Timeline</th>
              </tr>
            </thead>
            <tbody>
              {overview.positions.map((p) => {
                const assignedDate = formatDate(p.role_assigned_on);
                const isClosed = p.open_closed === "Closed";
                return (
                  <tr key={p.id} className="border-b border-slate-200/50 last:border-0 hover:bg-white/40">
                    <td className="sticky left-0 z-[1] min-w-[9rem] max-w-[12rem] bg-[#f5f8fe] shadow-[1px_0_0_rgba(148,163,184,0.25)] sm:max-w-none px-4 py-3">
                      <Link
                        href={`/dashboard/positions/${p.id}`}
                        prefetch={false}
                        className="font-semibold text-[#0e1b3d] hover:underline"
                      >
                        {p.position_title ?? p.position_id ?? "Untitled"}
                      </Link>
                      {p.position_id && (
                        <div className="text-xs text-slate-400">{p.position_id}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          isClosed ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-brand-blue"
                        }`}
                      >
                        <FieldValue value={p.open_closed} />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <FieldValue value={p.department} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <FieldValue value={p.new_or_replacement} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <FieldValue value={p.state} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <FieldValue value={p.seniority} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <FieldValue value={p.priority} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <FieldValue value={p.assigned_ta} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <FieldValue value={assignedDate} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {isClosed ? (
                        p.date_closed && p.role_assigned_on ? (
                          `${daysBetweenIso(p.role_assigned_on, p.date_closed)}d to fill`
                        ) : (
                          <FieldValue value={null} />
                        )
                      ) : p.aging_days !== null ? (
                        `${p.aging_days}d pending`
                      ) : (
                        <FieldValue value={null} />
                      )}
                    </td>
                  </tr>
                );
              })}
              {overview.positions.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    No {status === "all" ? "" : status} positions match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollTable>
      </div>

      <div>
        <h2 className="text-sm font-bold text-[#0e1b3d]">Most rejected positions</h2>
        <p className="mt-1 text-sm text-slate-500">
          All-time, unfiltered — positions with the highest candidate rejection
          counts, and their most common rejection reason.
        </p>
        <ScrollTable outerClassName="mt-3" className={GLASS_PANEL}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Rejections</th>
                <th className="px-4 py-3">Top reason</th>
              </tr>
            </thead>
            <tbody>
              {mostRejected.rows.map((r) => (
                <tr key={r.position_id} className="border-b border-slate-200/50 last:border-0 hover:bg-white/40">
                  <td className="px-4 py-3 font-semibold text-[#0e1b3d]">
                    {r.id ? (
                      <Link href={`/dashboard/positions/${r.id}`} prefetch={false} className="hover:underline">
                        {r.position_title ?? r.position_id}
                      </Link>
                    ) : (
                      r.position_title ?? r.position_id
                    )}
                    <div className="text-xs text-slate-400">{r.position_id}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.rejection_count}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <FieldValue value={r.top_reason} />
                  </td>
                </tr>
              ))}
              {mostRejected.rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                    No rejections recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollTable>
        {mostRejected.unlinkedCount > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            {mostRejected.unlinkedCount} further rejection
            {mostRejected.unlinkedCount === 1 ? "" : "s"} couldn&apos;t be linked to a
            position (missing Position ID in the sheet) and aren&apos;t included above.
          </p>
        )}
      </div>
    </div>
  );
}
