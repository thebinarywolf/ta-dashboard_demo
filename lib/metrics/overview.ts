import { createServerSupabaseClient } from "@/lib/supabase/server";
import { selectRows } from "@/lib/supabase/select-rows";
import { resolveDataBackend } from "@/lib/data-source/resolve";
import { demoCandidateFeedback, demoPositions, demoUpcomingJoiners } from "@/lib/demo/fixtures";
import {
  computeDashboardOverview,
  getDashboardOverview as getLocalDashboardOverview,
  type DashboardFilters,
  type DashboardOverview,
} from "@/lib/local-db/queries";
import type { CandidateFeedbackRow, PositionRow, UpcomingJoinerRow } from "@/lib/supabase/types";

async function fetchSupabaseRaw(): Promise<{
  positions: PositionRow[];
  feedback: CandidateFeedbackRow[];
  joiners: UpcomingJoinerRow[];
}> {
  const supabase = createServerSupabaseClient();
  const [positions, feedback, joiners] = await Promise.all([
    selectRows("positions", () => supabase.from("positions").select("*")),
    selectRows("candidate feedback", () => supabase.from("candidate_feedback").select("*")),
    selectRows("joiners", () => supabase.from("upcoming_joiners").select("*")),
  ]);
  return { positions, feedback, joiners };
}

export async function getDashboardOverview(
  filters: DashboardFilters
): Promise<DashboardOverview> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") {
    return computeDashboardOverview(
      demoPositions,
      demoCandidateFeedback,
      demoUpcomingJoiners,
      filters
    );
  }
  if (backend === "sqlite") return getLocalDashboardOverview(filters);

  const { positions, feedback, joiners } = await fetchSupabaseRaw();
  return computeDashboardOverview(positions, feedback, joiners, filters);
}
