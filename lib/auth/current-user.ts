import { cache } from "react";
import { DEMO_MODE } from "@/lib/demo/config";
import { getDemoSessionUserId } from "@/lib/demo/session";
import { findDemoUserById, toProfile } from "@/lib/demo/store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";
import { SHOWCASE, SHOWCASE_ADMIN } from "@/lib/showcase/flag";

/**
 * The one place that knows how to resolve "who is logged in" for either
 * demo mode (cookie -> in-memory store) or real mode (Supabase session ->
 * profiles table). Everything else (guards, API routes, /pending) reads
 * through this rather than branching on DEMO_MODE itself.
 */
// cache(): the layout, the page and the app shell all ask "who is logged in"
// during one request; this makes it one Supabase round trip instead of several.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  // Showcase copy: no sign-in, everyone is the demo admin (see lib/showcase/flag.ts).
  if (SHOWCASE) return SHOWCASE_ADMIN;
  if (DEMO_MODE) {
    const uid = getDemoSessionUserId();
    if (!uid) return null;
    const user = findDemoUserById(uid);
    return user ? toProfile(user) : null;
  }

  const supabase = createServerSupabaseClient();
  let user = null;
  let lastError: { message: string; status?: number } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await supabase.auth.getUser();
    user = res.data.user;
    lastError = res.error;
    // A rate limit (429) or a server hiccup is not "logged out": wait and try
    // again. Redirecting to /login here is what used to blank the dashboard.
    const temporary = !!res.error && (res.error.status === 429 || (res.error.status ?? 0) >= 500);
    if (!temporary) break;
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  if (!user && lastError && (lastError.status === 429 || (lastError.status ?? 0) >= 500)) {
    throw new Error(`Could not check your sign-in: ${lastError.message}`);
  }
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile ?? null;
});
