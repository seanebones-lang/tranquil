/**
 * After `next build` with `output: "standalone"`, Next does not bundle `public/` or `.next/static/`.
 * Copy them beside `.next/standalone/server.js` so assets load in production (e.g. Railway).
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!fs.existsSync(standalone)) {
  console.warn(
    "[copy-standalone-assets] .next/standalone missing — skip (standalone output disabled?).",
  );
  process.exit(0);
}

const pub = path.join(root, "public");
if (fs.existsSync(pub)) {
  fs.cpSync(pub, path.join(standalone, "public"), { recursive: true });
}

const stat = path.join(root, ".next", "static");
if (fs.existsSync(stat)) {
  fs.mkdirSync(path.join(standalone, ".next", "static"), { recursive: true });
  fs.cpSync(stat, path.join(standalone, ".next", "static"), { recursive: true });
}

// Railpack images may omit `scripts/` — copy the bootstrap next to standalone `server.js`.
const startProdSrc = path.join(root, "scripts", "start-production.mjs");
const startProdDst = path.join(standalone, "start-production.mjs");
if (fs.existsSync(startProdSrc)) {
  fs.copyFileSync(startProdSrc, startProdDst);
}

console.log("[copy-standalone-assets] copied public/, .next/static, start-production.mjs → .next/standalone/");
