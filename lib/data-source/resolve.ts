import { WRITE_BACKEND } from "./config";
import { hasSyncedData } from "@/lib/local-db/queries";

/**
 * What lib/metrics/*.ts should actually read from. Distinct from
 * WRITE_BACKEND: syncing always targets sqlite once Supabase isn't
 * configured (no credentials required for the public-CSV path), but reads
 * should fall back to sample fixtures until a sync has actually populated
 * that database — otherwise the dashboard would render empty on first run.
 * Node-runtime only (touches the local SQLite file).
 */
export function resolveDataBackend(): "supabase" | "sqlite" | "fixtures" {
  if (WRITE_BACKEND === "supabase") return "supabase";
  return hasSyncedData() ? "sqlite" : "fixtures";
}
