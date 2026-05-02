import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-visitor-id",
};

// ── Creative seeds (STRUCTURE-ONLY, no song names) ─────────────────────
// Earlier versions of this prompt name-dropped 30+ songs as "examples,"
// which the LLM treated as defaults. These are intentionally song-agnostic.
const THEME_SEEDS = [
  "Build the show around a single Set II monster jam vehicle that becomes the gravitational center of the night. Everything before it builds tension; everything after emerges changed.",
  "Make Set I a slow burn — start mellow, almost acoustic in feel, then gradually ignite until the closer blows the roof off.",
  "Construct a show where Set II is almost entirely segued — one continuous musical journey from opener to closer.",
  "Build a sandwich structure: open Set II with a long-form vehicle, let other songs nest inside it, then reprise the opener to close or near-close.",
  "Design a show where the encore is the emotional climax. Let Set II end raw and unresolved; let the encore deliver catharsis.",
  "Build a DARK show — minor keys, longing, existential weight. Let the light in only at the very end.",
  "Build a JOYFUL show — pure celebration, no shadows. The crowd should be grinning from song one.",
  "Build a show that feels like a late-night campfire — intimate, acoustic-leaning where possible, storytelling songs, gentle jams that breathe.",
  "Build a WEIRD show — deep cuts, rare bustouts, unexpected pairings. The show tape traders argue about for decades.",
  "Build a show with maximum dynamic range — whisper-quiet passages adjacent to explosive peaks. Make the listener feel the contrast.",
  "Feature at least two genuine bustouts — songs that almost never appeared in this position or this era.",
  "Anchor the show around the Hunter/Garcia songwriting partnership — prioritize their co-writes.",
  "Give Bob Weir the spotlight — let his songs drive the setlist's spine.",
  "Build around the country and folk roots layer of the catalog — Americana early, but still go deep in Set II.",
  "Highlight the band's blues lineage — raw, gritty, Pigpen-spirited material in the early register.",
  "Build the show you'd want to hear at an outdoor amphitheater at sunset — golden hour energy bleeding into starlight.",
  "Build the show that would convert a skeptic. Tight, powerful, purposeful — prove the music's case in the first three songs.",
  "Build a show that traces the band's evolution — open with their earliest repertoire, close with their latest.",
  "Build the ultimate Set II — as if telling someone 'just listen to this second set and you'll understand everything.'",
  "Build a show where every transition is narratively motivated — chapters in a book, not tracks on a playlist.",
  "Build a show that lives in long form — fewer songs, more breathing room, every piece allowed to develop.",
  "Build a show that lives in short form — more songs, more variety, less indulgence. A pop show by a psychedelic band.",
  "Build a show centered on a single mood that never wavers — the band finds one frequency and stays inside it for two sets.",
  "Build a show that opens dark and ends in pure light — the arc is the entire point.",
];

const OPENER_CONSTRAINTS = [
  "Open Set I with a mid-tempo groover that says 'we're locked in.' Not a ballad, not a jam vehicle.",
  "Open Set I with pure explosive energy — a barn-burner that gets the crowd moving from the first note.",
  "Open Set I with something unexpected — a deep cut or a song usually buried mid-set. Signal that tonight is not a normal night.",
  "Open Set I with a classic crowd-pleaser — the kind of opener that makes 20,000 people roar at the first chord.",
  "Open Set I with a slow-building song that can stretch — let the band find each other before pressing.",
  "Open Set I with something that immediately establishes the era — a song that could ONLY open a show in this particular period.",
  "Open Set I with a country or folk-leaning number — set the room expecting one thing before pivoting in song two.",
];

const CLOSER_CONSTRAINTS = [
  "Close Set I with pure energy — a rocker that leaves them buzzing through intermission.",
  "Close Set I with a dramatic building song that ends on a peak.",
  "Close Set II with a transcendent jam vehicle at full power.",
  "Close Set II with something emotionally devastating — stunned silence before the encore.",
  "Close Set II with a rocker that leaves them screaming.",
  "Close Set II with a RARE closer — a song the band almost never ended with.",
  "Close Set II with a quiet, spacious song that refuses the obvious peak — let the encore provide release instead.",
];

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

// Songs that are part of the show structure regardless of variety concerns
const STRUCTURAL_SONGS = new Set(["drums", "space", "drumz"]);

// Canonical pair partners — if one appears, the other almost always should
const CANONICAL_PAIRS: Array<[string, string]> = [
  ["china cat sunflower", "i know you rider"],
  ["scarlet begonias", "fire on the mountain"],
  ["help on the way", "slipknot"],
  ["slipknot", "franklin's tower"],
  ["estimated prophet", "eyes of the world"],
];

