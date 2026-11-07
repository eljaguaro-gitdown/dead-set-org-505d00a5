import { BUILD_INFO } from "@/buildInfo";

declare const __BUILD_SHA__: string;

/**
 * The commit this bundle was built from, for events and reports.
 *
 * Two sources, in order. `__BUILD_SHA__` is baked in by vite.config.ts and
 * is right wherever the build can see git or VITE_BUILD_SHA. Where it cannot
 * — Lovable's publish build, which stamped "unknown" on every event from
 * 2026-11-03 until this landed — the committed src/buildInfo.ts carries the
 * sha of the code commit, written by .github/workflows/stamp-build-sha.yml.
 * Reading it here, not only in vite.config.ts, means the attribution holds
 * even if a future build pipeline drops the define altogether.
 */
export const BUILD_SHA_UNKNOWN = "unknown";

const SHA_RE = /^[0-9a-f]{40}$/;

export function buildSha(): string {
  const defined = typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "";
  if (SHA_RE.test(defined)) return defined;
  if (SHA_RE.test(BUILD_INFO.sha)) return BUILD_INFO.sha;
  return BUILD_SHA_UNKNOWN;
}

export const buildShaShort = (): string => {
  const sha = buildSha();
  return sha === BUILD_SHA_UNKNOWN ? sha : sha.slice(0, 7);
};
