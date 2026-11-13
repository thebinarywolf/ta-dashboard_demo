"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GLASS_PANEL } from "@/components/glass-card";

const FREQUENCIES = [1, 2, 3, 6, 12, 24];

function frequencyLabel(h: number): string {
  if (h === 24) return "Once a day";
  return h === 1 ? "Every hour" : `Every ${h} hours`;
}

/** Indian time, e.g. "23 Oct, 6:05 pm". */
function when(iso: string | null): string {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Admin panel control for automatic syncing: an on/off switch and how often.
 * Each change is saved straight away.
 */
export default function AutoSyncSettings({
  available,
  reason,
  enabled: initialEnabled,
  everyHours: initialEveryHours,
  nextAt,
  lastAutoRunAt,
  lastAutoStatus,
  lastAutoMessage,
  updatedBy,
}: {
  available: boolean;
  reason?: "local" | "not-set-up";
  enabled: boolean;
  everyHours: number;
  nextAt: string | null;
  lastAutoRunAt: string | null;
  lastAutoStatus: string | null;
  lastAutoMessage: string | null;
  updatedBy: string | null;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [everyHours, setEveryHours] = useState(initialEveryHours);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(nextEnabled: boolean, nextEveryHours: number) {
    const before = { enabled, everyHours };
    setEnabled(nextEnabled);
    setEveryHours(nextEveryHours);
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/auto-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled, everyHours: nextEveryHours }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not save");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setEnabled(before.enabled);
      setEveryHours(before.everyHours);
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${GLASS_PANEL} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[#0e1b3d]">Auto sync</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Pulls the Google Sheets, Qandle and the exit sheet automatically, so nobody has to click Sync now.
          </p>
        </div>

        {available && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label="Auto sync on or off"
              disabled={saving}
              onClick={() => save(!enabled, everyHours)}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
                enabled ? "bg-brand-blue" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className="w-7 text-sm font-bold text-[#0e1b3d]">{enabled ? "On" : "Off"}</span>
            <label className="sr-only" htmlFor="auto-sync-frequency">
              How often
            </label>
            <select
              id="auto-sync-frequency"
              value={everyHours}
              disabled={saving}
              onChange={(e) => save(enabled, Number(e.target.value))}
              className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-sm text-[#0e1b3d] outline-none focus:border-brand-blue disabled:opacity-60"
            >
              {FREQUENCIES.map((h) => (
                <option key={h} value={h}>
                  {frequencyLabel(h)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1 text-xs text-slate-500">
        {!available ? (
          reason === "local" ? (
            <p>Auto sync only works on the live site (with Supabase). Use Sync now here.</p>
          ) : (
            <p>
              One database step is needed first: run <code>supabase/migrations/0011_auto_sync.sql</code> in the
              Supabase SQL Editor, then refresh this page.
            </p>
          )
        ) : enabled ? (
          <>
            <p>
              <span className="font-semibold text-[#0e1b3d]">{frequencyLabel(everyHours)}.</span> Next sync around{" "}
              <span className="font-semibold text-[#0e1b3d]">{when(nextAt)}</span> (Indian time).
            </p>
            <p>
              Last automatic sync: {when(lastAutoRunAt)}
              {lastAutoStatus && (
                <>
                  {" "}
                  · <span className={lastAutoStatus === "error" ? "text-red-600" : "text-brand-blue"}>{lastAutoStatus}</span>
                  {lastAutoMessage ? ` · ${lastAutoMessage}` : ""}
                </>
              )}
            </p>
          </>
        ) : (
          <p>Off. Data only updates when someone clicks Sync now.</p>
        )}
        {available && updatedBy && <p className="text-slate-400">Last changed by {updatedBy}</p>}
        {saved && !error && <p className="font-semibold text-brand-blue">Saved</p>}
        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
