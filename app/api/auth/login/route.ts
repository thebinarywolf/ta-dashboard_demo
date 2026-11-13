import { NextResponse, type NextRequest } from "next/server";
import { DEMO_MODE } from "@/lib/demo/config";
import { findDemoUserByEmail } from "@/lib/demo/store";
import { setDemoSessionCookie } from "@/lib/demo/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email: string | undefined = body?.email?.trim();
  const password: string | undefined = body?.password;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  if (DEMO_MODE) {
    const user = findDemoUserByEmail(email);
    if (!user || user.password !== password) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    setDemoSessionCookie(user.id);
    return NextResponse.json({ ok: true });
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
