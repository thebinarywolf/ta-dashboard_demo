import { GLASS_PANEL } from "@/components/glass-card";
import LogoLoader from "@/components/logo-loader";

function Bar({ className }: { className: string }) {
  return <div className={`rounded-full bg-brand-blue/10 ${className}`} />;
}

/** Shown instantly while a dashboard page's data loads, so a tab click never feels dead. */
export default function PageSkeleton() {
  return (
    <div className="page-skeleton space-y-8" role="status" aria-label="Loading">
      <div className="flex justify-center py-2">
        <LogoLoader size={52} />
      </div>
      <div className="animate-pulse space-y-8">
        <div className="space-y-2">
          <Bar className="h-5 w-48" />
          <Bar className="h-3 w-2/3 max-w-xl" />
        </div>

        <div className={`${GLASS_PANEL} h-20`} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${GLASS_PANEL} space-y-3 p-5`}>
              <Bar className="h-3 w-24" />
              <Bar className="h-9 w-20" />
              <Bar className="h-3 w-full" />
              <Bar className="h-3 w-5/6" />
            </div>
          ))}
        </div>

        <div className={`${GLASS_PANEL} space-y-3 p-5`}>
          <Bar className="h-4 w-40" />
          {[0, 1, 2, 3, 4].map((i) => (
            <Bar key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
