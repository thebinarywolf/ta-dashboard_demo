import type { UserRole } from "@/lib/supabase/types";

/** Every role, in the order the Admin panel lists them. */
export const ALL_ROLES: UserRole[] = ["pending", "viewer", "pro_viewer", "recruiter", "admin"];

/** How each role is written on screen. */
export const ROLE_LABELS: Record<UserRole, string> = {
  pending: "Pending",
  viewer: "Viewer",
  pro_viewer: "Pro Viewer",
  recruiter: "Recruiter",
  admin: "Admin",
};

export const roleLabel = (role: string): string => ROLE_LABELS[role as UserRole] ?? role;