// ── Fuzzy song title matching ──────────────────────────────────────────
function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s*>\s*/g, " ")
    .replace(/\s*→\s*/g, " ")
    .replace(/[^a-z0-9' ]/g, "")
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function findBestMatch(title: string, songMap: Map<string, any>): any | null {
  const norm = normalizeTitle(title);
  for (const [key, song] of songMap) {
    if (normalizeTitle(key) === norm) return song;
  }
  for (const [key, song] of songMap) {
    const nk = normalizeTitle(key);
    if (nk.includes(norm) || norm.includes(nk)) return song;
  }
  let bestSong: any = null;
  let bestDist = Infinity;
  for (const [key, song] of songMap) {
    const nk = normalizeTitle(key);
    const dist = levenshtein(norm, nk);
    const maxLen = Math.max(norm.length, nk.length);
    if (dist < bestDist && dist / maxLen <= 0.2) {
      bestDist = dist;
      bestSong = song;
    }
  }
  return bestSong;
}

// ── Catalog windowing: bias toward songs the user hasn't seen ───────────
function buildCatalogWindow(
  allSongs: any[],
  recentTitlesNorm: Set<string>,
  targetSize = 120,
): any[] {
  // Always include: jam vehicles, structural songs, canonical pair anchors
  const anchors: any[] = [];
  const anchorIds = new Set<string>();
  const canonicalAnchorTitles = new Set<string>(
    CANONICAL_PAIRS.flatMap(([a, b]) => [a, b]),
  );
  for (const s of allSongs) {
    const norm = normalizeTitle(s.title);
    if (
      s.is_jam_vehicle ||
      STRUCTURAL_SONGS.has(norm) ||
      canonicalAnchorTitles.has(norm)
    ) {
      anchors.push(s);
      anchorIds.add(s.id);
    }
  }

  const remaining = allSongs.filter((s) => !anchorIds.has(s.id));
  // Weight: songs NOT in recent get weight 4, songs in recent get weight 1
  const weighted = remaining.map((s) => ({
    s,
    w: recentTitlesNorm.has(normalizeTitle(s.title)) ? 1 : 4,
  }));

  const window = [...anchors];
  const need = Math.max(0, targetSize - anchors.length);
  // Weighted sample without replacement
  const pool = [...weighted];
  for (let i = 0; i < need && pool.length > 0; i++) {
    const totalW = pool.reduce((sum, x) => sum + x.w, 0);
    let r = Math.random() * totalW;
    let pickIdx = 0;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].w;
      if (r <= 0) {
        pickIdx = j;
        break;
      }
    }
    window.push(pool[pickIdx].s);
    pool.splice(pickIdx, 1);
  }
  return window;
}

// ── Curatorial interpretation guide ────────────────────────────────────
const VIBE_INTERPRETATION = `
INTERPRETING VIBES — these are emotional atmospheres, not song lists.
Do not pick songs because the atmosphere word reminds you of them. Ask: what does
a night that achieves this atmosphere actually look like in structure?

- "High Energy": Set I opens with authority and never releases pressure. Set II
  escalates, doesn't drift. Closers land hard. No meandering.
- "Spacey & Psychedelic": The setlist has negative space. Long vehicles. Jams
  that don't resolve when expected. Set II should feel like it could go anywhere
  — then go there.
- "Mellow & Groovy": The night breathes. Set I has Americana weight. Set II
  grooves rather than surges. The closing song leaves space rather than filling it.
- "Dark & Heavy": The emotional register stays low and serious. No party songs,
  no throwaway covers. The night should feel like it means something.
- "Party Night": The band plays to the room. Openers announce themselves. Crowd
  songs know what they are. This is not a lesser night — it is a specific greatness.
- "Emotional & Raw": The setlist earns tears. Songs that carry weight beyond their
  words. Jerry's voice doing more than singing.
- "Country & Folk Roots": The Americana layer surfaces. Set I feels like a front
  porch. Set II can still go deep.
- "Blues & Grit": Pigpen's ghost is in the room. The rawer, earlier register.
- "Indica": Slow, heavy, meditative. Songs breathe longer than expected. Tempos
  deliberate. Jams don't rush. The setlist should feel like sinking into a warm bath.
- "Sativa": Alert and spacious. Bright, clear energy. Forward-moving, exploratory
  but not lost. The setlist should feel like sunshine and ideas flowing.
- "Hybrid": Balanced — neither overwhelming psychedelia nor pure accessibility.
  Dynamic range: gentle passages next to peaks, contemplation followed by burners.

When multiple vibes are selected, find the emotional logic that holds them together
rather than alternating between them.
`;

