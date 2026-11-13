// Showcase mode: a copy of the dashboard filled with made-up data, for showing
// the project to people outside the company.
//
// This project is the portfolio showcase, so it is ALWAYS on: nothing needs
// to be set to run or host it. (Set NEXT_PUBLIC_SHOWCASE_MODE=0 only to turn it
// off.) While it is on:
//   - Supabase, Google Sheets, Apps Script and Qandle are never contacted, even
//     if their settings are present;
//   - the data is generated on start-up into an in-memory database
//     (lib/showcase/generate.ts), with dates relative to today;
//   - there is no sign-in: everyone is the demo admin below;
//   - Sync now and automatic sync are switched off.
//
// No Node-only imports here: middleware (Edge) and client components read it.
export const SHOWCASE = process.env.NEXT_PUBLIC_SHOWCASE_MODE !== "0";

export interface ShowcaseLogin {
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "viewer" | "pro_viewer" | "recruiter";
  /** What this login shows off, for the login page. */
  label: string;
}

// Made-up accounts on a reserved test domain. Passwords are public on purpose:
// they only open this sample-data copy.
export const SHOWCASE_LOGINS: ShowcaseLogin[] = [
  { email: "admin@demo.test", password: "demo1234", fullName: "Demo Admin", role: "admin", label: "Admin — everything, incl. user approval" },
  { email: "viewer@demo.test", password: "demo1234", fullName: "Demo Viewer", role: "viewer", label: "Viewer — the tabs an admin allows" },
  { email: "recruiter@demo.test", password: "demo1234", fullName: "Demo Recruiter", role: "recruiter", label: "Recruiter" },
];

// The one account everybody is in the showcase (there is no sign-in).
export const SHOWCASE_ADMIN = {
  id: "demo-admin",
  email: "admin@demo.test",
  full_name: "Demo Admin",
  role: "admin",
  status: "approved",
  requested_at: "2026-01-01T00:00:00.000Z",
  approved_at: "2026-01-01T00:00:00.000Z",
  approved_by: "demo-admin",
} as const;
