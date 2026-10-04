import { songbookDb } from "@/lib/songbookDb";

/**
 * Adding a song to the Songbook by being the first to map it.
 *
 * The Songbook's editorial series runs a song a week; the repertoire is ~523
 * songs, so the series alone is a decade of work and 232 of the 234 songs in
 * the catalog have nothing. This is the other half of the shelf: the first
 * listening guide anyone builds for a song becomes that song's community
 * entry, credited to whoever made it.
 *
 * It never touches `song_features`. An unreviewed guide must not appear as an
 * issue — the issues are what makes the Songbook worth reading.
 */

export type ContributionResult =
  /** They were first. The song is in the Songbook now, under their name. */
  | { outcome: "added" }
  /** Someone got there first, or they have already mapped this one. */
  | { outcome: "already_mapped" }
  /** The guide saved fine; the Songbook write did not. Never surfaced as an error. */
  | { outcome: "failed" };

/**
 * Postgres unique_violation. The `song_id` UNIQUE constraint IS the
 * "not yet in the Songbook" rule — checking first and inserting second would
 * race itself the moment two people saved a guide for the same song at once,
 * so we attempt the insert and read the outcome off the error.
 */
const UNIQUE_VIOLATION = "23505";

export const contributeToSongbook = async (args: {
  songId: string;
  setlistId: string;
  creatorId: string;
}): Promise<ContributionResult> => {
  try {
    const { error } = await songbookDb.from("songbook_entries").insert({
      song_id: args.songId,
      setlist_id: args.setlistId,
      creator_id: args.creatorId,
    });
    if (!error) return { outcome: "added" };
    if (error.code === UNIQUE_VIOLATION) return { outcome: "already_mapped" };
    console.error("[songbook] contribution failed", error);
    return { outcome: "failed" };
  } catch (e) {
    // This runs immediately after a guide has been saved successfully. A
    // failure here must never read as "your guide didn't save" — it didn't
    // fail, it just isn't on the shelf yet.
    console.error("[songbook] contribution threw", e);
    return { outcome: "failed" };
  }
};

/**
 * What we say when someone's guide becomes a song's Songbook entry.
 *
 * The thing worth saying is not "saved". It is that a song which had nothing
 * written about it now does, because of them — that is the actual benefit, and
 * it is the mechanism by which a catalog of 234 songs gets filled by people
 * who love it rather than by one person writing a song a week until 2036.
 */
export const SONGBOOK_ADDED_TITLE = "You put this one in the Songbook.";
export const SONGBOOK_ADDED_BODY =
  "Nobody had mapped this song yet — now it's on the shelf for everyone, with your name on it. That's how the Songbook fills: one head at a time, passing on what they found.";

/** The short form, for a toast. */
export const SONGBOOK_ADDED_TOAST = "Added to the Songbook, credited to you";