const PRIORITY_INTERPRETATION = `
INTERPRETING PRIORITIES — these are structural instructions, not preferences.

- "Deep jams — let them stretch out": At least one Set II song must function as
  a true jam vehicle with explicit intent to extend. Mark it with a segue arrow.
  The jam IS the point.
- "Tight & punchy — no noodling": No extended jam vehicles. Set II runs like Set I
  — song to song, no extended space. Energy lives in precision, not exploration.
- "Surprise me with rare songs": Include at least two songs played fewer than 50
  times. Rare songs must be earned — placed where they make structural sense.
- "Stick to the classics": Build the strongest possible setlist from songs a
  Deadhead recognizes in the first two notes. The test is "does this deserve its
  place in THIS night's arc."
- "Lots of segues — keep it flowing": Every Set II transition marked with →. Aim
  for at least one three-song segue chain.
- "Mix of everything — a real journey": A real journey has movement — goes
  somewhere unexpected, returns changed. Set I establishes the world. Set II
  challenges it. The encore resolves it.
`;

const AHA_MOMENT_REQUIREMENT = `
THE AHA MOMENT (REQUIRED — EXACTLY ONE PER SETLIST):

Every setlist must contain one moment a sophisticated Deadhead would stop at and
say: "wait — did they actually do that?"

This is NOT a rare song for its own sake. It is a placement, a pairing, or a
contextual choice that reframes something familiar as something unexpected:
  — A song that signals "the end" placed mid-Set II instead of as a closer
  — A song so rarely played in a given era that its appearance feels like a visitation
  — A traditionally-quiet song used as an opener (resets the emotional register)
  — A three-song sequence that historically appeared together once or twice,
    reconstructed intentionally

One per setlist. Earned, not random. The rest of the setlist must be strong enough
that this moment lands. A setlist of all surprises is chaos.

YOU MUST FLAG THIS MOMENT in your explanation. Tell the user exactly what it is
and why it matters.
`;

const EXPLANATION_FORMAT = `
THE EXPLANATION (REQUIRED — A LINER NOTE, NOT A SUMMARY):

Write it as if you are David Lemieux introducing this show on SiriusXM's Grateful
Dead Channel — someone who has listened to every show and understands what it
means when a certain song appears in a certain position.

Requirements:
  — Open with the emotional world this setlist inhabits
  — Name the structural spine (what is Set I building toward? what does Set II
    open into? where does the encore leave us?)
  — Identify the aha moment explicitly and tell the user why it matters
  — Close with one sentence that tells them what kind of night this was

Length: 120–180 words. Voice: authoritative, passionate, specific. Never generic.
`;

const OPTIONAL_FIELDS_GUIDE = `
INTERPRETING OPTIONAL TEXT FIELDS:

"Must include" — anchors. Build around them. If a segue pair is specified, honor
the arrow and place structurally, not just wherever it fits.

"Please avoid" — honor absolutely. Do not include avoided songs or close variants.

"It's for…" — the most important field. Read it seriously. Calibrate the entire
show against the listener it's designed for.
`;

const VARIETY_DIRECTIVE = `
VARIETY MANDATE (NON-NEGOTIABLE):

This is not the only setlist you will ever build. Treat every generation as a
chance to reach for songs the catalog rarely surfaces. Do NOT default to the
most-named songs in your training data. Do NOT repeat the same five "go-to"
choices that other LLMs reach for first.

Specifically:
  — At MOST two of the eight most-iconic Dead songs may appear in any single
    setlist. (Iconic = the songs everyone names when asked "name a Dead song.")
  — Lean into the long tail of the catalog. The 198-song catalog contains
    overlooked gems; surface them.
  — When in doubt between a famous song and a less-famous one that fits the same
    role, pick the less-famous one — unless the famous one is structurally
    essential to the night.

If the user is a returning user, you will be given a list of songs they've recently
seen. Treat that list as forbidden unless absolutely necessary for canonical pairs
or structural reasons (Drums/Space). Repeating a recent song without justification
is a failure mode.
`;

