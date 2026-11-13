"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { roleLabel } from "@/lib/access/roles";

/**
 * The round initial in the top bar. Clicking it opens a small panel where the
 * signed-in person can change their own display name.
 */
export default function ProfileMenu({
  fullName,
  email,
  role,
  placement = "top-bar",
}: {
  fullName: string | null;
  email: string;
  role: string;
  /** "sidebar" opens the panel upwards, beside the left menu's footer. */
  placement?: "top-bar" | "sidebar";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(fullName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const initial = (fullName?.trim()[0] ?? email[0]).toUpperCase();

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Could not save");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          setName(fullName ?? "");
          setError(null);
          setSaved(false);
        }}
        aria-expanded={open}
        aria-label="Your profile: change your name"
        title="Change your name"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0e1b3d] text-sm font-bold text-white transition hover:ring-4 hover:ring-blue-200"
      >
        {initial}
      </button>

      {open && (
        <div
          className={`z-50 rounded-2xl border border-blue-100 bg-white p-4 shadow-xl ${
            placement === "sidebar"
              ? "fixed bottom-16 left-3 w-72 max-w-[calc(100vw-1.5rem)]"
              : "fixed left-3 right-3 top-[4.5rem] sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-72"
          }`}
        >
          <p className="truncate text-sm font-bold text-[#0e1b3d]">{fullName || email}</p>
          <p className="truncate text-xs text-slate-500">
            {email} · {roleLabel(role)}
          </p>
          <form onSubmit={save} className="mt-3 space-y-2">
            <label htmlFor="profile-name" className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Your name
            </label>
            <input
              id="profile-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              maxLength={80}
              autoFocus
              className="w-full rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-[#0e1b3d] outline-none focus:border-brand-blue"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs">
                {error ? (
                  <span role="alert" className="text-red-600">
                    {error}
                  </span>
                ) : saved ? (
                  <span className="text-brand-blue">Saved</span>
                ) : null}
              </span>
              <button
                type="submit"
                disabled={saving || !name.trim() || name.trim() === (fullName ?? "")}
                className="rounded-full bg-brand-blue px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-blue-dark disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
