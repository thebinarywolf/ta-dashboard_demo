import RecruitersView from "@/components/recruiters-view";

export default function RecruitersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return (
    <RecruitersView searchParams={searchParams} basePath="/dashboard/recruiters" tabKey="recruiters" variant="tables" />
  );
}
