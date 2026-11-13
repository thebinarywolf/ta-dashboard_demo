/** The "W" mark with a spinning ring around it, used wherever the dashboard is loading. */
export default function LogoLoader({ size = 56 }: { size?: number }) {
  return (
    <span className="logo-loader" style={{ width: size, height: size }} aria-hidden="true">
      <span className="logo-loader-ring" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="" width={192} height={192} className="logo-loader-mark" />
    </span>
  );
}
