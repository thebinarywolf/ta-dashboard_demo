import { getSourceConversion } from "@/lib/metrics/sources";
import { requireTabAccess } from "@/lib/auth/guards";
import AccessRestricted from "@/components/access-restricted";
import ScrollTable from "@/components/scroll-table";

export default async function SourcesPage() {
  // Fetch at the same time as the permission check (they are independent).
  const dataPromise = getSourceConversion();
  dataPromise.catch(() => {});

  const { allowed } = await requireTabAccess("sources");
  if (!allowed) return <AccessRestricted />;

  const sources = await dataPromise;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-[#0e1b3d]">Source Mix</h1>
        <p className="text-sm text-slate-500">
          Candidate volume by source (referral, job portal, agency, etc.) and
          each source&apos;s conversion rate through to joining.
        </p>
      </div>

      <ScrollTable className="bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_10px_30px_rgba(30,80,204,0.10)] rounded-[22px]">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Candidates</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Conversion rate</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.source} className="border-b border-slate-200/50 last:border-0">
                <td className="px-4 py-3 font-semibold text-[#0e1b3d]">{s.source}</td>
                <td className="px-4 py-3 text-slate-600">{s.total_candidates}</td>
                <td className="px-4 py-3 text-slate-600">{s.joined_candidates}</td>
                <td className="px-4 py-3 text-slate-600">
                  {Math.round(s.conversionRate * 100)}%
                </td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No data yet — run a sync from the Admin panel.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ScrollTable>
    </div>
  );
}
