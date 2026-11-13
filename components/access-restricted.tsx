import { GLASS_PANEL } from "@/components/glass-card";

export default function AccessRestricted() {
  return (
    <div className={`${GLASS_PANEL} p-8 text-center`}>
      <h1 className="text-lg font-bold text-[#0e1b3d]">Access restricted</h1>
      <p className="mt-2 text-sm text-slate-500">
        Your role doesn&apos;t have access to this page. Ask an admin if you
        think this is a mistake.
      </p>
    </div>
  );
}
