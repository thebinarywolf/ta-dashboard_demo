// Runs the dashboard in showcase mode (made-up data, demo logins, no real
// systems contacted). See lib/showcase/flag.ts.
//
//   npm run showcase          -> development server on http://localhost:3300
//   npm run showcase -- build -> production build in showcase mode
//
// Uses its own build folder (.next-showcase) so it can run next to the normal
// dev server without the two overwriting each other.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const mode = process.argv[2] === "build" ? ["build"] : process.argv[2] === "start" ? ["start", "-p", "3300"] : ["dev", "-p", "3300"];

const child = spawn(process.execPath, [nextBin, ...mode], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_SHOWCASE_MODE: "1", NEXT_DIST_DIR: ".next-showcase" },
});
child.on("exit", (code) => process.exit(code ?? 0));
