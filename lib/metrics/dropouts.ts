import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveDataBackend } from "@/lib/data-source/resolve";
import { demoDropouts } from "@/lib/demo/fixtures";
import { getDropoutsFlagged } from "@/lib/local-db/queries";
import type { DropoutFlaggedRow } from "@/lib/supabase/types";

export async function getDropouts(): Promise<DropoutFlaggedRow[]> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") return demoDropouts;
  if (backend === "sqlite") return getDropoutsFlagged();

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("v_dropouts_flagged")
    .select("*")
    .order("actual_dropout_date", { ascending: false, nullsFirst: false });
  if (error) throw new Error(`getDropouts failed: ${error.message}`);
  return data ?? [];
}

export interface DropoutReasonSummary {
  reason: string;
  count: number;
  earlyDropoffs: number; // gap <= 7 days: comp/offer-issue territory
  lateDropoffs: number; // gap > 7 days: notice period / competing offers
}

/**
 * "Early" vs "late" drop-off, per the dashboard requirement: a short gap
 * between offer acceptance and drop-out points at compensation/offer
 * issues, a long gap points at notice-period/competing-offer issues. 7 days
 * is a reasonable default cut — tune if the TA team has a different rule
 * of thumb.
 */
const EARLY_LATE_CUTOFF_DAYS = 7;

export async function getDropoutReasonSummary(): Promise<
  DropoutReasonSummary[]
> {
  const dropouts = await getDropouts();
  const byReason = new Map<string, DropoutReasonSummary>();

  for (const d of dropouts) {
    const reason = d.reason ?? "Not recorded";
    const entry = byReason.get(reason) ?? {
      reason,
      count: 0,
      earlyDropoffs: 0,
      lateDropoffs: 0,
    };
    entry.count += 1;
    if (d.days_gap !== null) {
      if (d.days_gap <= EARLY_LATE_CUTOFF_DAYS) entry.earlyDropoffs += 1;
      else entry.lateDropoffs += 1;
    }
    byReason.set(reason, entry);
  }

  return Array.from(byReason.values()).sort((a, b) => b.count - a.count);
}
