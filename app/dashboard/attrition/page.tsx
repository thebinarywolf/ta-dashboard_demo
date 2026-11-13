import AttritionView from "@/components/attrition-view";

export default function AttritionPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return <AttritionView searchParams={searchParams} basePath="/dashboard/attrition" tabKey="attrition" variant="tables" />;
}