const INTRA_SETLIST_DIVERSITY = `
INTRA-SETLIST DIVERSITY MANDATE (NON-NEGOTIABLE — applies WITHIN this single show):

1. ZERO duplicate songs. No song appears more than once across all sets and the encore.
   Drums and Space each appear at most once. Reprises are the ONLY exception and must
   be flagged in notes as an intentional sandwich/reprise.

2. TAG DIVERSITY. Every song carries tags (e.g., ballad, rocker, jam, blues, country,
   gospel, cover, jerry, bob, brent, pigpen, psychedelic, americana). In a 12-15 song
   show, NO single tag may dominate more than ~35% of the songs. Aim for at least
   6 distinct tags represented across the show.

3. VOCALIST ROTATION. Do not stack 4+ Jerry songs, 4+ Bob songs, etc. consecutively.
   Rotate lead vocalists across each set so the texture keeps shifting.

4. TEMPO & MOOD CONTRAST. Adjacent songs should not all share the same tempo bucket
   (slow/mid/up). Build undulation: ballad → mid-tempo → barn-burner, not three
   ballads in a row.

5. SET-POSITION HONESTY. Respect each song's typical_set_position when given. A
   song tagged "encore" doesn't open Set I unless that IS the deliberate aha moment.

If you cannot honor all five with the windowed catalog, prefer the rarer, less-named
song over the famous one. Diversity beats familiarity.
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    const visitorIdHeader = req.headers.get("x-visitor-id");
    let callingUser: any = null;
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (!userError && user) callingUser = user;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      mode,
      eraId,
      currentSlots,
      preferences,
      recentSongs: clientRecentSongs,
      songTitle,
      songId,
      eraIds,
      visitorId: bodyVisitorId,
    } = await req.json();

    const visitorId = visitorIdHeader || bodyVisitorId || null;

    // ── EXPLORE MODE — unchanged ─────────────────────────────────────────
    if (mode === "explore") {
      const { data: allSongs } = await supabase.from("songs").select("*");
      const { data: allEras } = await supabase.from("eras").select("*");

      const song = (allSongs || []).find((s: any) => s.id === songId);
      if (!song) {
        return new Response(JSON.stringify({ error: "Song not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let versionsQuery = supabase.from("notable_versions").select("*").eq("song_id", songId);
      if (eraIds && eraIds.length > 0) {
        versionsQuery = versionsQuery.in("era_id", eraIds);
      }
      const { data: versions } = await versionsQuery.order("rating", { ascending: false });

      const eraMap = new Map((allEras || []).map((e: any) => [e.id, e]));
      const versionsContext = (versions || []).map((v: any) => {
        const era = v.era_id ? eraMap.get(v.era_id) : null;
        return `- ${v.show_date} at ${v.venue || "Unknown Venue"}, ${v.city || "Unknown City"} (rating: ${v.rating}/5, era: ${era?.name || "Unknown"})${v.description ? ` — "${v.description}"` : ""}${v.archive_org_url ? ` [archive: ${v.archive_org_url}]` : ""}`;
      }).join("\n");

      const selectedEraNames = eraIds && eraIds.length > 0
        ? eraIds.map((id: string) => eraMap.get(id)?.name || "Unknown").join(", ")
        : "all eras";

      const exploreSystemPrompt = `You are Cosmic Charlie — a veteran Deadhead tape trader and version connoisseur. You've listened to every circulating recording and you know exactly which versions of a song are essential listening.

A user wants to discover the best versions of "${song.title}" across ${selectedEraNames}.

YOUR JOB:
1. Select 5-8 of the best, most interesting, or most historically significant versions of this song.
2. For EACH version, explain WHY it matters — what makes this particular performance special.
3. Write comprehensive liner notes (200-300 words) that tell the story of this song across eras.

CRITICAL VOICE GUIDELINES:
- Write like David Lemieux or a Rolling Stone critic. Authoritative, passionate, specific.
- Reference real Deadhead community consensus where appropriate.
- Don't just describe the music — tell the STORY of why this version matters.

${versionsContext.length > 0 ? `KNOWN NOTABLE VERSIONS IN THE DATABASE:\n${versionsContext}\n\nUse these as your primary source.` : `No pre-cataloged versions found for this song.`}

SONG INFO:
- Title: ${song.title}
- Times played: ${song.times_played || "Unknown"}
- First played: ${song.first_played || "Unknown"}
- Last played: ${song.last_played || "Unknown"}
- Jam vehicle: ${song.is_jam_vehicle ? "Yes" : "No"}
- Tags: ${(song.tags || []).join(", ") || "None"}

