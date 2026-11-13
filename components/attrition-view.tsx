import Link from "next/link";
import { requireTabAccess } from "@/lib/auth/guards";
import AccessRestricted from "@/components/access-restricted";
import GlassCard, { GLASS_PANEL } from "@/components/glass-card";
import { getEmployeesSnapshot, getExitEmployees } from "@/lib/metrics/attrition";
import { buildAttritionAnalysis } from "@/lib/metrics/attrition-analysis";
import { branchSalesByState } from "@/lib/metrics/attrition-state";
import { SMALL_GROUP_AVERAGE_STAFF } from "@/lib/metrics/attrition-format";
import {
  PEOPLE_GROUPS,
  codeKey,
  parseGroup,
  scopeToGroup,
  type PeopleGroup,
} from "@/lib/metrics/attrition-scope";
import AttritionAnalysisPanel from "@/components/attrition-analysis";
import AttritionPeopleList from "@/components/attrition-people-list";
import DataNotesFlag from "@/components/data-notes-flag";
import { addDays, computeAttrition } from "@/lib/metrics/attrition-calc";
import { buildQuickRanges } from "@/lib/date-ranges";
import { countText, pctText } from "@/lib/metrics/attrition-format";
import AttritionBreakdownTable from "@/components/attrition-breakdown-table";
import AttritionInfographics, { type InfographicFilter } from "@/components/attrition-infographics";
import type { AttritionRow } from "@/lib/metrics/attrition-calc";

const FIELD_CLASS =
  "rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm text-[#0e1b3d] outline-none focus:border-brand-blue";
const LABEL_CLASS = "text-[10px] font-bold uppercase tracking-wide text-slate-500";
const INFANT_OPTIONS = [30, 60, 90, 180];

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

