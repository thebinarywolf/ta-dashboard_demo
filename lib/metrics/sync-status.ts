import { WRITE_BACKEND } from "@/lib/data-source/config";
import { getLastSyncRun } from "@/lib/local-db/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SyncRunRow } from "@/lib/supabase/types";

export async function getLastSyncInfo(): Promise<Pick<
  SyncRunRow,
  "finished_at" | "status" | "rows_synced"
> | null> {
  if (WRITE_BACKEND === "sqlite") return getLastSyncRun();

  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("sync_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
