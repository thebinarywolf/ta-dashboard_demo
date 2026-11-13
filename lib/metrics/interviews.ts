import { createServerSupabaseClient } from "@/lib/supabase/server";
import { selectRows } from "@/lib/supabase/select-rows";
import { resolveDataBackend } from "@/lib/data-source/resolve";
import { demoCandidateFeedback } from "@/lib/demo/fixtures";
import {
  computeInterviewedSince,
  computeInterviewedSinceForPosition,
  computeInterviewHistory,
  computeInterviewsByDayLast7Days,
  computeRejectionReasonsForPosition,
  getInterviewedLast7Days as getLocalInterviewedLast7Days,
  getInterviewedLast7DaysForPosition as getLocalInterviewedLast7DaysForPosition,
  getInterviewHistoryForPosition as getLocalInterviewHistoryForPosition,
  getInterviewsByDayLast7Days as getLocalInterviewsByDayLast7Days,
  getRejectionReasonsForPosition as getLocalRejectionReasonsForPosition,
  type ReasonCount,
} from "@/lib/local-db/queries";
import type { CandidateFeedbackRow, PositionRow } from "@/lib/supabase/types";

async function fetchSupabaseRaw(): Promise<{
  positions: PositionRow[];
  feedback: CandidateFeedbackRow[];
}> {
  const supabase = createServerSupabaseClient();
  const [positions, feedback] = await Promise.all([
    selectRows("positions", () => supabase.from("positions").select("*")),
    selectRows("candidate feedback", () => supabase.from("candidate_feedback").select("*")),
  ]);
  return { positions, feedback };
}

export async function getInterviewedLast7Days(): Promise<number> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") return computeInterviewedSince(demoCandidateFeedback, 7);
  if (backend === "sqlite") return getLocalInterviewedLast7Days();
  const { feedback } = await fetchSupabaseRaw();
  return computeInterviewedSince(feedback, 7);
}

export async function getInterviewedLast7DaysForPosition(
  positionId: string
): Promise<number> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") {
    return computeInterviewedSinceForPosition(demoCandidateFeedback, positionId, 7);
  }
  if (backend === "sqlite") return getLocalInterviewedLast7DaysForPosition(positionId);
  const { feedback } = await fetchSupabaseRaw();
  return computeInterviewedSinceForPosition(feedback, positionId, 7);
}

export async function getInterviewsByDayLast7Days(): Promise<number[]> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") return computeInterviewsByDayLast7Days(demoCandidateFeedback);
  if (backend === "sqlite") return getLocalInterviewsByDayLast7Days();
  const { feedback } = await fetchSupabaseRaw();
  return computeInterviewsByDayLast7Days(feedback);
}

export async function getInterviewHistoryForPosition(
  positionId: string
): Promise<CandidateFeedbackRow[]> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") return computeInterviewHistory(demoCandidateFeedback, positionId);
  if (backend === "sqlite") return getLocalInterviewHistoryForPosition(positionId);
  const { feedback } = await fetchSupabaseRaw();
  return computeInterviewHistory(feedback, positionId);
}

export async function getRejectionReasonsForPosition(
  positionId: string
): Promise<ReasonCount[]> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") {
    return computeRejectionReasonsForPosition(demoCandidateFeedback, positionId);
  }
  if (backend === "sqlite") return getLocalRejectionReasonsForPosition(positionId);
  const { feedback } = await fetchSupabaseRaw();
  return computeRejectionReasonsForPosition(feedback, positionId);
}
