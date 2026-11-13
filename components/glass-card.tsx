export const GLASS_PANEL =
  "bg-white/60 backdrop-blur-xl border border-white/70 shadow-[0_10px_30px_rgba(30,80,204,0.10)] rounded-[22px]";

export default function GlassCard({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`${GLASS_PANEL} ${className}`}>{children}</div>;
}
