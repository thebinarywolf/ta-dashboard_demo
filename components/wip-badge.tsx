"use client";

import { usePathname } from "next/navigation";

/** Tabs that are shown but not finished, so people know to expect changes. */
const WIP_PATHS = ["/dashboard/attrition-insights", "/dashboard/recruiters-insights", "/dashboard/dropouts", "/dashboard/report", "/dashboard/funnel"];

/** A little building going up under a swinging crane. */
function ConstructionScene() {
  const floors = [66, 50, 34];
  return (
    <svg viewBox="0 0 120 90" aria-hidden className="h-full w-full">
      {/* ground */}
      <line x1="4" y1="82" x2="116" y2="82" stroke="#93b4f2" strokeWidth="3" strokeLinecap="round" />
      {/* the floor still to come */}
      <rect x="14" y="18" width="48" height="16" rx="2" fill="none" stroke="#93b4f2" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* floors going up, one after another */}
      {floors.map((y, i) => (
        <g key={y} className="wip-floor" style={{ animationDelay: `${i * 0.7}s` }}>
          <rect x="14" y={y} width="48" height="16" rx="2" fill="#dbe8fb" stroke="#1e50cc" strokeWidth="1.5" />
          {[20, 34, 48].map((x) => (
            <rect key={x} x={x} y={y + 4} width="8" height="8" rx="1" fill="#1e50cc" opacity="0.85" />
          ))}
        </g>
      ))}
      {/* crane: mast, jib, counterweight */}
      <rect x="85" y="12" width="5" height="70" fill="#1e50cc" />
      <path d="M85 80 90 66 85 52 90 38 85 24 M90 80 85 66 90 52 85 38 90 24" stroke="#fff" strokeWidth="1" fill="none" />
      <rect x="38" y="9" width="74" height="4" fill="#1e50cc" />
      <rect x="99" y="13" width="9" height="9" fill="#60a5fa" />
      <path d="M88 2 79 9h18Z" fill="#1e50cc" />
      {/* hook and load, swinging */}
      <g className="wip-swing">
        <line x1="50" y1="13" x2="50" y2="33" stroke="#1e50cc" strokeWidth="1.5" />
        <rect x="43" y="33" width="14" height="8" rx="1.5" fill="#60a5fa" stroke="#1e50cc" strokeWidth="1.5" />
      </g>
      {/* warning light on top of the crane */}
      <circle cx="88" cy="1.5" r="1.8" fill="#fff" className="wip-blink" />
    </svg>
  );
}

/**
 * A "Work in progress" card with a construction scene at the top right of the
 * screen, on the tabs that are still being built. It ignores clicks so it never
 * blocks anything underneath it.
 */
export default function WipBadge() {
  const pathname = usePathname();
  if (!WIP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed right-3 top-[4.75rem] z-30 flex w-52 items-center gap-2.5 rounded-2xl border border-blue-100 bg-white/95 py-2 pl-2 pr-3.5 shadow-xl backdrop-blur sm:right-5 sm:top-[5.5rem] sm:w-64 sm:gap-3 sm:pl-3"
    >
      <div className="h-14 w-[4.5rem] shrink-0 sm:h-[4.5rem] sm:w-24">
        <ConstructionScene />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-extrabold uppercase leading-tight tracking-wide text-brand-blue sm:text-base">
          Work in progress
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Still being built. Numbers and layout may change.</p>
      </div>
    </div>
  );
}
