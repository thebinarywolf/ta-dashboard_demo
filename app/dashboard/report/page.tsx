import { requireTabAccess } from "@/lib/auth/guards";
import AccessRestricted from "@/components/access-restricted";
import HiringReport, { type ClosedWindowOption } from "@/components/hiring-report";
import { getHiringReport } from "@/lib/metrics/report";

// Closed positions are shown only if they closed within this window (open ones
// always show), which keeps the tracker about the current cycle.
const WINDOWS: { label: string; param: string; days: number | null }[] = [
  { label: "Last 30 days", param: "30", days: 30 },
  { label: "Last 90 days", param: "90", days: 90 },
  { label: "Last 6 months", param: "180", days: 180 },
  { label: "All", param: "all", days: null },
];
const DEFAULT_WINDOW = "90";

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const requested = firstParam(searchParams.closed);
  const current =
    WINDOWS.find((w) => w.param === requested) ?? WINDOWS.find((w) => w.param === DEFAULT_WINDOW)!;

  // Fetch alongside the permission check (they are independent).
  const dataPromise = getHiringReport({ closedWithinDays: current.days });
  dataPromise.catch(() => {});

  const { allowed } = await requireTabAccess("report");
  if (!allowed) return <AccessRestricted />;

  const report = await dataPromise;
  const windows: ClosedWindowOption[] = WINDOWS.map((w) => ({
    label: w.label,
    href: `?closed=${w.param}`,
    active: w.param === current.param,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-[#0e1b3d]">Hiring report</h1>
        <p className="text-sm text-slate-500">
          Every position is a seat to fill. See how many are filled, how many have candidates in the pipeline and
          how many are still open, by department (HO) or by location (Branch). Click a card to see its positions.
        </p>
      </div>
      <HiringReport ho={report.ho} branch={report.branch} excluded={report.excluded} windows={windows} />
    </div>
  );
}
