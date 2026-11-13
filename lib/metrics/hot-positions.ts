import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { resolveDataBackend } from "@/lib/data-source/resolve";
import { getHotPositionIdsLocal, setHotPositionLocal } from "@/lib/local-db/hot-positions";
import type { Profile } from "@/lib/supabase/types";

// Demo mode keeps the markings in memory (same idea as the demo user store).
declare global {
  // eslint-disable-next-line no-var
  var __demoHotPositions: Set<string> | undefined;
}
const demoHot = () => (globalThis.__demoHotPositions ??= new Set<string>());

/** Who may mark or un-mark hot positions: approved admins, recruiters and Pro Viewers. */
export function canMarkHotPositions(profile: Pick<Profile, "role" | "status">): boolean {
  return profile.status === "approved" && ["admin", "recruiter", "pro_viewer"].includes(profile.role);
}

/**
 * Job IDs marked as hot (by an admin, recruiter or Pro Viewer). Never fails the page: if the table does
 * not exist yet (database step not run) it returns an empty list.
 */
export async function getHotPositionIds(): Promise<string[]> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") return Array.from(demoHot());
  try {
    if (backend === "sqlite") return getHotPositionIdsLocal();
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.from("hot_positions").select("position_id");
    return error ? [] : (data ?? []).map((r) => r.position_id);
  } catch {
    return [];
  }
}

/** Marks or un-marks a position as hot. Throws a readable message on failure. */
export async function setHotPosition(positionId: string, hot: boolean, markedBy: string | null): Promise<void> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") {
    if (hot) demoHot().add(positionId);
    else demoHot().delete(positionId);
    return;
  }
  if (backend === "sqlite") {
    setHotPositionLocal(positionId, hot, markedBy);
    return;
  }

  const supabase = createServiceRoleClient();
  const { error } = hot
    ? await supabase
        .from("hot_positions")
        .upsert({ position_id: positionId, marked_by: markedBy, marked_at: new Date().toISOString() })
    : await supabase.from("hot_positions").delete().eq("position_id", positionId);
  if (error) {
    throw new Error(
      /relation|does not exist|schema cache/i.test(error.message)
        ? "The hot-positions table is not set up yet. Run supabase/migrations/0009_hot_positions.sql in the Supabase SQL Editor."
        : error.message
    );
  }
}
