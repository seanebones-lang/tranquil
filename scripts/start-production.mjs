/**
 * Railway (& other containers) expect the HTTP server bound to every interface.
 * Next standalone `server.js` honors PORT and HOSTNAME.
 *
 * Always bind 0.0.0.0 here: many shells set HOSTNAME to the machine name (e.g. macOS),
 * which would make the server unreachable from the container edge / load balancer.
 */
import { spawnSync } from "node:child_process";

process.env.HOSTNAME = "0.0.0.0";

const r = spawnSync(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit",
  env: process.env,
  cwd: process.cwd(),
});

process.exit(typeof r.status === "number" ? r.status : 1);
