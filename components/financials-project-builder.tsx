"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MonthSelect, Num, input } from "@/components/financials-planner";
import ProjectInfographic, { PrintReport } from "@/components/financials-project-infographic";
import { downloadProjectExcel } from "@/components/financials-project-export";
import { GLASS_PANEL } from "@/components/glass-card";
import ScrollTable from "@/components/scroll-table";
import { moneyFull } from "@/lib/metrics/financials-format";
import type { ForecastResult } from "@/lib/metrics/financials-forecast";
import { buildProjectReport } from "@/lib/metrics/financials-project-report";
import {
  PROJECT_KINDS,
  newId,
  newLine,
  newOneOff,
  stateProjectName,
  withRollout,
  type PlanProject,
  type Rollout,
  type RolloutRole,
  type TemplateContext,
} from "@/lib/metrics/financials-projects";

type Patch = (change: (p: PlanProject) => PlanProject) => void;

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={`${GLASS_PANEL} space-y-3 p-4`}>
      <div>
        <h3 className="text-sm font-bold text-[#0e1b3d]">{title}</h3>
        {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

// -------------------------------------------------------------- the forms

/** One-time costs, for any project. */
function OneOffs({ project: p, patch, monthOptions }: { project: PlanProject; patch: Patch; monthOptions: { key: string; label: string }[] }) {
  const set = (id: string, change: Partial<PlanProject["oneOffs"][number]>) =>
    patch((x) => ({ ...x, oneOffs: x.oneOffs.map((o) => (o.id === id ? { ...o, ...change } : o)) }));
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">Other one-time costs</p>
      {p.oneOffs.length > 0 && (
        <ScrollTable>
          <table className="w-full min-w-[460px] text-left text-xs">
            <tbody>
              {p.oneOffs.map((o) => (
                <tr key={o.id}>
                  <td className="py-1 pr-2">
                    <input value={o.label} maxLength={80} onChange={(e) => set(o.id, { label: e.target.value })} className={`${input} w-44`} aria-label="What the cost is" />
                  </td>
                  <td className="py-1 pr-2">
                    <Num value={o.amount} onChange={(n) => set(o.id, { amount: n })} label="Amount in rupees" className="w-28" />
                  </td>
                  <td className="py-1 pr-2">
                    <MonthSelect value={o.monthKey} months={monthOptions} onChange={(key) => set(o.id, { monthKey: key })} label="Month it is paid" />
                  </td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      onClick={() => patch((x) => ({ ...x, oneOffs: x.oneOffs.filter((y) => y.id !== o.id) }))}
                      className="rounded-full px-2 py-1 text-[11px] font-bold text-slate-400 hover:bg-white hover:text-red-600"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
      )}
      <button
        type="button"
        onClick={() => patch((x) => ({ ...x, oneOffs: [...x.oneOffs, newOneOff(monthOptions.find((m) => m.key >= x.startKey)?.key ?? monthOptions[0].key)] }))}
        className="mt-1 rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-brand-blue hover:bg-white"
      >
        + Add a one-time cost
      </button>
    </div>
  );
}

/** The costs around the people, shared by every kind of project. */
function MoreOptions({ project: p, patch, monthOptions }: { project: PlanProject; patch: Patch; monthOptions: { key: string; label: string }[] }) {
  return (
    <details className={`${GLASS_PANEL} group p-4`}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-[#0e1b3d]">
        More options
        <span className="text-xs font-semibold text-brand-blue group-open:hidden">Show</span>
        <span className="hidden text-xs font-semibold text-brand-blue group-open:inline">Hide</span>
      </summary>
      <div className="mt-3 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Non-payroll, per person a month (₹)" hint="Meals, insurance and the like. Starts at the sheet's recent level.">
            <Num value={p.nonPayrollPerHead} onChange={(n) => patch((x) => ({ ...x, nonPayrollPerHead: n }))} label="Non-payroll cost per person a month" />
          </Field>
          <Field label="Cost to hire one person (₹)" hint="Agency fee, onboarding.">
            <Num value={p.hireCost} onChange={(n) => patch((x) => ({ ...x, hireCost: n }))} label="Cost to hire one person" />
          </Field>
          {p.rollout && (
            <Field label="Set-up cost per branch (₹)" hint="Paid in the month each branch opens: fit-out, signage, deposit.">
              <Num value={p.rollout.setupPerBranch} onChange={(n) => patch((x) => withRollout(x, { setupPerBranch: n }))} label="Set-up cost per branch" className="w-32" />
            </Field>
          )}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={p.payRise}
            onChange={(e) => patch((x) => ({ ...x, payRise: e.target.checked }))}
            className="h-4 w-4 accent-[#1e50cc]"
          />
          Pay rises with the forecast&apos;s pay rise
        </label>
        <OneOffs project={p} patch={patch} monthOptions={monthOptions} />
      </div>
    </details>
  );
}

/** The simple form for a state or a set of branches: how many, how fast, who staffs each. */
function RolloutForm({ project: p, patch, monthOptions, ctx }: { project: PlanProject; patch: Patch; monthOptions: { key: string; label: string }[]; ctx: TemplateContext }) {
  const ro = p.rollout as Rollout;
  const setRo = (change: Partial<Rollout>) => patch((x) => withRollout(x, change));
  const setRole = (id: string, change: Partial<RolloutRole>) =>
    patch((x) => withRollout(x, { roles: (x.rollout?.roles ?? []).map((r) => (r.id === id ? { ...r, ...change } : r)) }));
  const perBranch = ro.roles.reduce((a, r) => a + Math.max(0, Math.round(r.perBranch)), 0);
  const isState = p.kind === "state";

  return (
    <div className="space-y-4">
      <Section title={isState ? "The expansion" : "The branches"}>
        {isState ? (
          <Field label="State">
            <input
              value={ro.state}
              maxLength={60}
              placeholder="For example Maharashtra"
              aria-label="State"
              onChange={(e) => {
                const state = e.target.value;
                patch((x) => {
                  const auto = x.name === stateProjectName(x.rollout?.state ?? "");
                  const next = withRollout(x, { state });
                  return auto ? { ...next, name: stateProjectName(state) } : next;
                });
              }}
              className={`${input} w-full`}
            />
          </Field>
        ) : (
          <Field label="Project name">
            <input value={p.name} maxLength={80} onChange={(e) => patch((x) => ({ ...x, name: e.target.value }))} className={`${input} w-full`} aria-label="Project name" />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="How many branches">
            <Num value={ro.branches} onChange={(n) => setRo({ branches: Math.max(1, Math.round(n)) })} label="How many branches" className="w-full" />
          </Field>
          <Field label="Open them over (months)">
            <Num value={ro.months} onChange={(n) => setRo({ months: Math.max(1, Math.round(n)) })} label="Months to open them over" className="w-full" />
          </Field>
        </div>
        <Field label="First branches open in">
          <MonthSelect value={p.startKey} months={monthOptions} onChange={(key) => patch((x) => ({ ...x, startKey: key }))} label="First branches open in" />
        </Field>
        <p className="rounded-xl bg-white/70 px-3 py-2 text-xs text-slate-600">
          That is <b className="text-[#0e1b3d]">{ro.branches}</b> {ro.branches === 1 ? "branch" : "branches"} over{" "}
          <b className="text-[#0e1b3d]">{ro.months}</b> {ro.months === 1 ? "month" : "months"}, about{" "}
          <b className="text-[#0e1b3d]">{(ro.branches / Math.max(1, ro.months)).toFixed(ro.branches % ro.months === 0 ? 0 : 1)}</b> a month.
        </p>
      </Section>

      <Section
        title={`Who staffs each branch: ${perBranch} ${perBranch === 1 ? "person" : "people"}`}
        hint="BM is the Branch Manager, ABM the Assistant Branch Manager and BDE the Business Development Executive. Rename or change any of them."
      >
        <div className="space-y-2">
          {ro.roles.map((r) => (
            <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_64px_104px_auto] items-end gap-2">
              <Field label="Role">
                <input value={r.label} maxLength={40} onChange={(e) => setRole(r.id, { label: e.target.value })} className={`${input} w-full`} aria-label="Role" />
              </Field>
              <Field label="Each">
                <Num value={r.perBranch} onChange={(n) => setRole(r.id, { perBranch: Math.round(n) })} label={`${r.label} per branch`} className="w-full" />
              </Field>
              <Field label="Pay a month (₹)">
                <Num value={r.payPerHead} onChange={(n) => setRole(r.id, { payPerHead: n })} label={`${r.label} pay a month`} className="w-full" />
              </Field>
              <button
                type="button"
                disabled={ro.roles.length <= 1}
                aria-label={`Remove ${r.label}`}
                onClick={() => setRo({ roles: ro.roles.filter((x) => x.id !== r.id) })}
                className="mb-1 rounded-full px-2 py-1 text-[11px] font-bold text-slate-400 hover:bg-white hover:text-red-600 disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRo({ roles: [...ro.roles, { id: newId(), label: "Role", perBranch: 1, payPerHead: Math.round(ctx.branchPay) }] })}
          className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-brand-blue hover:bg-white"
        >
          + Add a role
        </button>
        <p className="text-[11px] text-slate-400">
          The sheet only has the average pay of branch staff, {moneyFull(ctx.branchPay)} a month, so each role starts there. Enter the real pay for each role.
        </p>
      </Section>
    </div>
  );
}

/** The form for a team or any project that is not a branch rollout: groups of people and when they join. */
function GroupsForm({ project: p, patch, monthOptions, ctx }: { project: PlanProject; patch: Patch; monthOptions: { key: string; label: string }[]; ctx: TemplateContext }) {
  const setLine = (id: string, change: Partial<PlanProject["lines"][number]>) =>
    patch((x) => ({ ...x, lines: x.lines.map((l) => (l.id === id ? { ...l, ...change } : l)) }));
  return (
    <div className="space-y-4">
      <Section title="The project">
        <Field label="Project name">
          <input value={p.name} maxLength={80} onChange={(e) => patch((x) => ({ ...x, name: e.target.value }))} className={`${input} w-full`} aria-label="Project name" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First people join in">
            <MonthSelect value={p.startKey} months={monthOptions} onChange={(key) => patch((x) => ({ ...x, startKey: key }))} label="First people join in" />
          </Field>
          <Field label="Branches opened">
            <Num value={p.branches} onChange={(n) => patch((x) => ({ ...x, branches: Math.round(n) }))} label="Branches opened" className="w-full" />
          </Field>
        </div>
      </Section>
      <Section title="Who joins" hint={`Typical pay a month: Branch ${moneyFull(ctx.branchPay)} · Sales Enablers ${moneyFull(ctx.salesPay)} · HO ${moneyFull(ctx.hoPay)}`}>
        <ScrollTable>
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                <th className="px-1 py-1.5">Group</th>
                <th className="px-1 py-1.5">People</th>
                <th className="px-1 py-1.5">Pay a month (₹)</th>
                <th className="px-1 py-1.5">Starts after (months)</th>
                <th className="px-1 py-1.5">Joins over (months)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {p.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-1 py-1">
                    <input value={l.label} maxLength={80} onChange={(e) => setLine(l.id, { label: e.target.value })} className={`${input} w-36`} aria-label="Group name" />
                  </td>
                  <td className="px-1 py-1">
                    <Num value={l.people} onChange={(n) => setLine(l.id, { people: Math.round(n) })} label="People" className="w-16" />
                  </td>
                  <td className="px-1 py-1">
                    <Num value={l.payPerHead} onChange={(n) => setLine(l.id, { payPerHead: n })} label="Pay a month" className="w-24" />
                  </td>
                  <td className="px-1 py-1">
                    <Num value={l.delayMonths} onChange={(n) => setLine(l.id, { delayMonths: Math.round(n) })} label="Months before they start" className="w-16" />
                  </td>
                  <td className="px-1 py-1">
                    <Num value={l.rampMonths} onChange={(n) => setLine(l.id, { rampMonths: Math.max(1, Math.round(n)) })} label="Months they join over" className="w-16" />
                  </td>
                  <td className="px-1 py-1 text-right">
                    <button
                      type="button"
                      aria-label={`Remove ${l.label}`}
                      onClick={() => patch((x) => ({ ...x, lines: x.lines.filter((y) => y.id !== l.id) }))}
                      className="rounded-full px-2 py-1 text-[11px] font-bold text-slate-400 hover:bg-white hover:text-red-600"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <button
          type="button"
          onClick={() => patch((x) => ({ ...x, lines: [...x.lines, newLine(ctx)] }))}
          className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-brand-blue hover:bg-white"
        >
          + Add a group
        </button>
      </Section>
    </div>
  );
}

// -------------------------------------------------------------- the builder

/**
 * The full-screen project builder: a simple form on one side, the infographic forecast on the
 * other, and the two exports. Everything is live, so a change to any number shows straight away.
 */
export default function ProjectBuilder({
  project,
  patch,
  onClose,
  onDelete,
  fc,
  lastActualLabel,
  monthOptions,
  ctx,
}: {
  project: PlanProject;
  patch: Patch;
  onClose: () => void;
  onDelete: () => void;
  fc: ForecastResult;
  lastActualLabel: string;
  monthOptions: { key: string; label: string }[];
  ctx: TemplateContext;
}) {
  const report = useMemo(() => buildProjectReport(project, fc), [project, fc]);
  const [printing, setPrinting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const basedOn = `Based on the forecast built from actual figures up to ${lastActualLabel}.`;
  const kindLabel = PROJECT_KINDS.find((k) => k.key === project.kind)?.label ?? "Project";
  const startsBeyond = !monthOptions.some((m) => m.key === project.startKey);

  // Close on Escape, and keep the page behind from scrolling while this is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = before;
    };
  }, [onClose]);

  const exportPdf = () => {
    setError(null);
    setPrinting(true);
    // Give the print page a moment to lay its charts out, then open the browser's print dialog,
    // where "Save as PDF" makes the file.
    window.setTimeout(() => {
      const title = document.title;
      document.title = `${project.name} - forecast`;
      const done = () => {
        document.title = title;
        setPrinting(false);
        window.removeEventListener("afterprint", done);
      };
      window.addEventListener("afterprint", done);
      window.print();
    }, 800);
  };

  const exportExcel = async () => {
    setError(null);
    setBusy(true);
    try {
      await downloadProjectExcel(report, fc, basedOn);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The Excel file could not be made.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Forecast project: ${project.name}`}
      className="fixed inset-0 z-[60] overflow-y-auto bg-gradient-to-br from-[#dbe8fb] via-[#eef4fd] to-white"
    >
      <div className="sticky top-0 z-20 border-b border-white/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-3 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-brand-blue">Forecast project · {kindLabel}</p>
            <h2 className="truncate text-lg font-extrabold text-[#0e1b3d]">{project.name}</h2>
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={project.enabled}
              onChange={(e) => patch((x) => ({ ...x, enabled: e.target.checked }))}
              className="h-4 w-4 accent-[#1e50cc]"
            />
            In the forecast
          </label>
          <button
            type="button"
            onClick={exportPdf}
            disabled={printing}
            className="rounded-full bg-white px-4 py-2 text-xs font-bold text-brand-blue shadow-sm hover:bg-blue-50 disabled:opacity-50"
          >
            {printing ? "Preparing…" : "Export PDF"}
          </button>
          <button
            type="button"
            onClick={exportExcel}
            disabled={busy}
            className="rounded-full bg-white px-4 py-2 text-xs font-bold text-brand-blue shadow-sm hover:bg-blue-50 disabled:opacity-50"
          >
            {busy ? "Making file…" : "Export Excel"}
          </button>
          {confirmDelete ? (
            <span className="flex items-center gap-1.5">
              <button type="button" onClick={onDelete} className="rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700">
                Yes, delete it
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-full bg-white px-4 py-2 text-xs font-bold text-red-600 shadow-sm hover:bg-red-50"
            >
              Delete
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-full bg-brand-blue px-4 py-2 text-xs font-bold text-white hover:bg-brand-blue-dark">
            Done
          </button>
        </div>
        {error && <p className="mx-auto max-w-7xl px-3 pb-2 text-xs font-semibold text-red-600 sm:px-6">{error}</p>}
      </div>

      <div className="mx-auto grid max-w-7xl gap-5 px-3 py-5 sm:px-6 lg:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        <div className="space-y-4">
          {project.rollout ? (
            <RolloutForm project={project} patch={patch} monthOptions={monthOptions} ctx={ctx} />
          ) : (
            <GroupsForm project={project} patch={patch} monthOptions={monthOptions} ctx={ctx} />
          )}
          {startsBeyond && (
            <p className="text-xs font-semibold text-amber-700">
              The start month is outside the forecast, so company totals are not shown for it. Pick a month within the next {monthOptions.length} months.
            </p>
          )}
          <MoreOptions project={project} patch={patch} monthOptions={monthOptions} />
          <p className="text-[11px] text-slate-400">Every change is saved in this browser as you type.</p>
        </div>
        <div className="min-w-0">
          <ProjectInfographic report={report} />
        </div>
      </div>

      {printing && createPortal(<PrintReport report={report} basedOn={basedOn} />, document.body)}
    </div>
  );
}