You MUST respond using the explore_versions tool.`;

      const exploreTools = [
        {
          type: "function",
          function: {
            name: "explore_versions",
            description: "Return curated versions of a song with detailed liner notes.",
            parameters: {
              type: "object",
              properties: {
                linerNotes: { type: "string" },
                versions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      showDate: { type: "string" },
                      venue: { type: "string" },
                      city: { type: "string" },
                      eraName: { type: "string" },
                      rating: { type: "number" },
                      archiveUrl: { type: "string" },
                      whyThisVersion: { type: "string" },
                    },
                    required: ["showDate", "venue", "city", "eraName", "rating", "whyThisVersion"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["linerNotes", "versions"],
              additionalProperties: false,
            },
          },
        },
      ];

      const exploreResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          temperature: 0.8,
          messages: [
            { role: "system", content: exploreSystemPrompt },
            { role: "user", content: `I love "${song.title}" and want to discover the best versions I haven't heard yet.` },
          ],
          tools: exploreTools,
          tool_choice: { type: "function", function: { name: "explore_versions" } },
        }),
      });

      if (!exploreResponse.ok) {
        if (exploreResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (exploreResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const text = await exploreResponse.text();
        console.error("AI gateway error:", exploreResponse.status, text);
        throw new Error("AI gateway error");
      }

      const exploreData = await exploreResponse.json();
      const exploreToolCall = exploreData.choices?.[0]?.message?.tool_calls?.[0];
      if (!exploreToolCall) throw new Error("No tool call in response");
      const exploreResult = JSON.parse(exploreToolCall.function.arguments);
      const enrichedVersions = exploreResult.versions.map((v: any) => {
        const dbVersion = (versions || []).find((dbv: any) => dbv.show_date === v.showDate);
        return {
          ...v,
          archiveUrl: v.archiveUrl || dbVersion?.archive_org_url || null,
          description: dbVersion?.description || null,
        };
      });

      return new Response(JSON.stringify({
        songTitle: song.title,
        linerNotes: exploreResult.linerNotes,
        versions: enrichedVersions,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── BUILD / IMPROVE MODE ─────────────────────────────────────────────
    const { data: allSongs } = await supabase.from("songs").select("id, title, tags, is_jam_vehicle, typical_set_position, times_played, first_played, last_played");
    const { data: eras } = await supabase.from("eras").select("*");
    const eraInfo = eraId ? eras?.find((e: any) => e.id === eraId) : null;

    let songs = allSongs || [];
    if (eraInfo) {
      songs = songs.filter((s: any) => {
        if (!s.first_played) return false;
        const firstYear = parseInt(s.first_played.substring(0, 4), 10);
        const lastYear = s.last_played ? parseInt(s.last_played.substring(0, 4), 10) : 9999;
        return firstYear <= eraInfo.year_end && lastYear >= eraInfo.year_start;
      });
    }

    let versions: any[] = [];
    if (eraId) {
      const { data } = await supabase.from("notable_versions").select("*").eq("era_id", eraId);
      versions = data || [];
    }

    // ── Load this user/visitor's recent generation history (server-side) ──
    let serverRecentTitles: string[] = [];
    try {
      let histQuery = supabase
        .from("cosmic_charlie_history")
        .select("song_title, generated_at")
        .order("generated_at", { ascending: false })
        .limit(80);
      if (callingUser) {
        histQuery = histQuery.eq("user_id", callingUser.id);
      } else if (visitorId) {
        histQuery = histQuery.eq("visitor_id", visitorId);
      } else {
        histQuery = histQuery.limit(0);
      }
      const { data: histRows } = await histQuery;
      const seen = new Set<string>();
      for (const r of histRows || []) {
        const t = (r as any).song_title;
        if (t && !seen.has(t)) {
          seen.add(t);
          serverRecentTitles.push(t);
        }
      }
    } catch (e) {
      console.warn("[ai-deadhead] history load failed:", e);
    }

    // Merge with any client-supplied recentSongs
    const mergedRecent: string[] = [
      ...new Set([
        ...serverRecentTitles,
        ...(Array.isArray(clientRecentSongs) ? clientRecentSongs : []),
      ]),
    ].slice(0, 80);

    const recentNorm = new Set(mergedRecent.map((t) => normalizeTitle(t)));

    // Build a windowed catalog biased toward songs the user hasn't seen
    const windowedSongs = buildCatalogWindow(songs, recentNorm, 130);

    const songCatalog = windowedSongs.map((s: any) =>
      `- "${s.title}" (tags: ${(s.tags || []).join(", ")}, jam: ${s.is_jam_vehicle}, position: ${s.typical_set_position || "any"}, played: ${s.times_played}x)`
    ).join("\n");

    // Surface 4 deliberate "novelty hints" — songs the user has NEVER seen.
    const noveltyCandidates = windowedSongs.filter(
      (s: any) => !recentNorm.has(normalizeTitle(s.title)) && !STRUCTURAL_SONGS.has(normalizeTitle(s.title)),
    );
    const noveltyHints = pickRandom(noveltyCandidates, 4).map((s: any) => s.title);
    const noveltyBlock = noveltyHints.length > 0
      ? `\nNOVELTY HINTS — strongly consider working at least one of these underused songs into the show if it fits the arc:\n${noveltyHints.map((t) => `- "${t}"`).join("\n")}`
      : "";

    const versionInfo = versions.length > 0
      ? `\n\nNotable versions from this era:\n${versions.slice(0, 25).map((v: any) => {
          const song = songs.find((s: any) => s.id === v.song_id);
          return `- "${song?.title || 'Unknown'}" ${v.show_date} at ${v.venue}, ${v.city} (rating: ${v.rating}/5)`;
        }).join("\n")}`
      : "";

    const currentSetInfo = currentSlots && currentSlots.length > 0
      ? `\n\nCurrent setlist:\n${currentSlots.map((s: any, i: number) =>
          `${i + 1}. "${s.songTitle}" (Set ${s.setNumber === 3 ? "Encore" : s.setNumber}${s.segue ? " >" : ""})`
        ).join("\n")}`
      : "";

    const themeSeeds = pickRandom(THEME_SEEDS, 3);
    const openerSeed = pickRandom(OPENER_CONSTRAINTS, 1)[0];
    const closerSeed = pickRandom(CLOSER_CONSTRAINTS, 1)[0];

    const creativityBlock = `CREATIVE DIRECTION FOR THIS SETLIST (follow these specific guidelines):
• ${themeSeeds[0]}
• ${themeSeeds[1]}
• ${themeSeeds[2]}
• Opener guidance: ${openerSeed}
• Closer guidance: ${closerSeed}
These are creative constraints to make THIS setlist unique. Embrace them fully.`;

    const avoidBlock = mergedRecent.length > 0
      ? `\nAVOID THESE RECENTLY SERVED SONGS — the user has already seen these in past Cosmic Charlie generations. Do NOT include them unless they are part of a canonical pair or structurally indispensable (Drums/Space):
${mergedRecent.slice(0, 50).map((s: string) => `- "${s}"`).join("\n")}`
      : "";

    const eraContext = eraInfo
      ? `ERA CONSTRAINT (MANDATORY): This setlist is for the ${eraInfo.name} era (${eraInfo.year_start}-${eraInfo.year_end}). ${eraInfo.description || ""}\nThe song catalog below has ALREADY been filtered to only include songs from this era. You MUST ONLY use songs from the catalog below.`
      : "Draw from the full catalog across all eras, but keep era consistency within each show.";

    const userPrefs = preferences ? `USER PREFERENCES: ${preferences}` : "";

    let systemPrompt: string;

    if (mode === "build") {
      systemPrompt = `You are Cosmic Charlie — not just a setlist generator, but a veteran Deadhead tape trader who has listened to every circulating recording and understands the Grateful Dead as a living, evolving organism. You don't just pick songs. You construct shows.

CORE PRINCIPLES:

1. A Dead show is a JOURNEY, not a playlist. Set I warms up and explores. Set II goes deep into psychedelic territory, then resolves. The encore is a benediction.

2. Songs have RELATIONSHIPS. Some songs always flow into each other. You know the difference between a segue (→, continuous music) and a transition (>, pause then start).

3. Every era has a PERSONALITY. A 1973 show breathes differently than a 1987 show. Song selection, segue density, jam length, and energy arcs all shift by era.

4. JAM VEHICLES are environments, not songs. Place them where they can expand.

SHOW STRUCTURE:

SET I (6-8 songs): Open with energy or groove. Establish the vibe. Mid-set jam vehicle is fine if grounded. Build momentum. Close with a BANG.

SET II (5-7 songs): Open with a major jam vehicle or a surprise deep cut played expansively. Psychedelic heart in the middle — segue-heavy, exploratory. DRUMS → SPACE always, after the 2nd or 3rd song. Post-Space, return dreamy or dark, then BUILD back to energy. Close with a powerhouse.

ENCORE (1-2 songs): Heartfelt, communal, gently uplifting. NOT a jam vehicle. NOT a deep cut. The goodbye.

SEGUE & PAIRING RULES:
- Canonical pairs (use when EITHER song appears):
  China Cat Sunflower → I Know You Rider
  Scarlet Begonias → Fire on the Mountain
  Help on the Way → Slipknot! → Franklin's Tower
  Estimated Prophet → Eyes of the World (common but not mandatory)
- Sandwich structures are authentic — opener → exploration → reprise.
- Do NOT break canonical pairs without strong creative reason.
- Vary the vocalist — don't stack 5+ Jerry songs in a row.

ERA-SPECIFIC GUIDANCE:
- Primal Dead (1966-1969): Short sets, heavy blues/jug band/folk, raw energy. No Drums→Space yet.
- Early Golden (1970-1971): Workingman's/American Beauty material plus psychedelic jams.
- Jazz-Fusion Peak (1972-1974): Peak jamming. Long, exploratory sets. Heavy segues.
- The '77 Sound (1976-1977): Tighter, more melodic, explosive dynamics.
- Hiatus & Return (1978-1979): Disco-funk influence. Shorter jams, more structured.
- Brent Era (1980-1985): Brent's keyboards add grit and soul. More rock-forward.
- Late Dynasty (1986-1990): Peak Brent. Stadium shows. Bigger production.
- Final Chapter (1991-1995): Vince Welnick era. Bruce Hornsby guests.

${VARIETY_DIRECTIVE}
${INTRA_SETLIST_DIVERSITY}
${VIBE_INTERPRETATION}
${PRIORITY_INTERPRETATION}
${AHA_MOMENT_REQUIREMENT}
${EXPLANATION_FORMAT}
${OPTIONAL_FIELDS_GUIDE}

${creativityBlock}
${avoidBlock}
${noveltyBlock}

${eraContext}
${userPrefs}

SONG CATALOG (windowed selection of the catalog, biased toward songs this user hasn't seen):
${songCatalog}${versionInfo}

CRITICAL RULES:
- You MUST respond using the suggest_setlist tool.
- ONLY use songs from the SONG CATALOG section above. Use EXACT song titles.
- Mark segues accurately with the segueToNext field.
- Include Drums → Space in Set II (unless era is Primal Dead).
- For EVERY song, include a brief "notes" field explaining WHY it's in this spot.
- Your explanation MUST be a 120-180 word liner note that identifies the aha moment.
- This setlist MUST be DISTINCT — do not default to obvious/popular choices.
- Include a "setlist_name" — a creative 3-7 word name capturing the essence of THIS specific setlist.`;
    } else {
      systemPrompt = `You are Cosmic Charlie — a veteran Deadhead tape trader. Analyze and improve this setlist while keeping its spirit. Be BOLD with your suggestions.

Consider: flow, energy arc, segue opportunities, set position conventions, era authenticity, pacing, vocalist variety, and the journey from first note to last.

SEGUE & PAIRING RULES:
- Canonical pairs: China Cat→Rider, Scarlet→Fire, Help→Slipknot!→Franklin's
- Sandwich structures: opener→material→reprise
- Don't break canonical pairs without good reason
- Drums→Space belongs in Set II, always

${VARIETY_DIRECTIVE}
${INTRA_SETLIST_DIVERSITY}
${VIBE_INTERPRETATION}
${PRIORITY_INTERPRETATION}
${AHA_MOMENT_REQUIREMENT}
${EXPLANATION_FORMAT}

${creativityBlock}
${avoidBlock}
${noveltyBlock}

${eraContext}
${userPrefs}

SONG CATALOG (windowed):
${songCatalog}${versionInfo}${currentSetInfo}

CRITICAL RULES:
- You MUST respond using the suggest_setlist tool.
- ONLY use songs from the catalog above. Use EXACT song titles.
- For EVERY song, include a "notes" field.
- Your explanation MUST be a 120-180 word liner note identifying the aha moment.
- Don't just rearrange — suggest meaningful swaps.
- Include a creative "setlist_name" (3-7 words).`;
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "suggest_setlist",
          description: "Return a suggested setlist with songs organized by set number.",
          parameters: {
            type: "object",
            properties: {
              setlist_name: { type: "string", description: "Creative 3-7 word name." },
              explanation: { type: "string", description: "120-180 word liner note." },
              sets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    setNumber: { type: "number" },
                    songs: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          segueToNext: { type: "boolean" },
                          notes: { type: "string" },
                        },
                        required: ["title", "segueToNext"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["setNumber", "songs"],
                  additionalProperties: false,
                },
              },
            },
            required: ["setlist_name", "explanation", "sets"],
            additionalProperties: false,
          },
        },
      },
    ];

    // ── First call ───────────────────────────────────────────────────────
    const callModel = async (extraStrictness = false) => {
      const userMessage = mode === "build"
        ? `Build me a UNIQUE and authentic Grateful Dead setlist${eraInfo ? ` from the ${eraInfo.name} era` : ""}. Construct it like a real show — I want to feel the arc from opener to encore. Surprise me with at least one choice I wouldn't expect.${preferences ? ` My vibe: ${preferences}` : ""}${extraStrictness ? " IMPORTANT: Your previous attempt repeated too many songs from my recent generations. Reach deeper into the catalog this time — pick less-obvious songs." : ""}`
        : `Improve my current setlist. Be bold.${preferences ? ` ${preferences}` : ""}${extraStrictness ? " Avoid repeating recently-served songs." : ""}`;

      return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          temperature: extraStrictness ? 1.0 : 0.95,
          top_p: 0.95,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          tools,
          tool_choice: { type: "function", function: { name: "suggest_setlist" } },
        }),
      });
    };

    let response = await callModel(false);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    let data = await response.json();
    let toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");
    let suggestion = JSON.parse(toolCall.function.arguments);

    // ── Novelty enforcement ──────────────────────────────────────────────
    const titlesFromSuggestion = (s: any): string[] =>
      (s.sets || []).flatMap((set: any) => (set.songs || []).map((sg: any) => sg.title));

    const computeOverlap = (titles: string[]): number => {
      if (mergedRecent.length === 0) return 0;
      const filtered = titles.filter((t) => !STRUCTURAL_SONGS.has(normalizeTitle(t)));
      if (filtered.length === 0) return 0;
      const overlapCount = filtered.filter((t) => recentNorm.has(normalizeTitle(t))).length;
      return overlapCount / filtered.length;
    };

    const initialOverlap = computeOverlap(titlesFromSuggestion(suggestion));
    if (mergedRecent.length >= 8 && initialOverlap > 0.4) {
      console.log(`[ai-deadhead] Re-rolling: overlap ${(initialOverlap * 100).toFixed(0)}% > 40%`);
      const reRoll = await callModel(true);
      if (reRoll.ok) {
        const reRollData = await reRoll.json();
        const reRollCall = reRollData.choices?.[0]?.message?.tool_calls?.[0];
        if (reRollCall) {
          const reRollSuggestion = JSON.parse(reRollCall.function.arguments);
          const reRollOverlap = computeOverlap(titlesFromSuggestion(reRollSuggestion));
          if (reRollOverlap < initialOverlap) {
            suggestion = reRollSuggestion;
            console.log(`[ai-deadhead] Re-roll accepted: overlap ${(reRollOverlap * 100).toFixed(0)}%`);
          }
        }
      }
    }

    // ── Fuzzy match song titles back to IDs ────────────────────────────
    const songMap = new Map((songs || []).map((s: any) => [s.title, s]));

    const resolvedSets = suggestion.sets.map((set: any) => ({
      setNumber: set.setNumber,
      songs: set.songs.map((song: any, i: number) => {
        const matched = findBestMatch(song.title, songMap);
        if (!matched) {
          console.warn(`[ai-deadhead] Unmatched song title: "${song.title}"`);
        }
        return {
          songId: matched?.id || null,
          title: matched?.title || song.title,
          matched: !!matched,
          segueToNext: song.segueToNext,
          notes: song.notes || "",
          position: i,
        };
      }).filter((s: any) => s.matched),
    }));

    // ── Persist this generation to history (for future variety) ──────────
    if (mode === "build" && (callingUser || visitorId)) {
      const vibeSig = preferences ? preferences.slice(0, 64) : null;
      const rows: any[] = [];
      for (const set of resolvedSets) {
        for (const sg of set.songs) {
          rows.push({
            user_id: callingUser?.id || null,
            visitor_id: callingUser ? null : visitorId,
            song_id: sg.songId,
            song_title: sg.title,
            era_id: eraId || null,
            vibe_signature: vibeSig,
          });
        }
      }
      if (rows.length > 0) {
        const { error: histErr } = await supabase
          .from("cosmic_charlie_history")
          .insert(rows);
        if (histErr) console.warn("[ai-deadhead] history insert failed:", histErr.message);
      }
    }

    return new Response(JSON.stringify({
      setlist_name: suggestion.setlist_name || "",
      explanation: suggestion.explanation,
      sets: resolvedSets,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-deadhead error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
