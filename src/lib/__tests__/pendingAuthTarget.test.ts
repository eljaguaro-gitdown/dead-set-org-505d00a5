import { beforeEach, describe, expect, it } from "vitest";
import {
  consumePendingAuthTarget,
  stashPendingAuthTarget,
  clearPendingAuthTarget,
} from "@/lib/pendingAuthTarget";

describe("pendingAuthTarget", () => {
  beforeEach(() => localStorage.clear());

  it("carries an invite path once", () => {
    stashPendingAuthTarget("/join/fb683338-13d2-4cc2-b8cf-d82221be9617");
    expect(consumePendingAuthTarget()).toBe("/join/fb683338-13d2-4cc2-b8cf-d82221be9617");
    expect(consumePendingAuthTarget()).toBeNull();
  });

  it("refuses anything that is not an in-app path", () => {
    for (const p of ["https://evil.example", "//evil.example", "/\\evil.example", "join/x", "", null]) {
      stashPendingAuthTarget(p as string | null);
      expect(consumePendingAuthTarget()).toBeNull();
    }
  });

  it("expires after a day", () => {
    stashPendingAuthTarget("/join/x");
    expect(consumePendingAuthTarget(Date.now() + 25 * 60 * 60 * 1000)).toBeNull();
  });

  it("is cleared when sign-in finishes in the same tab", () => {
    stashPendingAuthTarget("/join/x");
    clearPendingAuthTarget();
    expect(consumePendingAuthTarget()).toBeNull();
  });
});
