// src/lib/charlie/tasteLexicon.ts
// Existing chip ids — keep in sync with VIBES and PRIORITIES arrays
// in src/components/CosmicCharlieDialog.tsx
export type VibeId =
  | "high-energy" | "spacey" | "mellow" | "dark" | "party"
  | "emotional" | "country" | "blues" | "indica" | "sativa" | "hybrid";

export type PriorityId =
  | "deep-jams" | "tight" | "rare" | "classics" | "segues" | "journey"
  // A "Firsts & Lasts" show — songs featured via their FTP (First Time
  // Played) or LTP (Last Time Played) performances. Deadhead vernacular
  // for a debuts-and-swan-songs setlist theme.
  | "firsts-lasts";

// NEW axis — length isn't currently a chip; we capture it from
// free text and pass it through as a hint to ai-deadhead.
export type LengthHint = "tight" | "stretched" | "marathon";

// One trigger maps to one or more chip ids on one or more axes.
// Triggers are matched case-insensitively against substrings of input.
export type TasteTrigger = {
  phrase: string;
  vibes?: VibeId[];
  priorities?: PriorityId[];
  length?: LengthHint;
  // Optional era bias the model should honor when this trigger fires.
  // Era names match the `eras` table in Supabase — keep as natural
  // language descriptors since they go into the LLM prompt, not into
  // a SQL filter.
  eraBias?: string[];
};

