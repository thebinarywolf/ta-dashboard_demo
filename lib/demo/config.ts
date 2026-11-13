import { AUTH_BACKEND } from "@/lib/data-source/config";

// Auth-only flag: true whenever there's no Supabase project configured, so
// sign-up/sign-in/approval runs against the in-memory demo store
// (lib/demo/store.ts) instead of Supabase Auth. Independent of where
// dashboard DATA comes from — see lib/data-source/config.ts's DATA_BACKEND
// for that (e.g. a Google service account without Supabase still uses this
// demo auth store, but real synced data via lib/local-db/*).
export const DEMO_MODE = AUTH_BACKEND === "local";

// Kept here (rather than in lib/demo/session.ts) because this file has no
// Node-only imports and is safe to import from middleware.ts, which runs in
// the Edge runtime.
export const DEMO_SESSION_COOKIE = "demo_uid";
