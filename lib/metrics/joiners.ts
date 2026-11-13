import { createServerSupabaseClient } from "@/lib/supabase/server";
import { selectRows } from "@/lib/supabase/select-rows";
import { resolveDataBackend } from "@/lib/data-source/resolve";
import { demoUpcomingJoiners } from "@/lib/demo/fixtures";
import { getRawUpcomingJoiners } from "@/lib/local-db/queries";
import type { UpcomingJoinerRow } from "@/lib/supabase/types";

/** Everyone in the joiner tracker for one position (yet to join, joined and dropped), soonest start first. */
export async function getJoinersForPosition(positionId: string): Promise<UpcomingJoinerRow[]> {
  const backend = resolveDataBackend();
  let rows: UpcomingJoinerRow[];
  if (backend === "fixtures") rows = demoUpcomingJoiners.filter((j) => j.position_id === positionId);
  else if (backend === "sqlite") rows = getRawUpcomingJoiners().filter((j) => j.position_id === positionId);
  else {
    const supabase = createServerSupabaseClient();
    rows = await selectRows("joiners", () =>
      supabase.from("upcoming_joiners").select("*").eq("position_id", positionId)
    );
  }
  // The sheet sometimes repeats the same row; show each person once.
  const seen = new Set<string>();
  const unique = rows.filter((j) => {
    const key = `${j.candidate_name}|${j.doj}|${j.status}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.sort((a, b) => (a.doj ?? "9999").localeCompare(b.doj ?? "9999"));
}
