import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveDataBackend } from "@/lib/data-source/resolve";
import { demoRecruiters } from "@/lib/demo/fixtures";
import { getRecruiterPerformance as getLocalRecruiterPerformance } from "@/lib/local-db/queries";
import type { RecruiterPerformanceRow } from "@/lib/supabase/types";

export async function getRecruiterPerformance(): Promise<
  RecruiterPerformanceRow[]
> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") return demoRecruiters;
  if (backend === "sqlite") return getLocalRecruiterPerformance();

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("v_recruiter_performance")
    .select("*")
    .order("positions_closed", { ascending: false });
  if (error) {
    throw new Error(`getRecruiterPerformance failed: ${error.message}`);
  }
  return data ?? [];
}