export const TASTE_LEXICON: TasteTrigger[] = [
  // ── LENGTH ────────────────────────────────────────────────────────
  // (Length is its own axis, but length triggers also strongly
  //  correlate with the existing "deep-jams" vs "tight" priorities.)
  { phrase: "marathon",      length: "marathon", priorities: ["deep-jams"], eraBias: ["Jazz-Fusion Peak"] },
  { phrase: "40 minute",     length: "marathon", priorities: ["deep-jams"], eraBias: ["Jazz-Fusion Peak"] },
  { phrase: "47 minute",     length: "marathon", priorities: ["deep-jams"], eraBias: ["Jazz-Fusion Peak"] },
  { phrase: "the longest",   length: "marathon", priorities: ["deep-jams"] },
  { phrase: "long strange",  length: "marathon", priorities: ["deep-jams"] },
  { phrase: "long",          length: "stretched", priorities: ["deep-jams"], eraBias: ["Jazz-Fusion Peak", "The '77 Sound"] },
  { phrase: "stretched",     length: "stretched", priorities: ["deep-jams"] },
  { phrase: "extended",      length: "stretched", priorities: ["deep-jams"] },
  { phrase: "winding",       length: "stretched", priorities: ["deep-jams"] },
  { phrase: "tight",         length: "tight",    priorities: ["tight"] },
  { phrase: "punchy",        length: "tight",    priorities: ["tight"] },
  { phrase: "compact",       length: "tight",    priorities: ["tight"] },
  { phrase: "no noodling",   length: "tight",    priorities: ["tight"] },
  // ── ENERGY → VIBES ────────────────────────────────────────────────
  { phrase: "fiery",         vibes: ["high-energy"] },
  { phrase: "fire",          vibes: ["high-energy"] },
  { phrase: "hot",           vibes: ["high-energy"] },
  { phrase: "blazing",       vibes: ["high-energy"] },
  { phrase: "ripping",       vibes: ["high-energy"] },
  { phrase: "rippin",        vibes: ["high-energy"] },
  { phrase: "killer",        vibes: ["high-energy"] },
  { phrase: "killin",        vibes: ["high-energy"] },
  { phrase: "balls out",     vibes: ["high-energy"] },
  { phrase: "intense",       vibes: ["high-energy"] },
  { phrase: "windmill",      vibes: ["high-energy"] },
  { phrase: "barn-burner",   vibes: ["high-energy"], priorities: ["tight"] },
  { phrase: "spacey",        vibes: ["spacey"], priorities: ["deep-jams"] },
  { phrase: "space",         vibes: ["spacey"] },
  { phrase: "cosmic",        vibes: ["spacey"] },
  { phrase: "psychedelic",   vibes: ["spacey"] },
  { phrase: "stratosphere",  vibes: ["spacey"], priorities: ["deep-jams"] },
  { phrase: "transcendent",  vibes: ["spacey"] },
  { phrase: "ether",         vibes: ["spacey"] },
  { phrase: "weird",         vibes: ["spacey"], priorities: ["rare"] },
  { phrase: "trippy",        vibes: ["spacey"] },
  { phrase: "space-jungle",  vibes: ["spacey"] },
  { phrase: "brain melt",    vibes: ["spacey"], priorities: ["deep-jams"], eraBias: ["Jazz-Fusion Peak"] },
  { phrase: "brain-melt",    vibes: ["spacey"], priorities: ["deep-jams"], eraBias: ["Jazz-Fusion Peak"] },
  { phrase: "brain dissolv", vibes: ["spacey"], priorities: ["deep-jams"], eraBias: ["Jazz-Fusion Peak"] },
  { phrase: "mind blow",     vibes: ["spacey"], priorities: ["deep-jams"] },
  { phrase: "freaky",        vibes: ["spacey"], priorities: ["rare"] },
  { phrase: "haunted",       vibes: ["spacey"] },
  { phrase: "mellow",        vibes: ["mellow"] },
  { phrase: "groovy",        vibes: ["mellow"] },
  { phrase: "easy",          vibes: ["mellow"] },
  { phrase: "campfire",      vibes: ["mellow"] },
  { phrase: "indica",        vibes: ["indica"] },
  { phrase: "sativa",        vibes: ["sativa"] },
  { phrase: "hybrid",        vibes: ["hybrid"] },
  { phrase: "dark",          vibes: ["dark", "emotional"] },
  { phrase: "heavy",         vibes: ["dark"] },
  { phrase: "minor key",     vibes: ["dark"] },
  { phrase: "longing",       vibes: ["dark", "emotional"] },
  { phrase: "party",         vibes: ["party"] },
  { phrase: "joyful",        vibes: ["party"] },
  { phrase: "celebration",   vibes: ["party"] },
  { phrase: "crowd",         vibes: ["party"] },
  { phrase: "emotional",     vibes: ["emotional"] },
  { phrase: "raw",           vibes: ["emotional"] },
  { phrase: "tender",        vibes: ["emotional", "mellow"] },
  { phrase: "beautiful",     vibes: ["emotional"] },
  { phrase: "sweet",         vibes: ["emotional", "mellow"] },
  { phrase: "soaring",       vibes: ["emotional"] },
  { phrase: "lilting",       vibes: ["emotional"] },
  { phrase: "haunting",      vibes: ["emotional", "dark"] },
  { phrase: "tears",         vibes: ["emotional"] },
  { phrase: "country",       vibes: ["country"] },
  { phrase: "folk",          vibes: ["country"] },
  { phrase: "americana",     vibes: ["country"] },
  { phrase: "front porch",   vibes: ["country"] },
  { phrase: "blues",         vibes: ["blues"] },
  { phrase: "pigpen",        vibes: ["blues"], eraBias: ["Primal Dead"] },
  { phrase: "gritty",        vibes: ["blues"] },
  { phrase: "grit",          vibes: ["blues"] },
  { phrase: "silky",         vibes: ["mellow"], eraBias: ["The '77 Sound"] },
  { phrase: "silky smooth",  vibes: ["mellow"], eraBias: ["The '77 Sound"] },
  { phrase: "smooth",        vibes: ["mellow"] },
  { phrase: "jazzy",         vibes: ["mellow"], priorities: ["deep-jams"] },
  // ── PRIORITY-LIKE TRIGGERS ────────────────────────────────────────
  { phrase: "segue",         priorities: ["segues"] },
  { phrase: "segway",        priorities: ["segues"] }, // misspelling tolerance
  { phrase: "sandwich",      priorities: ["segues"] },
  { phrase: "sandwiched",    priorities: ["segues"] },
  { phrase: ">",             priorities: ["segues"] },
  { phrase: "->",            priorities: ["segues"] },
  { phrase: "leads into",    priorities: ["segues"] },
  { phrase: "flowing",       priorities: ["segues"] },
  { phrase: "rare",          priorities: ["rare"] },
  { phrase: "deep cut",      priorities: ["rare"] },
  { phrase: "bustout",       priorities: ["rare"] },
  { phrase: "underrated",    priorities: ["rare"] },
  { phrase: "obscure",       priorities: ["rare"] },
  { phrase: "hidden",        priorities: ["rare"] },
  { phrase: "sleeper",       priorities: ["rare"] },
  { phrase: "classic",       priorities: ["classics"] },
  { phrase: "the hits",      priorities: ["classics"] },
  { phrase: "essentials",    priorities: ["classics"] },
  { phrase: "journey",       priorities: ["journey"] },
  { phrase: "a real ride",   priorities: ["journey"] },
  { phrase: "mix of everything", priorities: ["journey"] },
  { phrase: "deep jam",      priorities: ["deep-jams"] },
  { phrase: "stretch out",   priorities: ["deep-jams"] },
  { phrase: "jam vehicle",   priorities: ["deep-jams"] },
  { phrase: "exploration",   priorities: ["deep-jams"] },
  { phrase: "improv",        priorities: ["deep-jams"] },
  // ── FIRSTS & LASTS ──────────────────────────────────────────────
  // Deadhead vernacular. FTP = First Time Played (debut of a song),
  // LTP = Last Time Played (final performance). "Firsts and lasts"
  // shows anchor around a handful of these dates.
  { phrase: "ftp",             priorities: ["firsts-lasts"] },
  { phrase: "ltp",             priorities: ["firsts-lasts"] },
  { phrase: "first time played", priorities: ["firsts-lasts"] },
  { phrase: "last time played",  priorities: ["firsts-lasts"] },
  { phrase: "firsts and lasts",  priorities: ["firsts-lasts"] },
  { phrase: "firsts & lasts",    priorities: ["firsts-lasts"] },
  { phrase: "debut",             priorities: ["firsts-lasts"] },
  { phrase: "swan song",         priorities: ["firsts-lasts"] },
  { phrase: "premiere",          priorities: ["firsts-lasts"] },
  { phrase: "farewell",          priorities: ["firsts-lasts"] },
];

