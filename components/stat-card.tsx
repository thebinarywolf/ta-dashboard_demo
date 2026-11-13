import { GLASS_PANEL } from "@/components/glass-card";

export default function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "breach";
}) {
  return (
    <div className={`${GLASS_PANEL} p-4`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-extrabold ${
          tone === "breach" ? "text-sla-breach" : "text-[#0e1b3d]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
