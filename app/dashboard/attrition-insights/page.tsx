import AttritionView from "@/components/attrition-view";

// Staging version of the Attrition tab: the same page with infographics and
// quick filters in place of the tables. Shown only to admins until the
// "Attrition Insights" row is ticked for other roles in the Admin matrix.
export default function AttritionInsightsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return (
    <AttritionView
      searchParams={searchParams}
      basePath="/dashboard/attrition-insights"
      tabKey="attrition-insights"
      variant="infographics"
    />
  );
}
