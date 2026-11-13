import { addDays, addMonths } from "@/lib/metrics/attrition-calc";

export interface QuickRange {
  label: string;
  /** Inclusive dates, "YYYY-MM-DD". */
  from: string;
  to: string;
}

/** The one-click date ranges shown on the Positions and Attrition filters,
 *  all ending today except "Last month". */
export function buildQuickRanges(today: string): QuickRange[] {
  const monthStart = `${today.slice(0, 7)}-01`;
  const lastMonthEnd = addDays(monthStart, -1);
  return [
    { label: "This month", from: monthStart, to: today },
    { label: "Last month", from: `${lastMonthEnd.slice(0, 7)}-01`, to: lastMonthEnd },
    { label: "Last 3 months", from: addDays(addMonths(today, -3), 1), to: today },
    { label: "Last 6 months", from: addDays(addMonths(today, -6), 1), to: today },
    { label: "This year", from: `${today.slice(0, 4)}-01-01`, to: today },
    { label: "Last 12 months", from: addDays(today, -364), to: today },
  ];
}
