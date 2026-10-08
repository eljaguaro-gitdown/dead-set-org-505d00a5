import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setlistIdFromShareUrl, shareTypeFromShareUrl } from "@/lib/trackShare";

const ID = "4b062f5d-eb1c-49a6-b25e-6fd1a495d23e";

describe("setlistIdFromShareUrl", () => {
  it("pulls the id out of the canonical share url", () => {
    expect(setlistIdFromShareUrl(`https://dead-set.org/setlist/${ID}`)).toBe(ID);
  });

  it("tolerates a trailing slash, query string and hash", () => {
    expect(setlistIdFromShareUrl(`https://dead-set.org/setlist/${ID}/`)).toBe(ID);
    expect(setlistIdFromShareUrl(`https://dead-set.org/setlist/${ID}?utm_source=x`)).toBe(ID);
    expect(setlistIdFromShareUrl(`https://dead-set.org/setlist/${ID}#set2`)).toBe(ID);
  });

  it("lowercases so the same setlist never attributes two ways", () => {
    expect(setlistIdFromShareUrl(`https://dead-set.org/setlist/${ID.toUpperCase()}`)).toBe(ID);
  });

  it("returns undefined for a songbook url — it is not a setlist", () => {
    // SongFeature shares /songbook/<slug>. Attributing that to a setlist id
    // would be worse than leaving it null.
    expect(setlistIdFromShareUrl("https://dead-set.org/songbook/ripple")).toBeUndefined();
  });

  it("returns undefined for the app link and other routes", () => {
    expect(setlistIdFromShareUrl("https://dead-set.org/")).toBeUndefined();
    expect(setlistIdFromShareUrl("https://dead-set.org/browse")).toBeUndefined();
    expect(setlistIdFromShareUrl(`https://dead-set.org/versions/${ID}`)).toBeUndefined();
  });

  it("refuses a slug or partial id in the setlist position", () => {
    // A non-uuid there means something changed upstream; guessing is worse
    // than returning nothing.
    expect(setlistIdFromShareUrl("https://dead-set.org/setlist/my-cool-show")).toBeUndefined();
    expect(setlistIdFromShareUrl("https://dead-set.org/setlist/4b062f5d")).toBeUndefined();
    expect(setlistIdFromShareUrl(`https://dead-set.org/setlist/${ID.slice(0, -1)}`)).toBeUndefined();
  });

  it("requires the id to end the segment, not merely start it", () => {
    // Without a trailing boundary the pattern happily reads an id out of a
    // longer, malformed segment. Verified: dropping the boundary group left
    // every other assertion green.
    expect(setlistIdFromShareUrl(`https://dead-set.org/setlist/${ID}extra`)).toBeUndefined();
    expect(setlistIdFromShareUrl(`https://dead-set.org/setlist/${ID}-copy`)).toBeUndefined();
  });

  it("does not match a lookalike path segment", () => {
    expect(setlistIdFromShareUrl(`https://dead-set.org/not-a-setlist/${ID}`)).toBeUndefined();
  });
});

describe("every ShareDropdown channel attributes its share", () => {
  // The defect this guards: ShareFlow passed setlistId on all six channels
  // while ShareDropdown passed it on none, so a share through the dropdown
  // logged setlist_id null and could never be tied to the inbound visitors it
  // produced. One instrumented surface and one silent one is the same shape as
  // the duplicate archive-notes encoder — so assert the surfaces AGREE.
  const src = readFileSync(
    join(__dirname, "..", "..", "components", "ShareDropdown.tsx"),
    "utf8",
  );
  /**
   * Brace-counted, not regex-matched. `/trackShare\(\{([^}]*)\}\)/` stops at the
   * FIRST closing brace, so a call carrying a nested object —
   * `trackShare({ channel: "x", metadata: { a: 1 } })` — does not match at all
   * and silently drops out of the sweep. The 2026-10-05 gate added exactly such
   * a call with no setlistId and every test stayed green. `shareSong.ts` and
   * `instagramShare.ts` already pass `metadata`, so this is the shape the next
   * edit is most likely to use.
   */
  const callArgs = (source: string): string[] => {
    const out: string[] = [];
    const needle = "trackShare(";
    for (let i = source.indexOf(needle); i !== -1; i = source.indexOf(needle, i + 1)) {
      let depth = 0;
      for (let j = i + needle.length; j < source.length; j++) {
        const c = source[j];
        if (c === "(" || c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ")") {
          if (depth === 0) { out.push(source.slice(i + needle.length, j)); break; }
          depth--;
        }
      }
    }
    return out;
  };
  const calls = callArgs(src);

  it("found every trackShare call (guards a silently empty match)", () => {
    expect(calls.length).toBeGreaterThanOrEqual(4);
  });

  it("passes setlistId on every channel", () => {
    const missing = calls.filter((c) => !/\bsetlistId\b/.test(c));
    expect(missing, `channels not attributing: ${missing.join(" | ")}`).toEqual([]);
  });

  it("derives the id rather than trusting a prop a caller can forget", () => {
    expect(src).toMatch(/setlistIdFromShareUrl\(/);
  });

  it("forwards setlistId to the DM dialog it renders", () => {
    // Found on live traffic, not by this suite: a share through the in-app DM
    // logged setlist_id NULL while ShareFlow's identical dialog logged it fine.
    // SendToFriendDialog passes `setlistId` to trackShare correctly — the id was
    // undefined because ShareDropdown never handed it the PROP. Scanning
    // trackShare calls in this file cannot see that, because the call lives in
    // the child. Same ShareFlow-vs-ShareDropdown asymmetry as the four direct
    // channels; I fixed four paths of five.
    const render = src.match(/<SendToFriendDialog[\s\S]*?\/>/);
    expect(render, "SendToFriendDialog is not rendered here any more").not.toBeNull();
    // Not merely `setlistId={` — `setlistId={undefined}` satisfies that and
    // reinstates the exact defect. Verified: the loose form survived it.
    expect(render![0]).toMatch(/setlistId=\{(?!\s*(?:undefined|null)\s*\})/);
  });
});

describe("shareTypeFromShareUrl", () => {
  it("records a setlist url as a setlist share", () => {
    expect(shareTypeFromShareUrl(`https://dead-set.org/setlist/${ID}`)).toBe("setlist");
  });

  it("records a songbook url as a songbook share, not a setlist with no setlist", () => {
    expect(shareTypeFromShareUrl("https://dead-set.org/songbook/althea")).toBe("songbook");
  });
});

describe("share surfaces derive the type instead of hard-coding it", () => {
  // The bug this guards: ShareDropdown and SendToFriendDialog wrote
  // shareType: "setlist" literally, so Songbook shares were mislabelled.
  for (const file of ["src/components/ShareDropdown.tsx", "src/components/SendToFriendDialog.tsx"]) {
    it(`${file} never hard-codes shareType: "setlist"`, () => {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      expect(src).not.toMatch(/shareType:\s*"setlist"/);
    });
  }

  it("ShareDropdown passes the setlist to the Instagram share", () => {
    const src = readFileSync(join(process.cwd(), "src/components/ShareDropdown.tsx"), "utf8");
    const call = src.slice(src.indexOf("shareToInstagram({"), src.indexOf("});", src.indexOf("shareToInstagram({")));
    expect(call).toMatch(/setlistId/);
  });
});
