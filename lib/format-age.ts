const DAYS_PER_MONTH = 30.4;

/** "12d" up to 30 days; beyond that in months, e.g. "7.6 months". */
export function formatAge(days: number): string {
  if (days <= 30) return `${days}d`;
  const months = Math.round((days / DAYS_PER_MONTH) * 10) / 10;
  const text = Number.isInteger(months) ? String(months) : months.toFixed(1);
  return `${text} ${months === 1 ? "month" : "months"}`;
}
