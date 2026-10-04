import { describe, it, expect, vi, beforeEach } from "vitest";

const insert = vi.fn();
vi.mock("@/lib/songbookDb", () => ({
  songbookDb: { from: () => ({ insert: (...a: unknown[]) => insert(...a) }) },
}));

import {
  contributeToSongbook,
  SONGBOOK_ADDED_TITLE,
  SONGBOOK_ADDED_BODY,
  SONGBOOK_ADDED_TOAST,
} from "@/lib/songbookContribution";

const args = { songId: "song-1", setlistId: "set-1", creatorId: "user-1" };

beforeEach(() => {
  insert.mockReset();
  insert.mockResolvedValue({ error: null });
});

describe("contributeToSongbook", () => {
  it("reports the song added when nobody had mapped it", async () => {
    insert.mockResolvedValue({ error: null });
    expect(await contributeToSongbook(args)).toEqual({ outcome: "added" });
  });

  it("credits the creator and binds the guide", async () => {
    insert.mockResolvedValue({ error: null });
    await contributeToSongbook(args);
    expect(insert).toHaveBeenCalledWith({
      song_id: "song-1",
      setlist_id: "set-1",
      creator_id: "user-1",
    });
  });

  /**
   * The whole "has it been added yet" question is answered by the database's
   * UNIQUE on song_id, not by a read-then-write in the client. A SELECT
   * followed by an INSERT races itself the moment two people save a guide for
   * the same song at once, and both would believe they were first.
   */
  it("treats a unique violation as someone else getting there first", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    expect(await contributeToSongbook(args)).toEqual({ outcome: "already_mapped" });
  });

  it("never checks before inserting — the constraint is the check", async () => {
    insert.mockResolvedValue({ error: null });
    await contributeToSongbook(args);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("reports failure rather than throwing when the write errors", async () => {
    insert.mockResolvedValue({ error: { code: "42501", message: "denied" } });
    expect(await contributeToSongbook(args)).toEqual({ outcome: "failed" });
  });

  /**
   * This runs immediately after a guide saved successfully. If it throws, the
   * reader would be told their guide failed when it did not.
   */
  it("swallows a thrown client so a saved guide never reads as failed", async () => {
    insert.mockImplementation(() => {
      throw new Error("network");
    });
    expect(await contributeToSongbook(args)).toEqual({ outcome: "failed" });
  });
});

describe("the copy", () => {
  it("leads with what they did for everyone else, not with 'saved'", () => {
    expect(SONGBOOK_ADDED_TITLE).toMatch(/Songbook/i);
    expect(SONGBOOK_ADDED_BODY).toMatch(/everyone/i);
    expect(SONGBOOK_ADDED_BODY).toMatch(/your name/i);
  });

  it("never says the forbidden words", () => {
    for (const s of [SONGBOOK_ADDED_TITLE, SONGBOOK_ADDED_BODY, SONGBOOK_ADDED_TOAST]) {
      expect(s).not.toMatch(/\bAI\b|algorithm|model|engine|pipeline|database|upload/i);
    }
  });
});
