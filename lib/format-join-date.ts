/** "5 Nov (in 9 days)" for a joining date given as YYYY-MM-DD. */
export function joinDateText(doj: string | null): string {
  if (!doj) return "Date not given";
  const d = new Date(`${doj}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return doj;
  const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  const today = new Date();
  const diff = Math.round((d.getTime() - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  if (diff === 0) return `${label} (today)`;
  if (diff === 1) return `${label} (tomorrow)`;
  if (diff > 1) return `${label} (in ${diff} days)`;
  return `${label} (${-diff} ${diff === -1 ? "day" : "days"} ago)`;
}
