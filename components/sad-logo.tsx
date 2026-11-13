/** The "W" mark looking sad under a rain cloud: shown when a page fails to load. */
export default function SadLogo({ size = 72 }: { size?: number }) {
  return (
    <div className="relative mx-auto flex flex-col items-center" style={{ width: size * 1.6 }} aria-hidden="true">
      <svg viewBox="0 0 120 70" width={size * 1.6} height={size * 0.93} className="-mb-2">
        <path
          d="M30 52h62a18 18 0 0 0 2-35.9A24 24 0 0 0 48 12a20 20 0 0 0-18 40z"
          fill="#cfe0fb"
          stroke="#1e50cc"
          strokeOpacity="0.35"
          strokeWidth="2"
        />
        {[44, 62, 80].map((x, i) => (
          <path
            key={x}
            d={`M${x} 56q-3 6 0 9q3-3 0-9z`}
            fill="#1e50cc"
            className="sad-drop"
            style={{ animationDelay: `${i * 0.45}s` }}
          />
        ))}
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="" width={192} height={192} className="sad-mark mt-6 rounded-[22%]" style={{ width: size, height: size }} />
    </div>
  );
}
