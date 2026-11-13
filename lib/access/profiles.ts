import { DEMO_MODE } from "@/lib/demo/config";
import { listDemoUsers } from "@/lib/demo/store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

/** Every user's profile, newest request first — demo store or Supabase. */
export async function listAllProfiles(): Promise<Profile[]> {
  if (DEMO_MODE) return listDemoUsers();

  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("requested_at", { ascending: false });
  return data ?? [];
}
