// Local-only, in-memory demo user store. NOT connected to Supabase and NOT
// how real users/passwords are stored once the app is wired up for real —
// see docs in README.md. Exists only so the signup -> pending -> admin
// approval flow can be clicked through before Supabase is set up.
//
// Node-runtime only (uses globalThis as a singleton) — never import this
// from middleware.ts, which runs in the Edge runtime and would not
// reliably share this state. See lib/auth/current-user.ts for the
// Node-side reads and middleware.ts for the Edge-side cookie-presence-only
// check.
import { DEFAULT_VISIBLE_TAB_KEYS, type ConfigurableRole } from "@/lib/access/tabs";
import type { Profile, UserRole, UserStatus } from "@/lib/supabase/types";
import { SHOWCASE, SHOWCASE_LOGINS } from "@/lib/showcase/flag";

type DemoUser = Profile & { password: string };

declare global {
  // eslint-disable-next-line no-var
  var __demoUsers: DemoUser[] | undefined;
  // eslint-disable-next-line no-var
  var __demoTabPermissions: Record<ConfigurableRole, string[]> | undefined;
}

function seedShowcase(): DemoUser[] {
  const now = Date.now();
  const at = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();
  const users: DemoUser[] = SHOWCASE_LOGINS.map((l, i) => ({
    id: i === 0 ? "demo-admin" : `demo-${l.role}`,
    email: l.email,
    full_name: l.fullName,
    role: l.role,
    status: "approved",
    requested_at: at(60 * 24 * (30 - i)),
    approved_at: at(60 * 24 * (30 - i) - 5),
    approved_by: "demo-admin",
    password: l.password,
  }));
  // Two people waiting for approval, so the Admin approval flow can be shown.
  // They cannot sign in (no usable password).
  for (const [i, name] of ["Nisha Rao", "Varun Shetty"].entries()) {
    users.push({
      id: `demo-pending-${i}`,
      email: `${name.toLowerCase().replace(" ", ".")}@example.com`,
      full_name: name,
      role: "pending",
      status: "pending",
      requested_at: at(90 + i * 300),
      approved_at: null,
      approved_by: null,
      password: `\u0000no-login-${Math.random()}`,
    });
  }
  return users;
}

function seed(): DemoUser[] {
  if (SHOWCASE) return seedShowcase();
  const now = new Date().toISOString();
  return [
    {
      id: "demo-admin",
      email: "alex.morgan@example.com",
      full_name: "Alex Morgan",
      role: "admin",
      status: "approved",
      requested_at: now,
      approved_at: now,
      approved_by: "demo-admin",
      // Seeded as given for local demo login only. This has no bearing on
      // any real account — when Supabase is set up for real, you choose
      // your own password during signup.
      password: "sample1234",
    },
  ];
}

// globalThis (not a module-level const) so the store survives Next.js
// dev-server hot-reload module re-evaluation.
function db(): DemoUser[] {
  if (!globalThis.__demoUsers) globalThis.__demoUsers = seed();
  return globalThis.__demoUsers;
}

export function toProfile(user: DemoUser): Profile {
  const { password: _password, ...profile } = user;
  return profile;
}

export function listDemoUsers(): Profile[] {
  return db()
    .slice()
    .sort((a, b) => b.requested_at.localeCompare(a.requested_at))
    .map(toProfile);
}

export function findDemoUserByEmail(email: string): DemoUser | undefined {
  const normalized = email.trim().toLowerCase();
  return db().find((u) => u.email.toLowerCase() === normalized);
}

export function findDemoUserById(id: string): DemoUser | undefined {
  return db().find((u) => u.id === id);
}

export function createDemoUser(
  email: string,
  password: string,
  fullName: string | null
): DemoUser {
  const now = new Date().toISOString();
  const user: DemoUser = {
    id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    email: email.trim(),
    full_name: fullName,
    role: "pending",
    status: "pending",
    requested_at: now,
    approved_at: null,
    approved_by: null,
    password,
  };
  db().push(user);
  return user;
}

export function updateDemoUser(
  id: string,
  changes: Partial<Pick<DemoUser, "role" | "status" | "approved_at" | "approved_by" | "full_name">>
): DemoUser | undefined {
  const user = findDemoUserById(id);
  if (!user) return undefined;
  Object.assign(user, changes);
  return user;
}

export function deleteDemoUser(id: string): boolean {
  const users = db();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return false;
  users.splice(index, 1);
  return true;
}

// Role -> visible tab keys, in-memory (same globalThis pattern as the user
// store above, for the same reason: survives dev-server hot reload, resets
// on process restart). Defaults to every non-sensitive tab visible for both
// roles, so nothing changes for anyone until an admin edits this from /admin.
function tabPermissionsDb(): Record<ConfigurableRole, string[]> {
  if (!globalThis.__demoTabPermissions) {
    globalThis.__demoTabPermissions = {
      viewer: [...DEFAULT_VISIBLE_TAB_KEYS],
      pro_viewer: [...DEFAULT_VISIBLE_TAB_KEYS],
      recruiter: [...DEFAULT_VISIBLE_TAB_KEYS],
    };
  }
  // A store created before Pro Viewer existed (dev-server hot reload) lacks it.
  globalThis.__demoTabPermissions.pro_viewer ??= [...globalThis.__demoTabPermissions.viewer];
  return globalThis.__demoTabPermissions;
}

export function getDemoVisibleTabs(role: ConfigurableRole): string[] {
  return tabPermissionsDb()[role];
}

export function setDemoVisibleTabs(role: ConfigurableRole, tabKeys: string[]): void {
  tabPermissionsDb()[role] = tabKeys;
}

export type { UserRole, UserStatus };
