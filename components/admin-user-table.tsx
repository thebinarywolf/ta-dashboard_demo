"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ALL_ROLES as ROLES, roleLabel } from "@/lib/access/roles";
import type { Profile } from "@/lib/supabase/types";
import ScrollTable from "@/components/scroll-table";

export default function AdminUserTable({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const callApi = async (userId: string, action: string, role?: string) => {
    setPendingId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body?.error ?? "Action failed");
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  const deleteUser = (p: Profile) => {
    const who = p.full_name ? `${p.full_name} (${p.email})` : p.email;
    if (
      !window.confirm(
        `Delete ${who} permanently?

They will lose access straight away and would need to sign up again to come back. This cannot be undone.`
      )
    ) {
      return;
    }
    void callApi(p.id, "delete");
  };

  return (
    <ScrollTable>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Requested</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id} className="border-b border-slate-200/50 last:border-0">
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{p.full_name ?? p.email}</div>
                <div className="text-xs text-slate-400">{p.email}</div>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {new Date(p.requested_at).toLocaleDateString("en-IN")}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    p.status === "approved"
                      ? "bg-green-50 text-sla-ok"
                      : p.status === "revoked"
                        ? "bg-red-50 text-sla-breach"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {p.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <select
                  value={p.role}
                  disabled={pendingId === p.id || p.status !== "approved"}
                  onChange={(e) => callApi(p.id, "setRole", e.target.value)}
                  className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-sm disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {p.status !== "approved" && (
                    <button
                      onClick={() => callApi(p.id, "approve")}
                      disabled={pendingId === p.id}
                      className="rounded-full bg-brand-blue px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-blue-dark disabled:opacity-50"
                    >
                      Approve
                    </button>
                  )}
                  {p.status !== "revoked" && (
                    <button
                      onClick={() => callApi(p.id, "revoke")}
                      disabled={pendingId === p.id}
                      className="rounded-full border border-slate-300 bg-white/70 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  )}
                  {p.id !== currentUserId && (
                    <button
                      onClick={() => deleteUser(p)}
                      disabled={pendingId === p.id}
                      className="rounded-full border border-red-200 bg-white/70 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {profiles.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                No users yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </ScrollTable>
  );
}
