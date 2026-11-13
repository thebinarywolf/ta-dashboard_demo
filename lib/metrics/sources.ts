import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveDataBackend } from "@/lib/data-source/resolve";
import { demoSourceConversion } from "@/lib/demo/fixtures";
import { getSourceConversion as getLocalSourceConversion } from "@/lib/local-db/queries";
import { mergeSourceRows } from "@/lib/metrics/source-names";
import type { SourceConversionRow } from "@/lib/supabase/types";

export interface SourceConversion extends SourceConversionRow {
  conversionRate: number; // 0-1
}

function withConversionRate(rows: SourceConversionRow[]): SourceConversion[] {
  return mergeSourceRows(rows).map((row) => ({
    ...row,
    conversionRate:
      row.total_candidates > 0 ? row.joined_candidates / row.total_candidates : 0,
  }));
}

export async function getSourceConversion(): Promise<SourceConversion[]> {
  const backend = resolveDataBackend();
  if (backend === "fixtures") return withConversionRate(demoSourceConversion);
  if (backend === "sqlite") return withConversionRate(getLocalSourceConversion());

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("v_source_conversion")
    .select("*")
    .not("source", "is", null)
    .order("total_candidates", { ascending: false });
  if (error) throw new Error(`getSourceConversion failed: ${error.message}`);
  return withConversionRate(data ?? []);
}
