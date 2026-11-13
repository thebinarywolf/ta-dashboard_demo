import RecruitersView from "@/components/recruiters-view";

// Staging version of the Recruiters tab: the same numbers as interactive
// infographics. The original Recruiters tab stays as it is. Shown only to admins
// until the "Recruiters Insights" row is ticked for other roles in the Admin matrix.
export default function RecruitersInsightsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return (
    <RecruitersView
      searchParams={searchParams}
      basePath="/dashboard/recruiters-insights"
      tabKey="recruiters-insights"
      variant="infographics"
    />
  );
}
