#!/usr/bin/env node
/**
 * Write src/buildInfo.ts for the commit named by $GITHUB_SHA (or the first
 * argument). Run by .github/workflows/stamp-build-sha.yml; runnable by hand:
 *
 *   node scripts/build-sha/stamp.mjs $(git rev-parse HEAD)
 *
 * Exits 0 and prints "unchanged" when the file already carries that sha, so
 * the workflow can skip an empty commit.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderBuildInfo, parseBuildInfo } from "./resolve.mjs";

const sha = (process.argv[2] || process.env.GITHUB_SHA || "").trim();
if (!/^[0-9a-f]{40}$/.test(sha)) {
  console.error("stamp: need a 40-character sha (argument or $GITHUB_SHA)");
  process.exit(2);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const file = path.join(root, "src/buildInfo.ts");
const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
if (parseBuildInfo(current) === sha) {
  console.log("unchanged");
  process.exit(0);
}
fs.writeFileSync(file, renderBuildInfo(sha, new Date().toISOString()));
console.log(`stamped ${sha}`);
