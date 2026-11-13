import { getFunnelByDepartment, getOverallFunnel } from "@/lib/metrics/funnel";
import { requireTabAccess } from "@/lib/auth/guards";
import FunnelChart from "@/components/funnel-chart";
import AccessRestricted from "@/components/access-restricted";
import ScrollTable from "@/components/scroll-table";

// Candidate identity isn't shared across tabs (no candidate ID column — see
// docs/join-keys.md), so a later stage can occasionally show a higher count
// than an earlier one (best-effort name matching misses some links). A
// funnel can't sensibly show negative drop-off, so this clamps at 0% rather
// than displaying a confusing negative number.
function dropOff(from: number, to: number) {
  if (from === 0) return "—";
  return `${Math.max(0, Math.round(((from - to) / from) * 100))}%`;
}

export default async function FunnelPage() {
  // Fetch at the same time as the permission check (they are independent).
  const dataPromise = Promise.all([getOverallFunnel(), getFunnelByDepartment()]);
  dataPromise.catch(() => {});

  const { allowed } = await requireTabAccess("funnel");
  if (!allowed) return <AccessRestricted />;

  const [overall, byDepartment] = await dataPromise;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-[#0e1b3d]">Hiring Funnel</h1>
        <p className="text-sm text-slate-500">
          Sourced → interviewed → selected → offer accepted → joined, with
          drop-off at each stage.
        </p>
      </div>

      <div className="bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_10px_30px_rgba(30,80,204,0.10)] rounded-[22px] p-4">
        <FunnelChart funnel={overall} />
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
          <span>Sourced → Interviewed: {dropOff(overall.sourced, overall.interviewed)} drop-off</span>
          <span>Interviewed → Selected: {dropOff(overall.interviewed, overall.selected)} drop-off</span>
          <span>Selected → Offer accepted: {dropOff(overall.selected, overall.offer_accepted)} drop-off</span>
          <span>Offer accepted → Joined: {dropOff(overall.offer_accepted, overall.joined)} drop-off</span>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold text-[#0e1b3d]">By department</h2>
        <ScrollTable outerClassName="mt-3" className="bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_10px_30px_rgba(30,80,204,0.10)] rounded-[22px]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Sourced</th>
                <th className="px-4 py-3">Interviewed</th>
                <th className="px-4 py-3">Selected</th>
                <th className="px-4 py-3">Offer accepted</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Sourced → Joined</th>
              </tr>
            </thead>
            <tbody>
              {byDepartment.map((row) => (
                <tr key={row.department} className="border-b border-slate-200/50 last:border-0">
                  <td className="px-4 py-3 font-semibold text-[#0e1b3d]">{row.department}</td>
                  <td className="px-4 py-3 text-slate-600">{row.sourced}</td>
                  <td className="px-4 py-3 text-slate-600">{row.interviewed}</td>
                  <td className="px-4 py-3 text-slate-600">{row.selected}</td>
                  <td className="px-4 py-3 text-slate-600">{row.offer_accepted}</td>
                  <td className="px-4 py-3 text-slate-600">{row.joined}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {dropOff(row.sourced, row.joined)} drop-off
                  </td>
                </tr>
              ))}
              {byDepartment.length === 0 && (
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
