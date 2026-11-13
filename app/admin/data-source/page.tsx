import { dataSources, getSpreadsheetId } from "@/config/data-sources";
import { AUTH_BACKEND, WRITE_BACKEND } from "@/lib/data-source/config";
import { resolveDataBackend } from "@/lib/data-source/resolve";
import { getTableRowCounts } from "@/lib/local-db/queries";
import { getLastSyncInfo } from "@/lib/metrics/sync-status";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import GlassCard, { GLASS_PANEL } from "@/components/glass-card";
import StatCard from "@/components/stat-card";
import ScrollTable from "@/components/scroll-table";
import { SHOWCASE } from "@/lib/showcase/flag";

const TABLE_LABELS: Record<string, string> = {
  positions: "positions",
  candidate_feedback: "candidate_feedback",
  upcoming_joiners: "upcoming_joiners",
  drop_outs: "drop_outs",
};

// Not a security measure (the anon key is public by design) — just keeps a
// 200+ char JWT from blowing out the table layout.
function truncateForDisplay(value: string, max = 40): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function CredentialRow({
  label,
  value,
  configured,
  sensitive,
}: {
  label: string;
  value: string | null;
  configured: boolean;
  sensitive: boolean;
}) {
  return (
    <tr className="border-b border-slate-200/50 last:border-0">
      <td className="px-4 py-3 font-medium text-slate-900">{label}</td>
      <td className="px-4 py-3 text-slate-600">
        {sensitive ? (
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              configured ? "bg-green-50 text-sla-ok" : "bg-slate-100 text-slate-500"
            }`}
          >
            {configured ? "Configured (hidden)" : "Not set"}
          </span>
        ) : configured ? (
          <code className="text-xs">{truncateForDisplay(value!)}</code>
        ) : (
          <span className="text-slate-400">Not set</span>
        )}
      </td>
    </tr>
  );
}

export default async function DataSourcePage() {
  if (SHOWCASE) {
    // Never show the real sheet ID, Supabase address or which secrets exist.
    const counts = getTableRowCounts();
    const lastSync = await getLastSyncInfo();
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-lg font-bold text-[#0e1b3d]">Data source</h1>
          <p className="text-sm text-slate-500">
            In the real dashboard this page shows where the data comes from: the TA tracker Google Sheet (through
            Apps Script), the Qandle HR system and the HR exits sheet, all copied into a Supabase database by Sync now
            or the hourly automatic sync. In this showcase copy every row below was generated, and nothing is
            connected to any real system.
          </p>
        </div>
        <ScrollTable className={`${GLASS_PANEL}`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Table</th>
                <th className="px-4 py-3">Made-up rows</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(counts).map(([table, count]) => (
                <tr key={table} className="border-b border-slate-200/50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900"><code className="text-xs">{table}</code></td>
                  <td className="px-4 py-3 text-slate-600">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <p className="text-sm text-slate-500">
          {lastSync ? `Sample "last sync": ${new Date(lastSync.finished_at ?? "").toLocaleString("en-IN")}.` : null}
        </p>
      </div>
    );
  }
  const source = dataSources[0];
  const backend = resolveDataBackend();

  let rowCounts: Record<string, number> = {};
  if (WRITE_BACKEND === "sqlite") {
    rowCounts = getTableRowCounts();
  } else {
    const supabase = createServerSupabaseClient();
    for (const tab of source.tabs) {
      const { count } = await supabase
        .from(tab.targetTable)
        .select("*", { count: "exact", head: true });
      rowCounts[tab.targetTable] = count ?? 0;
    }
    const { count: employeeCount } = await supabase
      .from("employees")
      .select("*", { count: "exact", head: true });
    rowCounts.employees = employeeCount ?? 0;
  }
  const lastSync = await getLastSyncInfo();

  let spreadsheetId: string | null = null;
  try {
    spreadsheetId = getSpreadsheetId(source);
  } catch {
    spreadsheetId = null;
  }

  const googleEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null;
  const googleKeyConfigured = !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
  const supabaseServiceKeyConfigured = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-[#0e1b3d]">Data source</h1>
        <p className="text-sm text-slate-500">
          Where this dashboard&apos;s data and credentials actually come from.
          Secret values (private keys, service-role keys) are never shown —
          only whether they&apos;re configured — since anything on this page
          could end up in a screenshot or screen-share.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-bold text-[#0e1b3d]">Current mode</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-2">
          <StatCard label="Data backend" value={backend} />
          <StatCard label="Auth backend" value={AUTH_BACKEND} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-bold text-[#0e1b3d]">Google Sheet</h2>
        <p className="mt-1 text-sm text-slate-500">
          {spreadsheetId ? (
            <>
              Spreadsheet ID:{" "}
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="text-brand-blue underline"
              >
                {spreadsheetId}
              </a>
            </>
          ) : (
            "No spreadsheet configured."
          )}
        </p>
        <ScrollTable outerClassName="mt-3" className={`${GLASS_PANEL}`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200/70 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Sheet tab</th>
                <th className="px-4 py-3">Synced into</th>
                <th className="px-4 py-3">Rows currently loaded</th>
              </tr>
            </thead>
            <tbody>
              {source.tabs.map((tab) => (
                <tr key={tab.tabName} className="border-b border-slate-200/50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{tab.tabName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <code className="text-xs">{TABLE_LABELS[tab.targetTable]}</code>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {rowCounts[tab.targetTable] ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <p className="mt-2 text-xs text-slate-400">
          Joined across tabs on <code>Position ID</code> — see{" "}
          <code>docs/join-keys.md</code> for the full convention.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-bold text-[#0e1b3d]">Sync method &amp; credentials</h2>
        <p className="mt-1 text-sm text-slate-500">
          {WRITE_BACKEND === "sqlite"
            ? "Reads the sheet's public CSV export — no credentials required, but relies on the sheet being shared as \"Anyone with the link can view.\""
            : "Reads via the authenticated Google Sheets API using the service account below."}
        </p>
        <ScrollTable outerClassName="mt-3" className={`${GLASS_PANEL}`}>
          <table className="w-full text-left text-sm">
            <tbody>
              {WRITE_BACKEND !== "sqlite" && (
                <>
                  <CredentialRow
                    label="Google service account email"
                    value={googleEmail}
                    configured={!!googleEmail}
                    sensitive={false}
                  />
                  <CredentialRow
                    label="Google service account private key"
                    value={null}
                    configured={googleKeyConfigured}
                    sensitive
                  />
                </>
              )}
              <CredentialRow
                label="Supabase project URL"
                value={supabaseUrl}
                configured={!!supabaseUrl}
                sensitive={false}
              />
              <CredentialRow
                label="Supabase anon key"
                value={supabaseAnonKey}
                configured={!!supabaseAnonKey}
                sensitive={false}
              />
              <CredentialRow
                label="Supabase service-role key"
                value={null}
                configured={supabaseServiceKeyConfigured}
                sensitive
              />
            </tbody>
          </table>
        </ScrollTable>
      </div>

      <div>
        <h2 className="text-sm font-bold text-[#0e1b3d]">Qandle HRMS (Attrition tab)</h2>
        <p className="mt-1 text-sm text-slate-500">
          Employees come from Qandle&apos;s all-user API and are refreshed by the same Sync now button.
          Only department, location, designation, joining / birth / relieving dates and status are
          kept — names, phone numbers, emails, addresses and PAN numbers are dropped before anything is
          stored.
        </p>
        <ScrollTable outerClassName="mt-3" className={`${GLASS_PANEL}`}>
          <table className="w-full text-left text-sm">
            <tbody>
              <CredentialRow
                label="Qandle base URL"
                value={process.env.QANDLE_BASE_URL ?? "https://your-company.qandle.com"}
                configured
                sensitive={false}
              />
              <CredentialRow
                label="Qandle client ID"
                value={null}
                configured={!!process.env.QANDLE_CLIENT_ID}
                sensitive
              />
              <CredentialRow
                label="Qandle client secret"
                value={null}
                configured={!!process.env.QANDLE_CLIENT_SECRET}
                sensitive
              />
              <tr className="border-b border-slate-200/50 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">Employees currently loaded</td>
                <td className="px-4 py-3 text-slate-600">{rowCounts.employees ?? "—"}</td>
              </tr>
            </tbody>
          </table>
        </ScrollTable>
      </div>

      <div>
        <h2 className="text-sm font-bold text-[#0e1b3d]">Last sync</h2>
        <p className="mt-1 text-sm text-slate-500">
          {lastSync
            ? `${new Date(lastSync.finished_at ?? "").toLocaleString("en-IN")} — ${lastSync.status}${
                lastSync.rows_synced !== null && lastSync.rows_synced !== undefined
                  ? ` (${lastSync.rows_synced} rows)`
                  : ""
              }`
            : "Never synced yet."}
        </p>
      </div>
    </div>
  );
}
