// Objectionable-language filter for everything fans type into the app:
// setlist titles and descriptions, comments, direct messages, setlist chat,
// display names. App Store guideline 1.2 asks for "a method for filtering
// objectionable content"; this is the client half.
//
// The server half is public.is_objectionable() in
// supabase/migrations/20260930120000_ugc_safety_pass.sql, called by BEFORE
// INSERT/UPDATE triggers on each of those tables — the anon key is public, so
// a client-only check would be a suggestion, not a filter. The two term lists
// must match; src/lib/__tests__/contentFilterSync.test.ts reads the migration
// and fails if they drift. Add a term in BOTH places, in a NEW migration.
//
// The list is deliberately short and unambiguous. Every term is matched as a
// whole word, so the catalogue survives: Dick's Picks, Cumberland Blues, Hell
// in a Bucket and Scarlet Begonias all pass (see the tests). A term that is
// also a common name stays off — "Kike" is Enrique in Spanish, and a Google
// sign-in carrying it would otherwise be refused a display name. Anything
// this misses is what report and block are for.

export const OBJECTIONABLE_TERMS: readonly string[] = [
  // slurs
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "tranny",
  "retard",
  "wetback",
  "gook",
  "raghead",
  "towelhead",
  "beaner",
  // sexual
  "porn",
  "porno",
  "blowjob",
  "handjob",
  "cumshot",
  "dildo",
  "pussy",
  "cunt",
  "twat",
  "whore",
  "slut",
  // abuse
  "fuck",
  "motherfucker",
  "bitch",
  "asshole",
  "kys",
  "kill yourself",
  "kill urself",
  "heil hitler",
  "sieg heil",
];

// Suffixes that ride along on a stem: "fucking", "sluts", "retarded".
// Deliberately no "y" — it turns harmless words into matches.
const SUFFIXES = "(?:s|es|ed|er|ers|ing|in)?";

// Common substitutions, applied before matching. Mirrored by translate() in
// the SQL function.
const LEET_FROM = "013457@$!";
const LEET_TO = "oieastasi";

/** Lowercase, strip accents, undo leetspeak. */
export const normalizeForFilter = (text: string): string => {
  let out = text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (let i = 0; i < LEET_FROM.length; i++) {
    out = out.split(LEET_FROM[i]).join(LEET_TO[i]);
  }
  return out;
};

// Each letter may repeat ("fuuuck"); a space in a phrase matches any run of
// non-letters ("kill-yourself"). Same construction as the SQL side.
const termPattern = (term: string): string =>
  term
    .split(" ")
    .map((word) => word.split("").map((c) => `${c}+`).join(""))
    .join("[^a-z]+");

const PATTERN = new RegExp(
  `(?<![a-z])(?:${OBJECTIONABLE_TERMS.map(termPattern).join("|")})${SUFFIXES}(?![a-z])`,
);

/** True when the text contains a term the house rules turn away. */
export const isObjectionable = (text: string | null | undefined): boolean =>
  !!text && PATTERN.test(normalizeForFilter(text));

/** What a fan sees when the filter stops a post. */
export const OBJECTIONABLE_MESSAGE =
  "That's got language the house rules don't allow — try it another way.";
