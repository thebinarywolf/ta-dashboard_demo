import { NextResponse, type NextRequest } from "next/server";
import { DEMO_MODE } from "@/lib/demo/config";
import { createDemoUser, findDemoUserByEmail } from "@/lib/demo/store";
import { setDemoSessionCookie } from "@/lib/demo/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email: string | undefined = body?.email?.trim();
  const password: string | undefined = body?.password;
  const fullName: string | null = body?.fullName?.trim() || null;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  if (DEMO_MODE) {
    if (findDemoUserByEmail(email)) {
      return NextResponse.json({ error: "An account with that email already exists" }, { status: 400 });
    }
    const user = createDemoUser(email, password, fullName);
    setDemoSessionCookie(user.id);
    return NextResponse.json({ ok: true });
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // If email confirmation is enabled in Supabase, signUp succeeds but
  // returns no session until the user clicks the confirmation link.
  return NextResponse.json({ ok: true, needsEmailConfirmation: !data.session });
}
