import { getCurrentProfile } from "@/lib/auth/current-user";
import { listAllProfiles } from "@/lib/access/profiles";
import { getLastSyncInfo } from "@/lib/metrics/sync-status";
import { getAllVisibleTabKeys } from "@/lib/access/permissions";
import { getAutoSyncSettings, nextAutoSyncAt } from "@/lib/sync/auto-sync";
import AdminUserTable from "@/components/admin-user-table";
import SyncButton from "@/components/sync-button";
import AutoSyncSettings from "@/components/auto-sync-settings";
import TabPermissionsTable from "@/components/tab-permissions-table";
import GlassCard from "@/components/glass-card";

export default async function AdminPage() {
  // Admin-only access is already enforced by app/admin/layout.tsx.
  const [me, profiles, lastSync, visibleTabsByRole, autoSync] = await Promise.all([
    getCurrentProfile(),
    listAllProfiles(),
    getLastSyncInfo(),
    getAllVisibleTabKeys(),
    getAutoSyncSettings(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#0e1b3d]">Admin</h1>
          <p className="text-sm text-slate-500">
            Approve access requests, assign roles, and trigger a sheet sync.
          </p>
        </div>
        <SyncButton
          lastSyncedAt={lastSync?.finished_at ?? null}
          lastSyncStatus={lastSync?.status ?? null}
        />
      </div>

      <AutoSyncSettings
        available={autoSync.available}
        reason={autoSync.reason}
        enabled={autoSync.enabled}
        everyHours={autoSync.everyHours}
        nextAt={
          autoSync.available && autoSync.enabled
            ? nextAutoSyncAt(autoSync.lastSyncFinishedAt, autoSync.everyHours).toISOString()
            : null
        }
        lastAutoRunAt={autoSync.lastAutoRunAt}
        lastAutoStatus={autoSync.lastAutoStatus}
        lastAutoMessage={autoSync.lastAutoMessage}
        updatedBy={autoSync.updatedBy}
      />

      <GlassCard>
        <AdminUserTable profiles={profiles} currentUserId={me?.id ?? null} />
      </GlassCard>

      <div>
        <h2 className="text-sm font-bold text-[#0e1b3d]">Tab access by role</h2>
        <p className="mt-1 text-sm text-slate-500">
          Which dashboard tabs each role can see. Admins always see every tab.
        </p>
        <div className="mt-3">
          <TabPermissionsTable visibleTabsByRole={visibleTabsByRole} />
        </div>
      </div>
    </div>
  );
}
