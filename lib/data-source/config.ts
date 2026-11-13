// Central place deciding which backend auth and data each run against.
//
// - AUTH_BACKEND: "supabase" once NEXT_PUBLIC_SUPABASE_URL is set, else
//   "local" (the in-memory demo store in lib/demo/*).
// - WRITE_BACKEND: where `npm run sync` / the "Sync now" button writes.
//   "supabase" once configured, else "sqlite" (lib/local-db/*, fetched via
//   the public CSV export — see lib/connectors/google-sheets/csv-client.ts
//   — no credentials needed).
//
// What the DASHBOARD reads (as opposed to where sync writes) is resolved
// at request time by lib/data-source/resolve.ts, since "sqlite" only
// becomes readable once a sync has actually populated it — see that file.
//
// No Node-only imports here — safe for middleware.ts (Edge runtime).
import { SHOWCASE } from "@/lib/showcase/flag";

// Showcase mode (lib/showcase/flag.ts) never touches Supabase, even when its
// settings are present: made-up data in memory and demo logins only.
const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !SHOWCASE;

export const AUTH_BACKEND: "supabase" | "local" = hasSupabaseUrl
  ? "supabase"
  : "local";

export const WRITE_BACKEND: "supabase" | "sqlite" = hasSupabaseUrl
  ? "supabase"
  : "sqlite";
