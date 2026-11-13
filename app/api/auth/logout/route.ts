import { NextResponse } from "next/server";
import { DEMO_MODE } from "@/lib/demo/config";
import { clearDemoSessionCookie } from "@/lib/demo/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  if (DEMO_MODE) {
    clearDemoSessionCookie();
    return NextResponse.json({ ok: true });
  }

  const supabase = createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
