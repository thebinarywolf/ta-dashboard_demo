import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveDataBackend } from "@/lib/data-source/resolve";
import { demoFunnelByDepartment, demoFunnelOverall } from "@/lib/demo/fixtures";
import { getFunnelByDepartment as getLocalFunnelByDepartment, getFunnelOverall as getLocalFunnelOverall } from "@/lib/local-db/queries";
import type { FunnelRow } from "@/lib/supabase/types";

export async function getOverallFunnel(): Promise<FunnelRow> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") return demoFunnelOverall;
  if (backend === "sqlite") return getLocalFunnelOverall();

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("v_funnel_overall")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`getOverallFunnel failed: ${error.message}`);
  return (
    data ?? {
      sourced: 0,
      interviewed: 0,
      selected: 0,
      offer_accepted: 0,
      joined: 0,
    }
  );
}

export async function getFunnelByDepartment(): Promise<FunnelRow[]> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") return demoFunnelByDepartment;
  if (backend === "sqlite") return getLocalFunnelByDepartment();

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("v_funnel_by_department")
    .select("*")
    .not("department", "is", null)
    .order("sourced", { ascending: false });
  if (error) throw new Error(`getFunnelByDepartment failed: ${error.message}`);
  return data ?? [];
}
