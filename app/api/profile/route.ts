import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { DEMO_MODE } from "@/lib/demo/config";
import { updateDemoUser } from "@/lib/demo/store";
import { createServiceRoleClient } from "@/lib/supabase/service";

const MAX_NAME_LENGTH = 80;

/**
 * Anyone signed in can change their OWN display name (the "Welcome back, …"
 * name). The account is always taken from the session, never from the
 * request, so nobody can rename someone else through this.
 */
export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim().replace(/\s+/g, " ") : "";
  if (!fullName) return NextResponse.json({ error: "Please enter a name" }, { status: 400 });
  if (fullName.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: `Keep the name under ${MAX_NAME_LENGTH} characters` }, { status: 400 });
  }

  if (DEMO_MODE) {
    updateDemoUser(profile.id, { full_name: fullName });
    return NextResponse.json({ ok: true });
  }

  // Users cannot write their profile row directly (no RLS update policy), so
  // the change goes through the service-role client, limited to their own row.
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
