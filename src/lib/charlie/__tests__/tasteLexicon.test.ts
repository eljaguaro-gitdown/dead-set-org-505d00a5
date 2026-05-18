import { describe, it, expect } from "vitest";
import { extractTasteMatches } from "../tasteLexicon";

describe("extractTasteMatches", () => {
  it("extracts vibes, priorities, length, and era bias from free text", () => {
    const r = extractTasteMatches(
      "I want a long fiery Dark Star with a sick segue"
    );
    expect(r.vibes).toContain("high-energy");
    expect(r.priorities).toContain("deep-jams");
    expect(r.priorities).toContain("segues");
    expect(r.length).toBe("stretched");
    expect(r.eraBias.length).toBeGreaterThan(0);
  });
});
