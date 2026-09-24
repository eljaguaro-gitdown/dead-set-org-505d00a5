import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Steal Your Face was retired for Cosmic Charlie on 2026-09-17 (PR #35), but
 * only in components. The raster icons kept it until 2026-09-24: the PWA
 * icons, the home-screen icon, the favicons — and icon-512.png is the
 * lock-screen / Dynamic Island artwork on the web player, which is where Jay
 * spotted it. Rhino actively enforces this mark (guideline 4.1(c)).
 *
 * These are the sha256s of those old files. None may come back.
 */
const RETIRED_STEAL_YOUR_FACE = new Set([
  "bbf67bc7998a85d04ed8f5036532e8eb0c9c81af35868fefcb320839b609e8fd", // icons/icon-512.png
  "0a7701983567f1b6cf39aaf40a64ca03ca45379ff9bdb379d1c984a43d837a0f", // icons/icon-192.png
  "7900606dfd1e5840ae91a9b4ec11edd46058653f340a0157fbf354a5e25dba09", // apple-touch-icon.png
  "4cb3681da4b0e4bfc53569d65a9a7a80257874e201008e80a5865408825ac6cb", // favicon-16.png
  "b6367283eb7bb5659bd5dbff288dd10956fbe2dc04f6ef06c246498db17433c0", // favicon-32.png
  "dd821076a9b03adc2173c93956226aea3d92482d7578fc4339c5d3a2e9c24586", // favicon.ico
]);

const ICONS = [
  "public/icons/icon-512.png",
  "public/icons/icon-192.png",
  "public/apple-touch-icon.png",
  "public/favicon-16.png",
  "public/favicon-32.png",
  "public/favicon.ico",
];

describe("brand icons", () => {
  it.each(ICONS)("%s is not the retired Steal Your Face art", (file) => {
    const sha = createHash("sha256").update(readFileSync(resolve(__dirname, "../../..", file))).digest("hex");
    expect(RETIRED_STEAL_YOUR_FACE.has(sha)).toBe(false);
  });
});
