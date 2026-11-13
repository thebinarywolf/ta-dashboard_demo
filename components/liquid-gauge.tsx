import { useId } from "react";

/**
 * A small glass that fills with liquid to show how many of a position's seats
 * are taken (people joined or yet to join) out of the seats it needs. The
 * surface ripples, so a full glass looks different from an empty one at a glance.
 */
export default function LiquidGauge({ filled, seats, size = 46 }: { filled: number; seats: number; size?: number }) {
  const clipId = `lg-${useId().replace(/:/g, "")}`;
  const level = seats > 0 ? Math.min(1, Math.max(0, filled / seats)) : 0;
  const full = level >= 1;
  // The glass is 44 high inside; the liquid surface sits at this y.
  const top = 3 + 38 * (1 - level);
  const wave = "M-40 0 q10 -4 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V50 H-40 z";
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} className="shrink-0" role="img" aria-label={`${filled} of ${seats} filled`}>
      <defs>
        <clipPath id={clipId}>
          <circle cx="22" cy="22" r="19" />
        </clipPath>
      </defs>
      <circle cx="22" cy="22" r="19" fill="#fff" />
      {level > 0 && (
        <g clipPath={`url(#${clipId})`}>
          <g transform={`translate(0 ${top})`}>
            <path className="liquid-wave-back" d={wave} fill="#5b8def" opacity={0.55} />
            <path className="liquid-wave" d={wave} fill="#1e50cc" />
          </g>
        </g>
      )}
      <circle cx="22" cy="22" r="19" fill="none" stroke="#1e50cc" strokeOpacity={full ? 0.9 : 0.35} strokeWidth="2" />
      <text
        x="22"
        y="26"
        textAnchor="middle"
        fontSize="12"
        fontWeight="800"
        fill={full ? "#fff" : "#0e1b3d"}
        stroke={full ? "#1e50cc" : "#fff"}
        strokeWidth="2.2"
        paintOrder="stroke"
      >
        {filled}/{seats}
      </text>
    </svg>
  );
}
