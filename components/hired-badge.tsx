"use client";

import { useState } from "react";

/**
 * The floating "people hired" badge on the Closed card. Front: one number
 * (hired this month). Back: a second number with its date range (hired
 * between the period's From and To dates). It flips by itself now and then;
 * clicking flips it by hand (and stops the automatic flipping).
 */
export default function HiredBadge({
  value,
  label,
  back,
}: {
  value: number;
  label: string;
  back?: { value: number; from: string; to: string };
}) {
  // null = flipping by itself; true/false = the side the user clicked to.
  const [manual, setManual] = useState<boolean | null>(null);

  const front = (
    <div className="flex flex-col items-center justify-center rounded-xl bg-brand-blue px-2.5 py-1.5 text-center text-white [backface-visibility:hidden] [grid-area:1/1]">
      <p className="text-base font-extrabold leading-none">{value}</p>
      <p className="mt-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-blue-100">{label}</p>
    </div>
  );

  if (!back) {
    return (
      <div className="hired-float absolute right-2 top-2 rounded-xl" title="Employees who joined this month">
        <div className="grid">{front}</div>
      </div>
    );
  }

  const showingBack = manual === true;
  return (
    <button
      type="button"
      onClick={() => setManual((m) => (m === null ? true : !m))}
      title={`${value} hired this month · ${back.value} hired from ${back.from} to ${back.to} (same as New joiners on the Attrition tab). Click to flip.`}
      aria-label={`${value} ${label}. ${back.value} hired from ${back.from} to ${back.to}. Click to flip.`}
      className="hired-float absolute right-2 top-2 cursor-pointer rounded-xl [perspective:600px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
    >
      <div
        className={`grid [transform-style:preserve-3d] ${
          manual === null ? "hired-flip" : "transition-transform duration-500 ease-in-out"
        }`}
        style={manual === null ? undefined : { transform: `rotateY(${showingBack ? 180 : 0}deg)` }}
      >
        {front}
        <div
          aria-hidden
          className="flex flex-col items-center justify-center rounded-xl border border-blue-200 bg-white px-2.5 py-1.5 text-center text-brand-blue [backface-visibility:hidden] [grid-area:1/1] [transform:rotateY(180deg)]"
        >
          <p className="text-base font-extrabold leading-none">{back.value}</p>
          {/* Kept short so the badge is no wider than its front and never
              grows over the people in the picture. */}
          <p className="mt-0.5 whitespace-nowrap text-[9px] font-bold uppercase leading-none tracking-wide text-slate-400">
            hired in range
          </p>
          <p className="mt-0.5 whitespace-nowrap text-[8px] font-semibold leading-none text-slate-400">
            {back.from} – {back.to}
          </p>
        </div>
      </div>
    </button>
  );
}
