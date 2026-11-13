import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * Server-side client scoped to the current user's session (RLS-enforced).
 * Use this everywhere a Server Component / Route Handler reads or writes
 * data on behalf of the logged-in user.
 */
export function createServerSupabaseClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[]
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component with no request context to write
          // cookies to — safe to ignore because middleware refreshes sessions.
        }
      },
    },
  });
}
