import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveDataBackend } from "@/lib/data-source/resolve";
import { demoPipelines } from "@/lib/demo/fixtures";
import { getPipelineForPositionId } from "@/lib/local-db/queries";
import type { PipelineByPosition } from "@/lib/supabase/types";

export async function getPipelineForPosition(
  positionId: string
): Promise<PipelineByPosition | null> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") {
    return demoPipelines.find((p) => p.position_id === positionId) ?? null;
  }
  if (backend === "sqlite") return getPipelineForPositionId(positionId);

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("v_pipeline_by_position")
    .select("*")
    .eq("position_id", positionId)
    .maybeSingle();
  if (error) throw new Error(`getPipelineForPosition failed: ${error.message}`);
  return data;
}
