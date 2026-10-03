/**
 * First time played / last time played — the two dates every Deadhead argument
 * eventually reaches for, pinned to the Version Explorer's listening guide.
 *
 * Why this is deterministic rather than asked of Charlie: the catalog already
 * knows both dates (`songs.first_played` / `songs.last_played`), and when a
 * guide was generated for "Ramble On Rose" its prose called the debut
 * 1971-10-21 while the catalog says 1971-10-19. A date is a fact, not a
 * flourish — it is read here and labelled, and the prose is left to the prose.
 *
 * A milestone resolves three ways, in order:
 *   1. The explorer already picked that night — label that card, don't repeat it.
 *   2. A tape of that night circulates on the Archive — link and play it.
 *   3. Neither — the night still belongs in the guide, with its date, said
 *      plainly as a night nobody has a tape of.
 */

export type MilestoneKind = "ftp" | "ltp";

/** Enough of a catalog song row to place its milestones. */
export interface MilestoneSong {
  title: string;
  first_played: string | null;
  last_played: string | null;
}

/** Enough of an explorer version to tell whether it is already that night. */
export interface MilestoneCandidate {
  showDate: string;
  venue?: string | null;
  city?: string | null;
  archiveUrl?: string | null;
}

/** What a date→recording lookup hands back. */
export interface MilestoneTape {
  url: string;
  venue?: string | null;
  directTrackUrl?: string | null;
}

export interface MilestoneEntry {
  kind: MilestoneKind;
  /** The milestone date, straight from the songs catalog. */
  date: string;
  venue: string | null;
  city: string | null;
  /** The circulating recording, when one was found. */
  archiveUrl: string | null;
  /** False when the date is known but no tape of it turned up. */
  tapeFound: boolean;
  /**
   * "list"      — the explorer already chose this night; label its card.
   * "archive"   — found on the Archive by date.
   * "none"      — date only. Still shown; that absence is information.
   * "unchecked" — the Archive lookup failed. The date still shows, but nothing
   *               is said about a tape: a 503 is not evidence that none exists.
   */
  source: "list" | "archive" | "none" | "unchecked";
  /** Index of the explorer version this milestone labels, when source is "list". */
  listIndex: number | null;
}

export const MILESTONE_LABEL: Record<MilestoneKind, string> = {
  ftp: "First time played",
  ltp: "Last time played",
};

/** The short form taper culture actually uses. */
export const MILESTONE_SHORT: Record<MilestoneKind, string> = {
  ftp: "FTP",
  ltp: "LTP",
};

/** Archive dates arrive as 1971-10-19 or 1971-10-19T00:00:00Z. Compare the day. */
const sameDay = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.slice(0, 10) === b.slice(0, 10);

/**
 * Index of the explorer version covering `date`, or null when none does.
 * Exported because the card renderer needs the same answer the builder used.
 */
export const findMilestoneInList = (
  date: string | null,
  versions: MilestoneCandidate[],
): number | null => {
  if (!date) return null;
  const i = versions.findIndex((v) => sameDay(v.showDate, date));
  return i === -1 ? null : i;
};

/**
 * Build the milestone entries for a song.
 *
 * `tapes` maps a milestone date to whatever the Archive lookup found for it
 * (or null when the lookup came back empty). `unchecked` holds the dates whose
 * lookup failed outright. Keeping the lookup outside this function is what
 * lets it be tested without the network.
 */
export const buildMilestones = (
  song: MilestoneSong,
  versions: MilestoneCandidate[],
  tapes: Map<string, MilestoneTape | null>,
  unchecked: Set<string> = new Set(),
): MilestoneEntry[] => {
  const entries: MilestoneEntry[] = [];

  const build = (kind: MilestoneKind, date: string | null): MilestoneEntry | null => {
    if (!date) return null;

    const listIndex = findMilestoneInList(date, versions);
    if (listIndex !== null) {
      const v = versions[listIndex];
      return {
        kind,
        date,
        venue: v.venue ?? null,
        city: v.city ?? null,
        archiveUrl: v.archiveUrl ?? null,
        tapeFound: !!v.archiveUrl,
        source: "list",
        listIndex,
      };
    }

    const tape = tapes.get(date);
    if (tape?.url) {
      return {
        kind,
        date,
        venue: tape.venue ?? null,
        city: null,
        archiveUrl: tape.url,
        tapeFound: true,
        source: "archive",
        listIndex: null,
      };
    }

    return {
      kind,
      date,
      venue: null,
      city: null,
      archiveUrl: null,
      tapeFound: false,
      source: unchecked.has(date) ? "unchecked" : "none",
      listIndex: null,
    };
  };

  // A song played once has the same date for both; it is one night, so say it
  // once rather than printing the same card twice under two labels.
  const ftp = build("ftp", song.first_played);
  const ltp = sameDay(song.first_played, song.last_played) ? null : build("ltp", song.last_played);

  if (ftp) entries.push(ftp);
  if (ltp) entries.push(ltp);
  return entries;
};

/** The place line under a milestone date — "Unknown venue" is not a place. */
export const milestonePlace = (entry: MilestoneEntry): string | null => {
  const parts = [entry.venue, entry.city].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : null;
};

/**
 * What the guide says about a milestone with no tape behind it. Taper voice:
 * recordings circulate or they don't — nothing here is "unavailable".
 */
export const NO_TAPE_LINE =
  "No tape of this night circulates — the date is on record, the music isn't.";

/** One line of prose for the saved guide's slot note. */
export const milestoneNote = (entry: MilestoneEntry): string => {
  const place = milestonePlace(entry);
  const where = place ? ` — ${place}` : "";
  const head = `${MILESTONE_LABEL[entry.kind]}: ${entry.date}${where}`;
  return saysNoTape(entry) ? `${head} • ${NO_TAPE_LINE}` : head;
};

/**
 * Whether to say no tape circulates: every tapeless milestone except one whose
 * lookup failed, where the honest answer is that nobody knows yet.
 */
export const saysNoTape = (entry: MilestoneEntry): boolean =>
  !entry.tapeFound && entry.source !== "unchecked";
