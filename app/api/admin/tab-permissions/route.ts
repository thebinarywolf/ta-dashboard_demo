import { NextResponse, type NextRequest } from "next/server";
import { requireAdminOrResponse } from "@/lib/auth/api-guards";
import { setVisibleTabKeys } from "@/lib/access/permissions";
import { CONFIGURABLE_ROLES, type ConfigurableRole } from "@/lib/access/tabs";

function isConfigurableRole(role: unknown): role is ConfigurableRole {
  return typeof role === "string" && (CONFIGURABLE_ROLES as readonly string[]).includes(role);
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminOrResponse();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null);
  const role = body?.role;
  const tabKeys = body?.tabKeys;

  if (!isConfigurableRole(role) || !Array.isArray(tabKeys)) {
    return NextResponse.json(
      { error: "role (viewer|recruiter) and tabKeys (string[]) are required" },
      { status: 400 }
    );
  }

  try {
    await setVisibleTabKeys(role, tabKeys);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to update" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
