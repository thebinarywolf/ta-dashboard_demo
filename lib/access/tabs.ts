// Canonical registry of the dashboard nav tabs that admin can control
// visibility for, per role. Admin and Data source are NOT in this list —
// they stay hard-coded admin-only (app/admin/**, gated by requireAdminProfile)
// regardless of this setting, since only admins ever reach them anyway.
export interface DashboardTab {
  key: string;
  href: string;
  label: string;
  /** Sensitive tabs (HR data like exits and dates of birth) start hidden for
   *  viewer/recruiter roles until an admin explicitly ticks them. */
  sensitive?: boolean;
}

// The order here is the order of the nav bar.
export const DASHBOARD_TABS: DashboardTab[] = [
  { key: "positions", href: "/dashboard", label: "Positions" },
  { key: "attrition", href: "/dashboard/attrition", label: "Attrition", sensitive: true },
  { key: "attrition-insights", href: "/dashboard/attrition-insights", label: "Attrition Insights", sensitive: true },
  { key: "recruiters", href: "/dashboard/recruiters", label: "Recruiters" },
  { key: "recruiters-insights", href: "/dashboard/recruiters-insights", label: "Recruiters Insights", sensitive: true },
  { key: "sources", href: "/dashboard/sources", label: "Sources" },
  { key: "dropouts", href: "/dashboard/dropouts", label: "Dropouts" },
  { key: "funnel", href: "/dashboard/funnel", label: "Funnel" },
  { key: "report", href: "/dashboard/report", label: "Report", sensitive: true },
  { key: "financials", href: "/dashboard/financials", label: "Financials", sensitive: true },
];

export const DASHBOARD_TAB_KEYS = DASHBOARD_TABS.map((t) => t.key);

/** What a role sees before an admin changes anything: every non-sensitive tab. */
export const DEFAULT_VISIBLE_TAB_KEYS = DASHBOARD_TABS.filter((t) => !t.sensitive).map((t) => t.key);

// Roles whose tab visibility admin can configure. "admin" always sees every
// tab and isn't part of this — configuring it would be meaningless.
export const CONFIGURABLE_ROLES = ["viewer", "pro_viewer", "recruiter"] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];
