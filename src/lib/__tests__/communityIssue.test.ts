import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { matchSongBySlug } from "@/lib/communityIssue";
import { formatIssueDate } from "@/components/CommunityIssueArticle";
import { songSlug } from "@/lib/songSlug";

const SRC = join(__dirname, "..", "..");

describe("matchSongBySlug", () => {
  const songs = [
    { title: "Eyes of the World" },
    { title: "Shakedown Street" },
    { title: "St. Stephen" },
    { title: "Truckin'" },
  ];

  it("resolves a slug through the same convention /versions/:slug uses", () => {
    expect(matchSongBySlug(songs, "eyes-of-the-world")?.title).toBe("Eyes of the World");
    expect(matchSongBySlug(songs, "st-stephen")?.title).toBe("St. Stephen");
    expect(matchSongBySlug(songs, "truckin")?.title).toBe("Truckin'");
  });

  it("returns null rather than guessing at a near miss", () => {
    expect(matchSongBySlug(songs, "eyes-of-world")).toBeNull();
    expect(matchSongBySlug(songs, "")).toBeNull();
  });

  it("agrees with songSlug for every title it is given", () => {
    // The invariant that joins the two: resolution is only correct while the
    // slug the LIST builds and the slug the PAGE resolves are the same
    // function. Two copies here would 404 every community issue.
    for (const s of songs) {
      expect(matchSongBySlug(songs, songSlug(s.title))?.title).toBe(s.title);
    }
  });
});

describe("formatIssueDate", () => {
  it("reads the way a curated issue reads", () => {
    expect(formatIssueDate("1978-08-31")).toBe("Aug 31, 1978");
    expect(formatIssueDate("1995-07-09")).toBe("Jul 9, 1995");
  });

  it("does not slip a day in a western timezone", () => {
    // A bare date parsed as local midnight renders as the day before west of
    // UTC. Pinned because the stats block prints these next to a count.
    expect(formatIssueDate("1973-02-09")).toBe("Feb 9, 1973");
    expect(formatIssueDate("1970-01-01")).toBe("Jan 1, 1970");
  });

  it("shows an em dash rather than inventing a date", () => {
    expect(formatIssueDate(null)).toBe("—");
    expect(formatIssueDate("not-a-date")).toBe("—");
  });
});

describe("a community entry is reachable as an issue", () => {
  const songbook = readFileSync(join(SRC, "pages", "Songbook.tsx"), "utf8");
  const page = readFileSync(join(SRC, "pages", "SongFeature.tsx"), "utf8");

  it("the shelf links to /songbook/<slug>, not straight to the guide", () => {
    // It pointed at /setlist/<id> before, which is why a community guide had
    // no issue page to share.
    expect(songbook).toMatch(/to=\{`\/songbook\/\$\{songSlug\(/);
    expect(songbook).not.toMatch(/to=\{`\/setlist\/\$\{c\.setlist_id\}`\}/);
  });

  it("the issue page falls back to a community issue", () => {
    expect(page).toMatch(/loadCommunityIssue\(/);
    expect(page).toMatch(/<CommunityIssueArticle/);
  });

  it("consults the community entry only when there is no curated issue", () => {
    // A song can carry both. The editorial issue is the issue, so the fallback
    // must sit behind a `!curated` check rather than racing it.
    expect(page).toMatch(/if \(!curated\)[\s\S]{0,160}loadCommunityIssue/);
  });

  it("the community article offers a share control", () => {
    const article = readFileSync(join(SRC, "components", "CommunityIssueArticle.tsx"), "utf8");
    expect(article).toMatch(/<ShareDropdown/);
    expect(article).toMatch(/dead-set\.org\/songbook\/\$\{issue\.slug\}/);
  });
});