// ─── Extraction ────────────────────────────────────────────────────
export type TasteMatches = {
  vibes: VibeId[];        // deduped, in trigger order
  priorities: PriorityId[];
  length?: LengthHint;     // strongest length signal wins
  eraBias: string[];       // deduped union of all era bias hints
  matchedPhrases: string[]; // for debug + UI feedback
};

export function extractTasteMatches(input: string): TasteMatches {
  const lower = (input || "").toLowerCase();
  const vibes = new Set<VibeId>();
  const priorities = new Set<PriorityId>();
  const eraBias = new Set<string>();
  const matchedPhrases: string[] = [];
  let length: LengthHint | undefined;

  // Length precedence: marathon > stretched > tight (longest wins)
  const lengthRank: Record<LengthHint, number> = { tight: 0, stretched: 1, marathon: 2 };

  for (const t of TASTE_LEXICON) {
    if (!lower.includes(t.phrase.toLowerCase())) continue;
    matchedPhrases.push(t.phrase);
    t.vibes?.forEach((v) => vibes.add(v));
    t.priorities?.forEach((p) => priorities.add(p));
    t.eraBias?.forEach((e) => eraBias.add(e));
    if (t.length) {
      if (!length || lengthRank[t.length] > lengthRank[length]) {
        length = t.length;
      }
    }
  }

  return {
    vibes: Array.from(vibes),
    priorities: Array.from(priorities),
    length,
    eraBias: Array.from(eraBias),
    matchedPhrases,
  };
}
