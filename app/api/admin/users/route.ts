import { NextResponse, type NextRequest } from "next/server";
import { requireAdminOrResponse } from "@/lib/auth/api-guards";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { DEMO_MODE } from "@/lib/demo/config";
import { deleteDemoUser, findDemoUserById, updateDemoUser } from "@/lib/demo/store";
import { ALL_ROLES } from "@/lib/access/roles";
import type { UserRole } from "@/lib/supabase/types";

const VALID_ROLES: UserRole[] = ALL_ROLES;

export async function POST(request: NextRequest) {
  const admin = await requireAdminOrResponse();
  if (!admin.ok) return admin.response;

  const body = await request.json().catch(() => null);
  const userId: string | undefined = body?.userId;
  const action: string | undefined = body?.action;

  if (!userId || !action) {
    return NextResponse.json({ error: "userId and action are required" }, { status: 400 });
  }

  // Deleting is permanent, so it is refused for the admin's own account
  // (which also guarantees at least one admin always remains).
  if (action === "delete" && userId === admin.adminId) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  if (DEMO_MODE) {
    if (action === "delete") {
      if (!deleteDemoUser(userId)) {
        return NextResponse.json({ error: "User not found" }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }
    if (action === "approve") {
      const user = findDemoUserById(userId);
      if (!user || user.role !== "pending") {
        return NextResponse.json({ error: "User not found or not pending" }, { status: 400 });
      }
      updateDemoUser(userId, {
        status: "approved",
        role: "viewer",
        approved_at: new Date().toISOString(),
        approved_by: admin.adminId,
      });
      return NextResponse.json({ ok: true });
    }
    if (action === "revoke") {
      if (!findDemoUserById(userId)) {
        return NextResponse.json({ error: "User not found" }, { status: 400 });
      }
      updateDemoUser(userId, { status: "revoked" });
      return NextResponse.json({ ok: true });
    }
    if (action === "setRole") {
      const role: string | undefined = body?.role;
      if (!role || !VALID_ROLES.includes(role as UserRole)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 });
      }
      if (!findDemoUserById(userId)) {
        return NextResponse.json({ error: "User not found" }, { status: 400 });
      }
      updateDemoUser(userId, { role: role as UserRole });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  if (action === "delete") {
    // profiles.approved_by points at the approving admin, so clear any such
    // links first; otherwise deleting an admin who approved others would fail.
    const { error: unlinkError } = await supabase
      .from("profiles")
      .update({ approved_by: null })
      .eq("approved_by", userId);
    if (unlinkError) return NextResponse.json({ error: unlinkError.message }, { status: 500 });
    // Removing the sign-in account also removes the profile (on delete cascade).
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    const { error } = await supabase
      .from("profiles")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: admin.adminId,
        // Approving a still-pending user promotes them to viewer by default;
        // use setRole separately to grant recruiter/admin.
        role: "viewer",
      })
      .eq("id", userId)
      .eq("role", "pending");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "revoke") {
    const { error } = await supabase
      .from("profiles")
      .update({ status: "revoked" })
      .eq("id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "setRole") {
    const role: string | undefined = body?.role;
    if (!role || !VALID_ROLES.includes(role as UserRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    const { error } = await supabase
      .from("profiles")
      .update({ role: role as UserRole })
      .eq("id", userId);
    if (error) {
      const notSetUp = role === "pro_viewer" && /invalid input value for enum/i.test(error.message);
      return NextResponse.json(
        {
          error: notSetUp
            ? "Pro Viewer is not set up in the database yet. Run supabase/migrations/0010_pro_viewer_role.sql in the Supabase SQL Editor."
            : error.message,
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
