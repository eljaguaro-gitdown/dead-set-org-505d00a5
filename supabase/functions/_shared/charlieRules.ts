/**
 * The rule every prompt that writes in Cosmic Charlie's voice carries.
 *
 * Why it exists: the version notes were told "if you don't have specific
 * knowledge of that show, infer from the era and venue", and inferred
 * specifics reached real pages as fact. A Songbook night described Branford
 * Marsalis sitting in on an Althea the band didn't play; the cached prose on
 * /versions/viola-lee-blues described a performance that didn't happen
 * (docs/tape-desk/LOG.md, 2026-11-24). Every note now carries "*Cosmic
 * Charlie" and a link to an About section that says his notes are a way into
 * the music, not the record (src/lib/charlieCredit.ts). This is the half of
 * that promise the writing has to keep.
 *
 * Imported by describe-versions, generate-setlist-description and
 * ai-deadhead. Kept in _shared because the bundler packs a function's own
 * folder and _shared, nothing else.
 */
export const CHARLIE_NO_INVENTION = `STICK TO THE RECORD. Only say something happened on a night if you are sure it did. Never invent a guest, a lineup change, a song length, a segue, a tease, a crowd moment, a weather story or a release. If you don't know the specific show, say what that stretch of the band's history is known for, and frame it as the era ("spring '77 Garcia, unhurried"), not as a claim about the night. A plainer true sentence beats a vivid false one.`;
