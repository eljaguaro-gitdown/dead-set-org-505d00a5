import { METHOD_LINE, NO_VOTES_LINE } from "@/lib/sleeperMath";

/**
 * Who wrote this? The credit rule for Cosmic Charlie's liner notes.
 *
 * THE RULE (set by the owner, 2026-11-26): wherever words Charlie wrote are
 * shown, sent or shared, they carry an asterisk that names him as the author,
 * and "Cosmic Charlie" links to the About page section that says who he is,
 * where his facts come from, and who inspired the voice. On a page that is
 * `<CharlieCredit />`. In plain text (a share, an email) it is
 * `withCharlieCredit()`.
 *
 * Words are credited by where they came from, never by how they read:
 *
 *   - "charlie"  Charlie wrote it: a setlist's liner notes, his note on a
 *                version, his picks and their reasons, the notes he puts on a
 *                slot when he builds a night.
 *   - "member"   A head wrote it, or rewrote Charlie's words. Once a member
 *                edits a note it is theirs, and Charlie's credit comes off.
 *                That is the plan for the whole site: the community's words
 *                replace his.
 *   - "dead_set" Labels and lines the site itself writes ("From 1977-05-08 ·
 *                Barton Hall", "First time played", the method line on a
 *                voted guide).
 *
 * Unknown provenance gets no credit. Crediting Charlie with a member's words
 * is the same mistake as the reverse.
 */

export type NotesBy = "charlie" | "member" | "dead_set";

/** The About section that explains him. One anchor, used everywhere. */
export const CHARLIE_ANCHOR = "cosmic-charlie";
export const CHARLIE_ABOUT_PATH = `/about#${CHARLIE_ANCHOR}`;
export const CHARLIE_ABOUT_URL = `https://dead-set.org${CHARLIE_ABOUT_PATH}`;

/** The byline, as printed after his words. */
export const CHARLIE_BYLINE = "Cosmic Charlie";

/**
 * Who wrote a setlist's description.
 *
 * Every writer of `setlists.description` is Charlie (his explanation when he
 * builds a night, or the liner notes he writes on request) except the two
 * lines the version picker writes on a saved guide (`METHOD_LINE` and
 * `NO_VOTES_LINE` in sleeperMath), which are the site's own sentences.
 * `charlieCredit.test.ts` holds the list of writers, so a new one cannot slip
 * in without a decision here.
 */
export const descriptionBy = (description: string | null | undefined): NotesBy | null => {
  const text = description?.trim();
  if (!text) return null;
  if (text === NO_VOTES_LINE || text.endsWith(METHOD_LINE)) return "dead_set";
  return "charlie";
};

/**
 * Charlie's words in plain text, credited. For a share or an email, where
 * there is no link to click: the asterisk and the byline, and the About URL
 * only when the caller has room for it.
 */
export const withCharlieCredit = (text: string, opts: { withUrl?: boolean } = {}): string => {
  const body = text.trim();
  if (!body) return body;
  const byline = opts.withUrl
    ? `*${CHARLIE_BYLINE} (${CHARLIE_ABOUT_URL})`
    : `*${CHARLIE_BYLINE}`;
  return `${body}* ${byline}`;
};

/**
 * Whose words a slot Charlie suggested starts with. His, unless the
 * suggestion says otherwise: a listening guide's first/last-played rows are
 * the site's labels, and a voted guide's reasons are the curated blurbs.
 */
export const suggestedNotesBy = (song: { notes?: string | null; notesBy?: NotesBy | null }): NotesBy | null => {
  if (song.notesBy !== undefined) return song.notesBy;
  return song.notes?.trim() ? "charlie" : null;
};
