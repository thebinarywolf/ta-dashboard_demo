import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth/current-user";
import { canMarkHotPositions, setHotPosition } from "@/lib/metrics/hot-positions";

/** Admins, recruiters and Pro Viewers: mark a position as hot (or take the flame off). */
export async function POST(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!canMarkHotPositions(profile)) {
    return NextResponse.json({ error: "Only admins, recruiters and Pro Viewers can mark hot positions" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const positionId = typeof body?.positionId === "string" ? body.positionId.trim() : "";
  const hot = body?.hot;

  if (!positionId || typeof hot !== "boolean") {
    return NextResponse.json({ error: "positionId (string) and hot (boolean) are required" }, { status: 400 });
  }

  try {
    await setHotPosition(positionId, hot, profile.email);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
