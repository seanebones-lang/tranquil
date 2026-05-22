/**
 * Railway / container startup: migrate DB, then bind Next standalone.
 *
 * This file is copied into `.next/standalone/` during `npm run build` so Railpack’s
 * runtime image can run `node .next/standalone/start-production.mjs` even when the
 * `scripts/` folder is not shipped to the final container.
 *
 * - Prisma CLI: `node node_modules/prisma/build/index.js` (no `npm exec`).
 * - SKIP_DB_MIGRATE_ON_START=1 | true — skip migrate (debug only).
 * - HOSTNAME is forced to 0.0.0.0 so the LB can reach the process (see Next server.js).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hereDir = path.dirname(fileURLToPath(import.meta.url));
const serverBesideUs = path.join(hereDir, "server.js");

/** Monorepo root (contains `prisma/`, `package.json`, `node_modules/`). */
const root = fs.existsSync(serverBesideUs)
  ? path.resolve(hereDir, "..", "..")
  : path.resolve(hereDir, "..");

const standaloneDir = fs.existsSync(serverBesideUs)
  ? hereDir
  : path.join(root, ".next", "standalone");

const standaloneServer = path.join(standaloneDir, "server.js");
const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");

// stderr → log collectors often flush this reliably (vs buffered stdout).
console.error(
  "[tranquil/start] bootstrap",
  new Date().toISOString(),
  "| pid=" + process.pid,
  "| cwd=" + process.cwd(),
  "| script=" + hereDir,
  "| root=" + root,
);

function ensurePortForRailway() {
  const raw = process.env.PORT;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) {
    console.warn(
      "[tranquil/start] WARN: PORT is unset or empty — Next falls back to 3000 while Railway proxies the allocated port → 502. Set Railway’s PORT on the web service.",
    );
    return;
  }
  const parsed = Number.parseInt(trimmed, 10);
  console.log("[tranquil/start] PORT:", Number.isFinite(parsed) ? `${parsed}` : `${trimmed} (non-integer, Next will parse)`);
}

function runMigrate() {
  if (!fs.existsSync(prismaCli)) {
    console.error("[tranquil/start] Prisma CLI missing:", prismaCli, "(wrong deploy rootDirectory or install failed)");
    process.exit(1);
  }
  console.log("[tranquil/start] prisma migrate deploy…");
  const r = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  const code = r.status ?? 1;
  if (code !== 0) {
    console.error("[tranquil/start] prisma migrate deploy failed, exit=", code);
    process.exit(code);
  }
  console.log("[tranquil/start] prisma migrate deploy ok");
}

function main() {
  const skip =
    process.env.SKIP_DB_MIGRATE_ON_START === "1" ||
    process.env.SKIP_DB_MIGRATE_ON_START === "true";
  if (skip) {
    console.warn(
      "[tranquil/start] SKIP_DB_MIGRATE_ON_START is set — migrations skipped (debug only)",
    );
  } else {
    runMigrate();
  }

  if (!fs.existsSync(standaloneServer)) {
    console.error(
      "[tranquil/start] Next standalone missing:",
      standaloneServer,
      "| Run `npm run build` (standalone output). On Railway, ensure the build step ran and Root Directory is the repo root.",
    );
    process.exit(1);
  }

  ensurePortForRailway();
  process.env.HOSTNAME = "0.0.0.0";
  console.log("[tranquil/start] HOSTNAME=0.0.0.0, launching Next standalone…");

  const srv = spawnSync(process.execPath, [standaloneServer], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

  process.exit(typeof srv.status === "number" ? srv.status : 1);
}

try {
  main();
} catch (err) {
  console.error("[tranquil/start] FATAL:", err instanceof Error ? err.stack : String(err));
  process.exit(1);
}
