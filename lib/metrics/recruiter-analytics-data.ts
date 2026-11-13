import { createServerSupabaseClient } from "@/lib/supabase/server";
import { selectRows } from "@/lib/supabase/select-rows";
import { resolveDataBackend } from "@/lib/data-source/resolve";
import { demoCandidateFeedback, demoPositions } from "@/lib/demo/fixtures";
import { getRawCandidateFeedback, getRawPositions } from "@/lib/local-db/queries";
import {
  computeRecruiterAnalytics,
  type RecruiterAnalytics,
  type RecruiterAnalyticsOptions,
} from "./recruiter-analytics";

export async function getRecruiterAnalytics(options: RecruiterAnalyticsOptions): Promise<RecruiterAnalytics> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") return computeRecruiterAnalytics(demoPositions, demoCandidateFeedback, options);
  if (backend === "sqlite") {
    return computeRecruiterAnalytics(getRawPositions(), getRawCandidateFeedback(), options);
  }

  const supabase = createServerSupabaseClient();
  const [positions, feedback] = await Promise.all([
    selectRows("positions", () => supabase.from("positions").select("*")),
    selectRows("candidate feedback", () => supabase.from("candidate_feedback").select("*")),
  ]);
  return computeRecruiterAnalytics(positions, feedback, options);
}
