import { cache } from "react";
import { AUTH_BACKEND } from "@/lib/data-source/config";
import { getDemoVisibleTabs, setDemoVisibleTabs } from "@/lib/demo/store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { CONFIGURABLE_ROLES, DASHBOARD_TAB_KEYS, type ConfigurableRole } from "./tabs";

function isConfigurableRole(role: string): role is ConfigurableRole {
  return (CONFIGURABLE_ROLES as readonly string[]).includes(role);
}

/**
 * Which dashboard tab keys a role can see. Admins bypass this entirely
 * (callers should check role === "admin" first and skip calling this) —
 * pending/revoked users never reach a dashboard page to begin with.
 */
export const getVisibleTabKeys = cache(async (role: string): Promise<string[]> => {
  if (!isConfigurableRole(role)) return [];

  if (AUTH_BACKEND === "local") {
    return getDemoVisibleTabs(role);
  }

  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("role_tab_permissions")
    .select("tab_key")
    .eq("role", role);
  return (data ?? []).map((row) => row.tab_key);
});

/** Every configurable role's visible tabs in one call, for the admin matrix. */
export async function getAllVisibleTabKeys(): Promise<Record<ConfigurableRole, string[]>> {
  const entries = await Promise.all(
    CONFIGURABLE_ROLES.map(async (role) => [role, await getVisibleTabKeys(role)] as const)
  );
  return Object.fromEntries(entries) as Record<ConfigurableRole, string[]>;
}

export async function setVisibleTabKeys(
  role: ConfigurableRole,
  tabKeys: string[]
): Promise<void> {
  const validKeys = tabKeys.filter((k) => DASHBOARD_TAB_KEYS.includes(k));

  if (AUTH_BACKEND === "local") {
    setDemoVisibleTabs(role, validKeys);
    return;
  }

  const supabase = createServiceRoleClient();
  const { error: deleteError } = await supabase.from("role_tab_permissions").delete().eq("role", role);
  if (deleteError) throw new Error(deleteError.message);
  if (validKeys.length > 0) {
    const { error } = await supabase
      .from("role_tab_permissions")
      .insert(validKeys.map((tab_key) => ({ role, tab_key })));
    if (error) {
      throw new Error(
        /check constraint/i.test(error.message)
          ? "This role is not set up in the database yet. Run supabase/migrations/0010_pro_viewer_role.sql in the Supabase SQL Editor."
          : error.message
      );
    }
  }
}
