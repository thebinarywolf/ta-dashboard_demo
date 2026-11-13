import { getDropoutReasonSummary, getDropouts } from "@/lib/metrics/dropouts";
import { requireTabAccess } from "@/lib/auth/guards";
import AccessRestricted from "@/components/access-restricted";
import ScrollTable from "@/components/scroll-table";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function DropoutsPage() {
  // Fetch at the same time as the permission check (they are independent).
  const dataPromise = Promise.all([getDropoutReasonSummary(), getDropouts()]);
  dataPromise.catch(() => {});

  const { allowed } = await requireTabAccess("dropouts");
  if (!allowed) return <AccessRestricted />;

  const [reasons, dropouts] = await dataPromise;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-[#0e1b3d]">Dropout Analysis</h1>
        <p className="text-sm text-slate-500">
          Reasons for drop-out, and how soon after offer acceptance it happened
          — short gaps point at compensation/offer issues, longer gaps at
          notice-period or competing offers.
        </p>
      </div>

      <ScrollTable className="bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_10px_30px_rgba(30,80,204,0.10)] rounded-[22px]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Count</th>
              <th className="px-4 py-3">Early (≤7d)</th>
              <th className="px-4 py-3">Late (&gt;7d)</th>
            </tr>
          </thead>
          <tbody>
            {reasons.map((r) => (
              <tr key={r.reason} className="border-b border-slate-200/50 last:border-0">
                <td className="px-4 py-3 font-semibold text-[#0e1b3d]">{r.reason}</td>
                <td className="px-4 py-3 text-slate-600">{r.count}</td>
                <td className="px-4 py-3 text-slate-600">{r.earlyDropoffs}</td>
                <td className="px-4 py-3 text-slate-600">{r.lateDropoffs}</td>
              </tr>
            ))}
            {reasons.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No data yet — run a sync from the Admin panel.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollTable>

      <div>
        <h2 className="text-sm font-bold text-[#0e1b3d]">All drop-outs</h2>
        <ScrollTable outerClassName="mt-3" className="bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_10px_30px_rgba(30,80,204,0.10)] rounded-[22px]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Candidate</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Offer accepted</th>
                <th className="px-4 py-3">Dropped out</th>
                <th className="px-4 py-3">Gap</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Flags</th>
              </tr>
            </thead>
            <tbody>
              {dropouts.map((d) => (
                <tr key={d.id} className="border-b border-slate-200/50 last:border-0">
                  <td className="px-4 py-3 text-slate-900">{d.candidate_name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {d.position_applied ?? "—"}
                    {d.position_id && (
                      <div className="text-xs text-slate-400">{d.position_id}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(d.offer_accepted_date)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(d.actual_dropout_date)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {d.days_gap !== null ? `${d.days_gap}d` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{d.reason ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {d.unlinked && (
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                          Unlinked
                        </span>
                      )}
                      {d.missing_dates && (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">
                          Incomplete dates
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {dropouts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No data yet — run a sync from the Admin panel.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollTable>
      </div>
    </div>
  );
}
