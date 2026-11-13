import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveDataBackend } from "@/lib/data-source/resolve";
import { demoPositions } from "@/lib/demo/fixtures";
import { getPositionWithSlaById, getPositionsWithSla } from "@/lib/local-db/queries";
import type { PositionWithSla } from "@/lib/supabase/types";

export interface PositionFilters {
  department?: string;
  onlyOpen?: boolean;
  onlyBreached?: boolean;
}

function applyFilters(
  positions: PositionWithSla[],
  filters: PositionFilters
): PositionWithSla[] {
  return positions
    .filter((p) => !filters.department || p.department === filters.department)
    .filter((p) => !filters.onlyOpen || p.open_closed === "Open")
    .filter((p) => !filters.onlyBreached || p.sla_breached)
    .sort((a, b) => (b.aging_days ?? -1) - (a.aging_days ?? -1));
}

export async function getPositions(
  filters: PositionFilters = {}
): Promise<PositionWithSla[]> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") return applyFilters(demoPositions, filters);
  if (backend === "sqlite") return applyFilters(getPositionsWithSla(), filters);

  const supabase = createServerSupabaseClient();
  let query = supabase.from("v_positions_with_sla").select("*");

  if (filters.department) query = query.eq("department", filters.department);
  if (filters.onlyOpen) query = query.eq("open_closed", "Open");
  if (filters.onlyBreached) query = query.eq("sla_breached", true);

  const { data, error } = await query.order("aging_days", {
    ascending: false,
    nullsFirst: false,
  });
  if (error) throw new Error(`getPositions failed: ${error.message}`);
  return data ?? [];
}

export async function getPositionById(
  positionPk: string
): Promise<PositionWithSla | null> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") return demoPositions.find((p) => p.id === positionPk) ?? null;
  if (backend === "sqlite") return getPositionWithSlaById(positionPk);

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("v_positions_with_sla")
    .select("*")
    .eq("id", positionPk)
    .maybeSingle();
  if (error) throw new Error(`getPositionById failed: ${error.message}`);
  return data;
}

export interface PositionSummary {
  totalOpen: number;
  totalClosed: number;
  totalRequirement: number;
  totalInPipeline: number;
  byDepartment: { department: string; open: number }[];
}

export async function getPositionSummary(): Promise<PositionSummary> {
  const all = await getPositions({});
  const open = all.filter((p) => p.open_closed === "Open");
  const closed = all.filter((p) => p.open_closed === "Closed");

  const byDept = new Map<string, number>();
  for (const p of open) {
    const dept = p.department ?? "Unassigned";
    byDept.set(dept, (byDept.get(dept) ?? 0) + 1);
  }

  return {
    totalOpen: open.length,
    totalClosed: closed.length,
    // "Requirement"/"in pipeline" reflect current active hiring need, so
    // only counted for still-open positions.
    totalRequirement: open.reduce((sum, p) => sum + (p.position_open_count ?? 0), 0),
    totalInPipeline: open.reduce((sum, p) => sum + (p.pipeline_count ?? 0), 0),
    byDepartment: Array.from(byDept.entries()).map(([department, open]) => ({
      department,
      open,
    })),
  };
}
