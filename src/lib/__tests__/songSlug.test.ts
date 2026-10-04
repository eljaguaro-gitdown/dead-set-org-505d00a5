import { describe, it, expect } from "vitest";
import { songSlug } from "@/lib/songSlug";

describe("songSlug", () => {
  it("makes a readable slug from a title", () => {
    expect(songSlug("Shakedown Street")).toBe("shakedown-street");
    expect(songSlug("Crazy Fingers")).toBe("crazy-fingers");
  });

  it("drops apostrophes rather than turning them into separators", () => {
    expect(songSlug("Truckin'")).toBe("truckin");
    expect(songSlug("Playin' In The Band")).toBe("playin-in-the-band");
  });

  it("handles punctuation, ampersands and stray spacing", () => {
    expect(songSlug("St. Stephen")).toBe("st-stephen");
    expect(songSlug("Scarlet Begonias > Fire on the Mountain")).toBe(
      "scarlet-begonias-fire-on-the-mountain",
    );
    expect(songSlug("Me & My Uncle")).toBe("me-and-my-uncle");
    expect(songSlug("  Dark Star  ")).toBe("dark-star");
  });

  it("is stable — the same title always gives the same slug", () => {
    expect(songSlug("Ramble On Rose")).toBe(songSlug("ramble on rose"));
  });
});
