import { NextResponse } from "next/server";
import { requireAdminOrResponse } from "@/lib/auth/api-guards";
import { runFullSync, SHOWCASE_SYNC_OFF } from "@/lib/sync/run-full-sync";
import { SHOWCASE } from "@/lib/showcase/flag";

export async function POST() {
  const admin = await requireAdminOrResponse();
  if (!admin.ok) return admin.response;
  if (SHOWCASE) return NextResponse.json({ error: SHOWCASE_SYNC_OFF }, { status: 403 });

  const allResults = await runFullSync();
  const hasError = allResults.some((r) => r.status === "error");
  return NextResponse.json(
    { results: allResults },
    { status: hasError ? 207 : 200 }
  );
}
