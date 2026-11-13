import Link from "next/link";
import { requireTabAccess } from "@/lib/auth/guards";
import AccessRestricted from "@/components/access-restricted";
import FinancialsExplorer, { FinancialsHeader } from "@/components/financials-explorer";
import { GLASS_PANEL } from "@/components/glass-card";
import { getFinancials } from "@/lib/metrics/financials";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FinancialsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // `?fresh=1` skips the few-minutes memory of the sheet and reads it again.
  const dataPromise = getFinancials({ fresh: firstParam(searchParams.fresh) === "1" });
  dataPromise.catch(() => {});

  const { allowed } = await requireTabAccess("financials");
  if (!allowed) return <AccessRestricted />;

  const result = await dataPromise;

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <FinancialsHeader notes={[]} source="" />
        <div className={`${GLASS_PANEL} space-y-2 p-6`}>
          <p className="text-sm font-bold text-[#0e1b3d]">The finance sheet could not be read</p>
          <p className="text-sm text-slate-600">{result.error}</p>
          <p className="text-xs text-slate-500">
            Check that the sheet is shared as &quot;Anyone with the link can view&quot;, or that FINANCE_APPS_SCRIPT_URL and
            FINANCE_APPS_SCRIPT_SECRET are set. See docs/google-apps-script-setup.md.
          </p>
          <Link href="?fresh=1" className="inline-block rounded-full bg-brand-blue px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-blue-dark">
            Try again
          </Link>
        </div>
      </div>
    );
  }

  const readAt = new Date(result.fetchedAt).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <FinancialsHeader
          notes={result.data.notes}
          source={
            result.via === "sample"
              ? "Made-up figures for this showcase, laid out like the finance sheet. Amounts are in rupees."
              : `From the "Real OG" tab of the finance sheet, read at ${readAt} (${
                  result.via === "apps-script" ? "through its Apps Script" : "through its share link"
                }). Amounts are in rupees.`
          }
        />
        <Link href="?fresh=1" className="text-xs font-bold text-brand-blue hover:underline">
          Read the sheet again
        </Link>
      </div>
      <FinancialsExplorer data={result.data} />
    </div>
  );
}
