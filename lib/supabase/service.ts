import { createClient } from "@supabase/supabase-js";
import { supabaseServiceRoleKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * Service-role client: bypasses Row-Level Security entirely.
 * Server-only (API routes, admin actions, the sync script) — NEVER import
 * this from a Client Component or expose the key to the browser.
 */
export function createServiceRoleClient() {
  return createClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
