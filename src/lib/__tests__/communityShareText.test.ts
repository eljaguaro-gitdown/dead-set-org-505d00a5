import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { communityShareText, communityPlaylist, communityFindings } from "@/lib/communityIssue";
import type { CommunityIssue } from "@/lib/communityIssue";

const night = (position: number, showDate: string | null, archiveUrl: string | null) => ({
  position,
  showDate,
  venue: "Winterland",
  archiveUrl,
  note: "A night.",
});

const issue = (over: Partial<CommunityIssue> = {}): CommunityIssue => ({
  songId: "song-1",
  title: "Eyes of the World",
  slug: "eyes-of-the-world",
  firstPlayed: "1973-02-09",
  lastPlayed: "1995-07-06",
  firstPlayedVenue: null,
  lastPlayedVenue: null,
  timesPlayed: 382,
  mappedBy: "ric neil",
  setlistId: "set-1",
  nights: [
    night(1, "1974-06-18", "https://archive.org/details/a"),
    night(2, "1977-05-08", "https://archive.org/details/b"),
  ],
  ...over,
});

describe("communityShareText", () => {
  it("leads with what makes the song worth opening", () => {
    // A bare url pasted into WhatsApp unfurled as "Dead Set — a discovery
    // tool", i.e. the app rather than the song. This is the sentence that
    // actually travels with the link.
    expect(communityShareText(issue())).toBe(
      "Played 382 times between 1973 and 1995. 2 nights worth knowing, mapped by ric neil.",
    );
  });

  it("says night, singular, when there is one", () => {
    expect(communityShareText(issue({ nights: [night(1, "1974-06-18", "u")] }))).toContain(
      "1 night worth knowing",
    );
  });

  it("does not invent a span the data does not support", () => {
    expect(communityShareText(issue({ firstPlayed: null, lastPlayed: null }))).toBe(
      "Played 382 times. 2 nights worth knowing, mapped by ric neil.",
    );
    expect(
      communityShareText(issue({ firstPlayed: "1977-05-08", lastPlayed: "1977-05-08" })),
    ).toContain("Played 382 times in 1977.");
  });

  it("omits the count rather than printing a blank one", () => {
    expect(communityShareText(issue({ timesPlayed: null }))).toBe(
      "2 nights worth knowing, mapped by ric neil.",
    );
  });

  it("still credits the author when no night carries a date", () => {
    const i = issue({ nights: [night(1, null, "u")] });
    expect(communityShareText(i)).toContain("Mapped by ric neil.");
    expect(communityShareText(i)).not.toContain("nights worth knowing");
  });
});

describe("communityPlaylist", () => {
  it("plays the song forward through the years", () => {
    const slots = communityPlaylist(issue());
    expect(slots.map((s) => s.version!.show_date)).toEqual(["1974-06-18", "1977-05-08"]);
    expect(slots.map((s) => s.position)).toEqual([0, 1]);
  });

  it("KEEPS a night with no stored url, because it names its night", () => {
    // This test used to assert the opposite, on the reasoning that "the player
    // can only start on a slot carrying an archive url". That stopped being
    // true when resolveSlot gained its named-night branch, and the assertion
    // then pinned the defect as intended behaviour: 21 of the 33 nights across
    // the six community issues have no stored url, so the rule it protected
    // was hiding most of the catalog. Absent was current, not correct.
    const slots = communityPlaylist(
      issue({ nights: [night(1, "1974-06-18", null), night(2, "1977-05-08", "u")] }),
    );
    expect(slots).toHaveLength(2);
    expect(slots.map((s) => s.version!.show_date)).toEqual(["1974-06-18", "1977-05-08"]);
  });

  it("still drops a night that can be neither found nor named", () => {
    const slots = communityPlaylist(
      issue({ nights: [night(1, null, null), night(2, "1977-05-08", "u")] }),
    );
    expect(slots).toHaveLength(1);
    expect(slots[0].version!.show_date).toBe("1977-05-08");
  });

  it("carries the author's note onto the slot the player shows", () => {
    expect(communityPlaylist(issue())[0].version!.description).toBe("A night.");
  });
});

describe("the share control copies text, not a bare url", () => {
  const src = readFileSync(
    join(__dirname, "..", "..", "components", "ShareDropdown.tsx"),
    "utf8",
  );

  it("writes the share text, which carries the link, not the bare url", () => {
    // Copying only the url leaves the receiving app to describe the page, and
    // what it finds is the sitewide meta, because every route is
    // client-rendered and a crawler does not run JS.
    //
    // The payload now comes from @/lib/shareCopy, whose text ends in the url —
    // so this pins "copyPayload is the share text" rather than the old
    // hand-assembled `${text}\n${url}`. That the text really does end in the
    // url is asserted in shareSurfacesUseShareCopy.test.ts, against the
    // builders themselves rather than against this file's source.
    expect(src).toMatch(/const copyPayload = shareText;/);
    expect(src).toMatch(/const shareText = share\.text;/);
    expect(src).toMatch(/clipboard\.writeText\(copyPayload\)/);
    // The no-clipboard fallback must copy the same thing.
    expect(src).toMatch(/ta\.value = copyPayload/);
    // And must never fall back to the bare link.
    expect(src).not.toMatch(/writeText\(linkToShare\)/);
    expect(src).not.toMatch(/ta\.value = linkToShare/);
  });
});

describe("communityFindings — derived from the picks, never written for them", () => {
  it("names the span and the rooms at either end", () => {
    const i = issue({
      nights: [
        { position: 1, showDate: "1971-03-24", venue: "Winterland Arena", archiveUrl: null, note: "" },
        { position: 2, showDate: "1995-07-09", venue: "Soldier Field", archiveUrl: null, note: "" },
      ],
    });
    expect(communityFindings(i)).toBe("2 nights, 24 years apart, Winterland Arena to Soldier Field.");
  });

  it("says nothing when there is only one night to describe", () => {
    expect(communityFindings(issue({
      nights: [{ position: 1, showDate: "1971-03-24", venue: "Winterland", archiveUrl: null, note: "" }],
    }))).toBeNull();
  });

  it("does not say 'Winterland to Winterland'", () => {
    const i = issue({
      nights: [
        { position: 1, showDate: "1971-03-24", venue: "Winterland", archiveUrl: null, note: "" },
        { position: 2, showDate: "1973-03-24", venue: "Winterland", archiveUrl: null, note: "" },
      ],
    });
    expect(communityFindings(i)).toBe("2 nights, 2 years apart.");
  });

  it("handles nights inside one year", () => {
    const i = issue({
      nights: [
        { position: 1, showDate: "1977-05-08", venue: "Barton Hall", archiveUrl: null, note: "" },
        { position: 2, showDate: "1977-09-03", venue: "Englishtown", archiveUrl: null, note: "" },
      ],
    });
    expect(communityFindings(i)).toContain("inside one year");
  });
});
