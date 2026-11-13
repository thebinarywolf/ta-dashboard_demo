"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CONFIGURABLE_ROLES, DASHBOARD_TABS, type ConfigurableRole } from "@/lib/access/tabs";
import GlassCard, { GLASS_PANEL } from "@/components/glass-card";
import { roleLabel } from "@/lib/access/roles";
import ScrollTable from "@/components/scroll-table";

export default function TabPermissionsTable({
  visibleTabsByRole,
}: {
  visibleTabsByRole: Record<ConfigurableRole, string[]>;
}) {
  const router = useRouter();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (role: ConfigurableRole, tabKey: string, checked: boolean) => {
    const current = visibleTabsByRole[role];
    const next = checked
      ? [...current, tabKey]
      : current.filter((k) => k !== tabKey);

    const key = `${role}:${tabKey}`;
    setPendingKey(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/tab-permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, tabKeys: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Failed to update");
        return;
      }
      router.refresh();
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <div>
      <ScrollTable className={`${GLASS_PANEL}`}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Tab</th>
              {CONFIGURABLE_ROLES.map((role) => (
                <th key={role} className="px-4 py-3">
                  {roleLabel(role)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DASHBOARD_TABS.map((tab) => (
              <tr key={tab.key} className="border-b border-slate-200/50 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{tab.label}</td>
                {CONFIGURABLE_ROLES.map((role) => {
                  const key = `${role}:${tab.key}`;
                  return (
                    <td key={key} className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={visibleTabsByRole[role].includes(tab.key)}
                        disabled={pendingKey === key}
                        onChange={(e) => toggle(role, tab.key, e.target.checked)}
                        className="h-4 w-4 accent-brand-blue disabled:opacity-50"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollTable>
      <p className="mt-2 text-xs text-slate-400">
        Admins always see every tab regardless of this table. Unchecking every
        tab for a role leaves that role with an &quot;access restricted&quot;
        message instead of a dashboard.
      </p>
      {error && <p className="mt-1 text-xs text-sla-breach">{error}</p>}
    </div>
  );
}
