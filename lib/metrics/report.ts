import { createServerSupabaseClient } from "@/lib/supabase/server";
import { selectRows } from "@/lib/supabase/select-rows";
import { resolveDataBackend } from "@/lib/data-source/resolve";
import { demoPositions, demoUpcomingJoiners } from "@/lib/demo/fixtures";
import { getRawPositions, getRawUpcomingJoiners } from "@/lib/local-db/queries";
import { computeHiringReport, type HiringReport, type ReportOptions } from "./report-calc";

export async function getHiringReport(options: ReportOptions = {}): Promise<HiringReport> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") return computeHiringReport(demoPositions, demoUpcomingJoiners, options);
  if (backend === "sqlite") return computeHiringReport(getRawPositions(), getRawUpcomingJoiners(), options);

  const supabase = createServerSupabaseClient();
  const [positions, joiners] = await Promise.all([
    selectRows("positions", () => supabase.from("positions").select("*")),
    selectRows("joiners", () => supabase.from("upcoming_joiners").select("*")),
  ]);
  return computeHiringReport(positions, joiners, options);
}
