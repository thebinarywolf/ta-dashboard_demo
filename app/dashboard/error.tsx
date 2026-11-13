"use client";

import { useEffect } from "react";
import { GLASS_PANEL } from "@/components/glass-card";
import SadLogo from "@/components/sad-logo";

/**
 * Shown inside the page frame (the top menu stays) when a dashboard page fails
 * to load, instead of leaving a blank screen. "Try again" re-runs the page.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={`${GLASS_PANEL} mx-auto max-w-lg space-y-3 p-8 text-center`} role="alert">
      <SadLogo />
      <h1 className="pt-4 text-lg font-extrabold text-[#0e1b3d]">Oops, this page could not load</h1>
      <p className="text-sm text-slate-500">
        The data did not come back this time. Please try again. If it keeps happening, tell the admin and mention the
        code below.
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400">
          Code: <span className="font-mono">{error.digest}</span>
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="rounded-full bg-brand-blue px-5 py-2 text-sm font-bold text-white hover:bg-brand-blue-dark"
      >
        Try again
      </button>
    </div>
  );
}
