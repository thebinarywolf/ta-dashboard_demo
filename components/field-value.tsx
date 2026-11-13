export default function FieldValue({
  value,
}: {
  value: string | number | null | undefined;
}) {
  if (value === null || value === undefined || value === "") {
    return (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        Missing
      </span>
    );
  }
  return <>{value}</>;
}
