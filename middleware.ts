import { type NextRequest, NextResponse } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";
import { DEMO_MODE, DEMO_SESSION_COOKIE } from "@/lib/demo/config";
import { SHOWCASE } from "@/lib/showcase/flag";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (SHOWCASE) {
    // The showcase copy has no sign-in: everyone is the demo admin
    // (lib/auth/current-user.ts), so the sign-in page just goes to the dashboard.
    if (pathname.startsWith("/login") || pathname.startsWith("/pending")) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (DEMO_MODE) {
    // Demo mode's user store lives in Node-process memory (lib/demo/store.ts)
    // and isn't reliably shared with the Edge runtime middleware executes
    // in, so middleware only checks whether a session cookie exists at all.
    // The authoritative pending/admin/role routing happens server-side in
    // lib/auth/guards.ts (Server Components) and lib/auth/api-guards.ts
    // (Route Handlers), both Node runtime with real access to the store.
    //
    // Deliberately NOT redirecting away from /login just because a cookie
    // is present: the cookie can reference a user that no longer exists
    // (e.g. the in-memory store reset on a dev-server restart), in which
    // case lib/auth/guards.ts sends an authenticated-but-unknown user back
    // to /login — redirecting away from /login here too would loop forever.
    const hasSession = request.cookies.has(DEMO_SESSION_COOKIE);

    if (!hasSession && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  const { supabase, response } = createMiddlewareClient(request);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  // The sign-in service said "slow down" (429) or had a hiccup: that is not a
  // signed-out visitor. Let the request through; the page checks again and
  // shows an error screen if it still cannot confirm who you are.
  if (!user && authError && (authError.status === 429 || (authError.status ?? 0) >= 500)) {
    return response;
  }

  if (!user) {
    if (isPublic) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Only the sign-in / waiting pages need the profile here (to bounce signed-in
  // users onward). Every other page re-checks status and role itself in
  // lib/auth/guards.ts, so a second database round trip on every click is wasted.
  if (!pathname.startsWith("/login") && !pathname.startsWith("/pending")) return response;

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, role")
    .eq("id", user.id)
    .single();

  const status = profile?.status ?? "pending";
  const role = profile?.role ?? "pending";

  if (status !== "approved") {
    if (pathname.startsWith("/pending")) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/pending";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" || pathname === "/pending") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Excludes anything under _next/api, plus any request whose last path
  // segment has a file extension (logo.svg, robots.txt, etc.) — public/
  // assets need to load even for signed-out visitors (e.g. the logo on the
  // login page itself), and gating them here doesn't protect anything since
  // they're static files, not data.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.[\\w]+$).*)",
  ],
};