function SummaryCard({
  label,
  value,
  lines,
}: {
  label: string;
  value: string;
  lines: string[];
}) {
  return (
    <div className={`${GLASS_PANEL} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-[#0e1b3d]">{value}</p>
      <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">
        {lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
    </div>
  );
}

/**
 * The whole Attrition screen, shared by two tabs: the Attrition tab (breakdown
 * tables) and the Attrition Insights staging tab (the same page with the
 * summary cards and tables swapped for infographics with quick filters).
 */
export default async function AttritionView({
  searchParams,
  basePath,
  tabKey,
  variant,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
  /** This tab's URL, e.g. "/dashboard/attrition". */
  basePath: string;
  tabKey: string;
  variant: "tables" | "infographics";
}) {
  const infographics = variant === "infographics";
  // Fetch the people data at the same time as the permission check (independent).
  const snapshotPromise = getEmployeesSnapshot();
  snapshotPromise.catch(() => {});
  const exitsPromise = getExitEmployees();
  exitsPromise.catch(() => {});

  const { allowed } = await requireTabAccess(tabKey);
  if (!allowed) return <AccessRestricted />;

  const today = new Date().toISOString().slice(0, 10);
  const chosenTo = validDate(firstParam(searchParams.to));
  const chosenFrom = validDate(firstParam(searchParams.from));
  const datesChosen = !!(chosenTo || chosenFrom);
  let to = chosenTo ?? today;
  let from = chosenFrom ?? addDays(to, -364);
  if (from > to) [from, to] = [to, from];
  const infantParam = Number(firstParam(searchParams.infant));
  const infantDays = INFANT_OPTIONS.includes(infantParam) ? infantParam : 90;

  const presets = buildQuickRanges(today);

  // A department or age group opened from the tables below ("dept:Sales" / "age:25–29").
  const scopeParam = firstParam(searchParams.scope) ?? "";
  // "all" = everyone. Any scope opens the detail view (reasons + the list of
  // people) in place of the overview, so the overview stays short.
  const scope =
    scopeParam === "all"
      ? { kind: "all" as const, name: "" }
      : scopeParam.startsWith("dept:")
        ? { kind: "dept" as const, name: scopeParam.slice(5) }
        : scopeParam.startsWith("age:")
          ? { kind: "age" as const, name: scopeParam.slice(4) }
          : scopeParam.startsWith("state:")
            ? { kind: "state" as const, name: scopeParam.slice(6) }
            : null;
  // Employees, interns and consultants are shown separately (never mixed).
  const group = parseGroup(firstParam(searchParams.group));
  const groupLabel = PEOPLE_GROUPS.find((g) => g.key === group)!.label;
  // Links keep the chosen dates, infant window and group.
  const dateParams = datesChosen ? `from=${from}&to=${to}&` : "";
  const groupParam = group === "employees" ? "" : `group=${group}&`;
  const baseHref = `${basePath}?${dateParams}${groupParam}${`infant=${infantDays}`}`;
  const groupHref = (g: PeopleGroup) =>
    `${basePath}?${dateParams}${g === "employees" ? "" : `group=${g}&`}infant=${infantDays}`;

  const snapshot = await snapshotPromise;
  const notConnected = snapshot.mode === "live" && snapshot.employees.length === 0;

  const exits = await exitsPromise;

  // Only the chosen group (Company employees, interns or consultants); other
  // companies such as White Projects are left out. Everything below uses this set.
  const entity = scopeToGroup(snapshot.employees, group, new Set(exits.map((x) => codeKey(x.emp_code))), { from, to });

  const result = notConnected ? null : computeAttrition(entity.employees, { from, to, infantDays }, today);

  // Branch Sales split by state: the same maths, with each person's state in
  // place of their department.
  const stateEmployees = branchSalesByState(entity.employees);
  const stateResult = notConnected ? null : computeAttrition(stateEmployees, { from, to, infantDays }, today);

  // For the infographics: the age groups of every department and state, so the
  // quick filters can switch instantly without another trip to the server.
  const ageByDept: Record<string, AttritionRow[]> = {};
  const ageByState: Record<string, AttritionRow[]> = {};
  if (infographics && result && stateResult) {
    for (const d of result.byDepartment) {
      ageByDept[d.label] = computeAttrition(entity.employees, { from, to, infantDays }, today, { department: d.label }).byAgeGroup;
    }
    for (const st of stateResult.byDepartment) {
      ageByState[st.label] = computeAttrition(stateEmployees, { from, to, infantDays }, today, { department: st.label }).byAgeGroup;
    }
  }
  const initialFilter: InfographicFilter =
    scope?.kind === "dept"
      ? { kind: "dept", name: scope.name }
      : scope?.kind === "state"
        ? { kind: "state", name: scope.name }
        : { kind: "all" };

  const scoped =
    result && scope && scope.kind !== "all"
      ? scope.kind === "state"
        ? computeAttrition(stateEmployees, { from, to, infantDays }, today, { department: scope.name })
        : computeAttrition(
            entity.employees,
            { from, to, infantDays },
            today,
            scope.kind === "dept" ? { department: scope.name } : { ageGroup: scope.name }
          )
      : result;
  const analysis = scoped ? buildAttritionAnalysis(scoped.overall, scoped.leavers, exits) : null;

  // Links: the analysis lives on this page ("More analysis"); the list of who
  // left is its own view (view=people), optionally narrowed to one reason.
  const viewPeople = firstParam(searchParams.view) === "people";
  const reasonParam = firstParam(searchParams.reason) ?? null;
  const scopeIsSpecific = !!scope && scope.kind !== "all";
  const scopeKey = scope && scope.kind !== "all" ? `${scope.kind}:${scope.name}` : "all";
  const scopeLabel =
    !scope || scope.kind === "all"
      ? "Everyone"
      : scope.kind === "dept"
        ? `Department: ${scope.name}`
        : scope.kind === "age"
          ? `Age group: ${scope.name}`
          : `Branch Sales · ${scope.name}`;
  const scopeQuery = `${baseHref}&scope=${encodeURIComponent(scopeKey)}`;
  const peopleHref = `${scopeQuery}&view=people`;
  const reasonHref = (reason: string) => `${peopleHref}&reason=${encodeURIComponent(reason)}`;

  const q = result?.quality;
  const flags: string[] = [];
  if (entity.otherCount > 0) {
    flags.push(
      `${entity.otherCount} ${entity.otherCount === 1 ? "person in Qandle has" : "people in Qandle have"} an Emp code that is not The company (for example White Projects, "WP…"), so ${entity.otherCount === 1 ? "they are" : "they are"} left out of every view.`
    );
  }
  if (entity.exitSheetLoaded && entity.missingFromExitSheet.length > 0) {
    const missing = entity.missingFromExitSheet;
    const shown = missing.slice(0, 8).map((m) => m.code).join(", ");
    flags.push(
      `${missing.length} ${groupLabel.toLowerCase()} ${missing.length === 1 ? "has" : "have"} a leaving date in Qandle in this period but ${missing.length === 1 ? "is" : "are"} not in the exit sheet, so ${missing.length === 1 ? "has" : "have"} no reason on record: ${shown}${missing.length > 8 ? ", …" : ""}.`
    );
  }
  if (q && q.withRelievingDate === 0) {
    flags.push(
      "Check this: nobody in the data has a leaving date, so attrition shows as 0%. Either nobody has left, or Qandle only lists people who still work here. Please check with your Qandle contact before trusting these numbers."
    );
  }
  if (q && q.missingDateOfBirth > 0) {
    flags.push(
      `${q.missingDateOfBirth} ${q.missingDateOfBirth === 1 ? "person has" : "people have"} no date of birth, so they appear under "Age not recorded".`
    );
  }
  if (q && q.missingDepartment > 0) {
    flags.push(
      `${q.missingDepartment} ${q.missingDepartment === 1 ? "person has" : "people have"} no department, so they appear under "Department not set".`
    );
  }
  if (q && q.leaversWithoutJoinDate > 0) {
    flags.push(
      `${q.leaversWithoutJoinDate} ${q.leaversWithoutJoinDate === 1 ? "person who left has" : "people who left have"} no joining date, so we can't tell if they left early.`
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold text-[#0e1b3d]">
          {infographics ? "Attrition Insights" : "Attrition"}
          {infographics && (
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-brand-blue">
              Staging
            </span>
          )}
        </h1>
        <p className="text-sm text-slate-500">
          How many people left, and how many of them left soon after joining (infant attrition). Shown for everyone, then by
          department and by age group. Data comes from Qandle.
          {infographics && " This is the same Attrition page, drawn as infographics with quick filters."}
        </p>
      </div>

      {notConnected ? (
        <GlassCard className="space-y-2 p-6 text-sm text-slate-600">
          <p className="font-bold text-[#0e1b3d]">No employee data yet</p>
          {snapshot.qandleConfigured ? (
            <p>
              Qandle is connected, but no data about people has been loaded yet. An admin needs to click{" "}
              <Link href="/admin" className="font-semibold text-brand-blue underline">
                Sync now
              </Link>{" "}
              in the Admin panel.
            </p>
          ) : (
            <p>
              Qandle isn&apos;t connected yet. Ask HR or Qandle for a client ID and secret, add them as{" "}
              <code>QANDLE_CLIENT_ID</code> and <code>QANDLE_CLIENT_SECRET</code> in the server settings,
              then click Sync now in the Admin panel.
            </p>
          )}
        </GlassCard>
      ) : (
        result &&
        analysis &&
        (viewPeople ? (
          <>
            <Link
              href={scopeIsSpecific ? `${scopeQuery}#more-analysis` : baseHref}
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/70 px-4 py-1.5 text-xs font-bold text-brand-blue hover:bg-white"
            >
              <span aria-hidden="true">←</span> Back to attrition
            </Link>
            <section className={`${GLASS_PANEL} space-y-4 p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">People who left</p>
                  <h2 className="mt-0.5 text-lg font-extrabold text-[#0e1b3d]">{scopeLabel}</h2>
                  <p className="text-xs text-slate-500">
                    {analysis.leavers.length} {analysis.leavers.length === 1 ? "person" : "people"} left between{" "}
                    {formatDay(from)} and {formatDay(to)}.
                  </p>
                </div>
                <Link
                  href={`${scopeQuery}#more-analysis`}
                  className="rounded-full bg-white/70 px-4 py-1.5 text-xs font-bold text-brand-blue hover:bg-white"
                >
                  See the analysis →
                </Link>
              </div>
              <AttritionPeopleList leavers={analysis.leavers} initialReason={reasonParam} />
            </section>
          </>
        ) : (
          <>
            <div className="flex w-fit flex-wrap gap-1 rounded-full bg-white/60 p-1 text-xs font-bold">
              {PEOPLE_GROUPS.map((g) => (
                <Link
                  key={g.key}
                  href={groupHref(g.key)}
                  aria-current={group === g.key ? "page" : undefined}
                  className={`rounded-full px-4 py-1.5 ${
                    group === g.key ? "bg-brand-blue text-white" : "text-slate-500 hover:bg-white"
                  }`}
                >
                  {g.label}
                  <span className={`ml-1.5 font-normal ${group === g.key ? "text-white/80" : "text-slate-400"}`}>
                    {entity.groupSizes[g.key]}
                  </span>
                </Link>
              ))}
            </div>

            <form method="get" className={`${GLASS_PANEL} flex flex-wrap items-end gap-3 p-4`}>
              {group !== "employees" && <input type="hidden" name="group" value={group} />}
              <div className="flex flex-col gap-1">
                <label className={LABEL_CLASS} htmlFor="from">
                  From
                </label>
                <input id="from" name="from" type="date" defaultValue={chosenFrom ?? ""} className={FIELD_CLASS} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={LABEL_CLASS} htmlFor="to">
                  To
                </label>
                <input id="to" name="to" type="date" defaultValue={chosenTo ?? ""} className={FIELD_CLASS} />
              </div>
              <div className="flex flex-col gap-1">
                <select
                  id="infant"
                  name="infant"
                  aria-label="Infant attrition window"
                  defaultValue={String(infantDays)}
                  className={FIELD_CLASS}
                >
                  {INFANT_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      Infant: {d} days
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="rounded-full bg-brand-blue px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-blue-dark"
              >
                Apply
              </button>
            </form>

            <div className="-mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Quick ranges:</span>
              {presets.map((p) => {
                const active = datesChosen ? from === p.from && to === p.to : p.label === "Last 12 months";
                return (
                  <Link
                    key={p.label}
                    href={`${basePath}?from=${p.from}&to=${p.to}&${groupParam}infant=${infantDays}`}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      active ? "bg-brand-blue text-white" : "bg-white/70 text-slate-500 hover:bg-white"
                    }`}
                  >
                    {p.label}
                  </Link>
                );
              })}
              {datesChosen && (
                <Link
                  href={group === "employees" ? basePath : `${basePath}?group=${group}`}
                  className="rounded-full px-3 py-1 text-xs font-bold text-slate-400 hover:text-brand-blue"
                >
                  Clear dates
                </Link>
              )}
            </div>

            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-slate-400">
                {datesChosen ? "Showing" : "No dates chosen, so this shows the last 12 months:"}{" "}
                {formatDay(from)} to {formatDay(to)}
                {snapshot.syncedAt ? ` · People data last updated ${formatDay(snapshot.syncedAt.slice(0, 10))}` : ""}
              </p>
              {/* Data-quality notes (missing birth dates, departments...) sit behind the flag. */}
              <DataNotesFlag notes={flags} />
            </div>

            {infographics && stateResult && (
              <AttritionInfographics
                infantDays={infantDays}
                baseHref={baseHref}
                overall={result.overall}
                departments={result.byDepartment}
                states={stateResult.byDepartment}
                ages={result.byAgeGroup}
                ageByDept={ageByDept}
                ageByState={ageByState}
                initial={initialFilter}
              />
            )}

            {!infographics && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard
                label="Attrition"
                value={pctText(result.overall.attritionPct)}
                lines={[
                  `${result.overall.leavers} ${result.overall.leavers === 1 ? "person" : "people"} left`,
                  `Out of ${countText(result.overall.averageHeadcount)} people on average`,
                ]}
              />
              <SummaryCard
                label="Infant attrition"
                value={pctText(result.overall.infantPctOfJoiners)}
                lines={[
                  `${result.overall.infantLeavers} ${result.overall.infantLeavers === 1 ? "person" : "people"} left within ${infantDays} days of joining`,
                  `Out of ${result.overall.joiners} new joiners`,
                ]}
              />
              <SummaryCard
                label="New joiners"
                value={String(result.overall.joiners)}
                lines={["People who joined in this period"]}
              />
              <SummaryCard
                label="People now"
                value={String(result.overall.headcountEnd)}
                lines={[`${result.overall.headcountStart} at the start of the period`]}
              />
            </div>
            )}

            <details id="more-analysis" open={scopeIsSpecific} className="group scroll-mt-6">
              <summary className="more-analysis-btn flex w-full cursor-pointer list-none items-center justify-between gap-4 rounded-2xl bg-brand-blue px-5 py-4 text-white transition hover:bg-brand-blue-dark sm:px-6 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                    <svg
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-base font-extrabold sm:text-lg">More analysis</span>
                    <span className="block text-xs font-medium text-white/80">
                      {scopeIsSpecific ? scopeLabel : "Why people left, how long they stayed and more"}
                    </span>
                  </span>
                </span>
                <span className="more-analysis-chevron flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-blue">
                  <svg
                    viewBox="0 0 20 20"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="transition-transform duration-300 group-open:rotate-180"
                  >
                    <path d="M5 8l5 5 5-5" />
                  </svg>
                </span>
              </summary>
              <div className="more-analysis-body mt-3">
                <AttritionAnalysisPanel
                  scopeLabel={scopeLabel}
                  scoped={scopeIsSpecific}
                  everyoneHref={`${baseHref}&scope=all#more-analysis`}
                  peopleHref={peopleHref}
                  reasonHref={reasonHref}
                  periodText={`People who left between ${formatDay(from)} and ${formatDay(to)}.`}
                  infantDays={infantDays}
                  analysis={analysis}
                  exitDataLoaded={exits.length > 0}
                />
              </div>
            </details>

            {!infographics && (
            <>
            <AttritionBreakdownTable
              title="By department"
              firstColumn="Department"
              filterPlaceholder="Filter departments"
              rows={result.byDepartment}
              infantDays={infantDays}
              scopeKind="dept"
              baseHref={baseHref}
              selected={scope?.kind === "dept" ? scope.name : null}
            />
            {stateResult && stateResult.byDepartment.length > 0 && (
              <AttritionBreakdownTable
                title="Branch Sales by state"
                firstColumn="State"
                filterPlaceholder="Filter states"
                rows={stateResult.byDepartment}
                infantDays={infantDays}
                scopeKind="state"
                baseHref={baseHref}
                selected={scope?.kind === "state" ? scope.name : null}
              />
            )}
            <AttritionBreakdownTable
              title="By age group"
              firstColumn="Age group"
              filterPlaceholder="Filter age groups"
              rows={result.byAgeGroup}
              infantDays={infantDays}
              scopeKind="age"
              baseHref={baseHref}
              selected={scope?.kind === "age" ? scope.name : null}
            />
            </>
            )}

            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer font-semibold text-brand-blue">
                What do these numbers mean?
              </summary>
              <div className="mt-2 max-w-3xl space-y-2 leading-relaxed">
                <p>
                  <strong>Left</strong> = people whose last working day falls in the period you picked.{" "}
                  <strong>People now</strong> = people who had joined and not yet left on a given day.
                </p>
                <p>
                  <strong>Attrition %</strong> = people who left ÷ average number of people × 100.
                  <br />
                  Average number of people = (people on the first day + people on the last day) ÷ 2.
                  <br />
                  Example: 5 people at the start, 7 at the end, 3 people left. The average is 6, so
                  attrition is 3 ÷ 6 = 50%.
                </p>
                <p>
                  This is for the dates you picked, not for a full year. A 3-month period will show roughly
                  a quarter of the yearly figure.
                </p>
                <p>
                  <strong>Infant attrition</strong> = people who left within {infantDays} days of
                  joining ÷ people who joined in the period × 100. In the tables,{" "}
                  <strong>% of all who left</strong> shows how many of the leavers left that early.
                </p>
                <p>
                  <strong>Age group</strong> = the person&apos;s age on the day they left (for leavers), the
                  day they joined (for joiners), or the first or last day of the period (for people still here).
                </p>
                <p>
                  A small group can show more than 100%. That happens when a few people leave from a group
                  that only has a handful of people, or when people join and leave within the same period.
                  Groups with fewer than {SMALL_GROUP_AVERAGE_STAFF} people on average are tagged <strong>Few people</strong>: their
                  percentage is greyed out because it swings a lot, so look at the number who left instead.
                  People who have not joined yet (status Pending) are not counted.
                </p>
              </div>
            </details>
          </>
        ))
      )}
    </div>
  );
}
