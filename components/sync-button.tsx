"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SyncButton({
  lastSyncedAt,
  lastSyncStatus,
}: {
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSync = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST" });
      const body = await res.json();
      if (!res.ok && res.status !== 207) {
        throw new Error(body?.error ?? "Sync failed");
      }
      const failed = body.results?.filter((r: { status: string }) => r.status === "error");
      if (failed?.length) {
        setError(`${failed.length} tab(s) failed to sync — check server logs.`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-right">
      <button
        onClick={runSync}
        disabled={loading}
        className="rounded-full bg-brand-blue px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-blue-dark disabled:opacity-50"
      >
        {loading ? "Syncing..." : "Sync now"}
      </button>
      <p className="mt-1 text-xs text-slate-400">
        {lastSyncedAt
          ? `Last sync: ${new Date(lastSyncedAt).toLocaleString("en-IN")} (${lastSyncStatus})`
          : "Never synced"}
      </p>
      {error && <p className="mt-1 text-xs text-sla-breach">{error}</p>}
    </div>
  );
}
