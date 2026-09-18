import { describe, it, expect } from "vitest";
import { decodeArchiveNotes, encodeArchiveNotes } from "@/hooks/useSetlist";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";

/**
 * A slot picked from the Archive keeps its metadata in the first line of
 * `notes` as JSON, with the user's own notes on the lines after it. Charlie's
 * note for that tape rides along in the same blob, so the sentence that sold
 * the version in the vault is the sentence shown in the set and on the poster.
 *
 * Round-tripped here because it is a string format, not a column: a typo in
 * either half fails silently and just loses the note.
 */

const slotWith = (description: string | null, notes = "") => ({
  id: "slot-1",
  notes,
  song: { id: "song-1", title: "Crazy Fingers" },
  version: {
    ...SYNTHETIC_VERSION_DEFAULTS,
    id: "archive-gd1975-06-17",
    song_id: "song-1",
    show_date: "1975-06-17",
    venue: "Winterland Arena",
    archive_org_url: "https://archive.org/details/gd1975-06-17",
    rating: 5,
    description,
  },
}) as never;

const CHARLIE_NOTE =
  "The 6/17/75 version is a flowing, almost liquid exploration, hinting at the full power the band would unleash later.";

describe("archive slot notes round-trip", () => {
  it("carries Charlie's note through encode and back", () => {
    const encoded = encodeArchiveNotes(slotWith(CHARLIE_NOTE));
    const { version } = decodeArchiveNotes("slot-1", "song-1", encoded);

    expect(version?.description).toBe(CHARLIE_NOTE);
    expect(version?.show_date).toBe("1975-06-17");
    expect(version?.venue).toBe("Winterland Arena");
  });

  it("keeps the user's own notes separate from the note", () => {
    const encoded = encodeArchiveNotes(slotWith(CHARLIE_NOTE, "play this one loud"));
    const { notes, version } = decodeArchiveNotes("slot-1", "song-1", encoded);

    expect(notes).toBe("play this one loud");
    expect(version?.description).toBe(CHARLIE_NOTE);
  });

  it("survives a note containing a newline without eating the user's notes", () => {
    // The format splits on the first newline, so an unescaped one in the note
    // would swallow everything after it. JSON.stringify escapes it; this is
    // the test that says so.
    const encoded = encodeArchiveNotes(slotWith("line one\nline two", "mine"));
    const { notes, version } = decodeArchiveNotes("slot-1", "song-1", encoded);

    expect(version?.description).toBe("line one\nline two");
    expect(notes).toBe("mine");
  });

  it("leaves a slot with no note decoding to null, not undefined", () => {
    const encoded = encodeArchiveNotes(slotWith(null));
    const { version } = decodeArchiveNotes("slot-1", "song-1", encoded);

    expect(version?.description).toBeNull();
  });

  it("leaves non-archive notes untouched", () => {
    const { notes, version } = decodeArchiveNotes("slot-1", "song-1", "just a plain note");

    expect(notes).toBe("just a plain note");
    expect(version).toBeNull();
  });
});
