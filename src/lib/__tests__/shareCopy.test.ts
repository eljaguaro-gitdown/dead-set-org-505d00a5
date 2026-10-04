import { describe, it, expect } from "vitest";
import { shareVersionsCopy, shareGuideCopy, lifespanLine } from "@/lib/shareCopy";

const URL_ = "https://dead-set.org/versions/franklins-tower";

/** The exact share that arrived as the generic app card. */
const FRANKLINS = {
  songTitle: "Franklin's Tower",
  url: URL_,
  timesPlayed: 336,
  firstPlayed: "1975-06-17",
  lastPlayed: "1995-07-09",
};

describe("shareVersionsCopy", () => {
  it("names the song in the title — not the app", () => {
    const { title } = shareVersionsCopy(FRANKLINS);
    expect(title).toContain("Franklin's Tower");
    expect(title).not.toMatch(/Every Deadhead knows the feeling/);
  });

  it("carries the life of the song, which is the reason to open it", () => {
    const { text } = shareVersionsCopy(FRANKLINS);
    expect(text).toContain("336 times");
    expect(text).toContain("1975 to 1995");
  });

  it("says who sent it when we know them", () => {
    const { text } = shareVersionsCopy({ ...FRANKLINS, senderName: "Jay" });
    expect(text).toContain("Jay sent you Franklin's Tower");
  });

  it("reads fine with no name", () => {
    const { text } = shareVersionsCopy(FRANKLINS);
    expect(text).not.toContain("sent you");
    expect(text).toContain("Franklin's Tower");
  });

  it("always carries the link", () => {
    expect(shareVersionsCopy(FRANKLINS).text).toContain(URL_);
  });

  it("drops the lifespan line rather than printing a half-empty one", () => {
    const { text } = shareVersionsCopy({ songTitle: "Unknown Song", url: URL_ });
    expect(text).not.toContain("times");
    expect(text).toContain("Unknown Song");
    expect(text).toContain(URL_);
  });
});

describe("shareGuideCopy", () => {
  it("calls a guide a guide — it is a night in order, not a page of options", () => {
    const { title, text } = shareGuideCopy({ songTitle: "Eyes of the World", url: URL_, slotCount: 6 });
    expect(title).toContain("listening guide");
    expect(text).toContain("6 versions, in order");
  });

  it("says version, singular, for one", () => {
    const { text } = shareGuideCopy({ songTitle: "Loser", url: URL_, slotCount: 1 });
    expect(text).toContain("1 version,");
  });
});

describe("lifespanLine", () => {
  it("collapses a single-year span", () => {
    expect(lifespanLine({ timesPlayed: 3, firstPlayed: "1969-01-01", lastPlayed: "1969-12-31" }))
      .toBe("3 times · 1969");
  });

  it("is null when the catalog knows nothing", () => {
    expect(lifespanLine({})).toBeNull();
  });
});

describe("the voice", () => {
  it("never says the forbidden words", () => {
    const { title, text } = shareVersionsCopy({ ...FRANKLINS, senderName: "Jay" });
    for (const s of [title, text]) {
      expect(s).not.toMatch(/\bAI\b|algorithm|model|engine|pipeline|recommendation/i);
    }
  });
});
