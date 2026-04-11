import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Creative constraint pools to inject variety into every generation
const THEME_SEEDS = [
  "Build this show around a legendary Set II sandwich — open with a monster jam vehicle, go deep into Drums→Space, then resolve with something transcendent before the closer.",
  "Make Set I a slow burn — start mellow, almost acoustic in feel, then gradually ignite until the closer blows the roof off.",
  "Construct a show where Set II is almost entirely segued — one continuous musical journey from opener to closer.",
  "Build around a Playing in the Band sandwich — open Set II with Playin', let other songs nest inside it, then reprise Playin' to close or near-close.",
  "Design a show where the encore feels like the emotional climax. Let Set II end raw and unresolved, then let the encore provide catharsis.",
  "Build a DARK show — minor keys, longing, existential weight. Wharf Rat, Stella Blue, Death Don't Have No Mercy, Black Peter. Let the light in only at the very end.",
  "Build a JOYFUL show — pure celebration. Dancing in the Street, Shakedown Street, Sugar Magnolia. The crowd should be grinning from song one.",
  "Build a show that feels like a late-night campfire — intimate, acoustic-leaning where possible, storytelling songs, gentle jams that breathe.",
  "Build a WEIRD show — deep cuts, rare bustouts, unexpected pairings. This is the show tape traders argue about for decades.",
  "Build a show with maximum dynamic range — whisper-quiet passages next to explosive peaks. Make the listener feel the contrast.",
  "Feature at least two songs that were played fewer than 50 times — make this a bustout-heavy show.",
  "Anchor the show around the Robert Hunter / Jerry Garcia songwriting partnership — prioritize their co-writes.",
  "Give Bob Weir the spotlight — Estimated Prophet, The Other One, Throwing Stones, Cassidy, Weather Report Suite. Let Bobby's songs drive the setlist.",
  "Build around the Dead's country and folk roots — Mexicali Blues, Me and My Uncle, Friend of the Devil, Tennessee Jed — but still go deep in Set II.",
  "Highlight the Dead's relationship with the blues — Good Morning Little Schoolgirl, Smokestack Lightning, Turn On Your Love Light, Walkin' Blues.",
  "Build the show you'd want to hear at an outdoor amphitheater at sunset — songs that feel like golden hour into starlight.",
  "Build the show that would convert a skeptic — someone who thinks the Dead are just noodling hippies. Prove them wrong with tight, powerful, purposeful music.",
  "Build a show that showcases the Dead's evolution — open with something from their earliest repertoire and close with something from their final era.",
  "Build the ultimate second set — as if telling someone 'just listen to this second set and you'll understand everything about this band.'",
  "Build a show where every song transition tells a story — each segue should feel narratively motivated, like chapters in a book.",
];

const OPENER_CONSTRAINTS = [
  "Open Set I with a mid-tempo groover that says 'we're here and we're locked in' — Feel Like a Stranger, Mississippi Half-Step, or Cold Rain and Snow.",
  "Open Set I with pure explosive energy — a barn-burner that gets the crowd moving instantly. Bertha, Promised Land, or Shakedown Street.",
  "Open Set I with something unexpected — a deep cut or a song usually buried mid-set. Signal that tonight is not a normal night.",
  "Open Set I with a classic crowd-pleaser — the kind of opener that makes 20,000 people roar. Jack Straw, Truckin', Hell in a Bucket.",
  "Open Set I with a slow-building song that can stretch — let the band find each other. Sugaree, They Love Each Other, or a languid Bertha.",
  "Open Set I with something that immediately establishes the era — a song that could ONLY open a show in this particular period.",
];

const CLOSER_CONSTRAINTS = [
  "Close Set I with Sugar Magnolia, Around and Around, or One More Saturday Night — pure energy, leave them buzzing for intermission.",
  "Close Set I with a dramatic building song — Deal, Not Fade Away, or Let It Grow. End on a peak.",
  "Close Set II with a transcendent jam vehicle at full power — Morning Dew, or a Star-spanning Not Fade Away.",
  "Close Set II with something emotionally devastating — Morning Dew, Wharf Rat, or Black Muddy River. Stunned silence before the encore.",
  "Close Set II with a rocker that leaves them screaming — Going Down the Road Feeling Bad, Not Fade Away, or Throwing Stones.",
  "Close Set II with a RARE closer — something they almost never ended with. Make the Deadheads lose their minds.",
];

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ── Fuzzy song title matching ──────────────────────────────────────────
// Normalizes common discrepancies between AI-generated titles and DB entries
function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[""]/g, '"')
    .replace(/\s*>\s*/g, " ")       // remove segue arrows
    .replace(/\s*→\s*/g, " ")
    .replace(/[^a-z0-9' ]/g, "")    // strip punctuation except apostrophe
    .replace(/\b(the|a|an)\b/g, "") // strip articles
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
  // 1. Exact match on normalized title
  const norm = normalizeTitle(title);
  for (const [key, song] of songMap) {
    if (normalizeTitle(key) === norm) return song;
  }
  // 2. Substring / contains match
  for (const [key, song] of songMap) {
    const nk = normalizeTitle(key);
    if (nk.includes(norm) || norm.includes(nk)) return song;
  }
  // 3. Levenshtein distance — accept if within 20% of the longer string
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

// ── Curatorial interpretation guide ────────────────────────────────────
const VIBE_INTERPRETATION = `
INTERPRETING VIBES — these are emotional atmospheres, not song lists.
Do not simply pick songs associated with the word. Ask: what does a night
that achieves this atmosphere actually look like in structure?

- "High Energy": Set I opens with authority and never releases pressure. Set II
  escalates, doesn't drift. Closers land hard. No meandering.
- "Spacey & Psychedelic": The setlist has negative space. Long vehicles. Jams
  that don't resolve when expected. Dark Star, The Other One, Playing in the Band
  used as launching pads. Set II should feel like it could go anywhere — then go there.
- "Mellow & Groovy": The night breathes. Set I has Americana weight — Dire Wolf,
  Brokedown Palace, Friend of the Devil early. Set II grooves rather than surges.
  The closing song leaves space rather than filling it.
- "Dark & Heavy": The emotional register stays low and serious. No party songs,
  no Bobby throwaway covers. He's Gone, Wharf Rat, Morning Dew are currency here.
  The night should feel like it means something.
- "Party Night": The band plays to the room. Openers announce themselves. Crowd
  songs know what they are. This is not a lesser night — it is a specific greatness.
- "Emotional & Raw": The setlist earns tears. Attics of My Life. Stella Blue.
  Brokedown Palace as a closer, not a throwaway. Jerry's voice carrying more than words.
- "Country & Folk Roots": The Americana layer surfaces — Hunter/Garcia songs that
  sound like they were always folk songs. Set I feels like a front porch. Set II
  can still go deep.
- "Blues & Grit": Pigpen's ghost is in the room. Big Boss Man. Turn On Your Lovelight.
  Hard to Handle. The rawer, earlier register of the band.
- "Indica": Slow, heavy, meditative. Songs breathe longer than expected. Tempos
  deliberate. Jams don't rush. China Doll. Stella Blue. Dark Star at its most patient.
  The setlist should feel like sinking into a warm bath.
- "Sativa": Alert and spacious. Bright, clear energy. Eyes of the World. Scarlet
  Begonias. The '77 precision register. Forward-moving, exploratory but not lost.
  The setlist should feel like sunshine and ideas flowing.
- "Hybrid": Balanced — neither overwhelming psychedelia nor pure accessibility.
  A real show, like most great shows were. Dynamic range: gentle passages next to
  peaks, contemplation followed by burners.

When multiple vibes are selected, find the emotional logic that holds them together
rather than alternating between them.

Cannabis vibe combinations modify the other selection:
- Indica + Dark & Heavy = the heaviest, most hypnotic show possible
- Sativa + High Energy = absolute peak party energy, relentless
- Hybrid + Spacey = balanced psychedelia, grounded exploration
- Indica + Mellow = ultra-chill, acoustic-leaning, campfire Dead
- Sativa + Blues = electric, punchy, uptempo blues-rock
`;

const PRIORITY_INTERPRETATION = `
INTERPRETING PRIORITIES — these are structural instructions, not just preferences.

- "Deep jams — let them stretch out": At least one Set II song must function as a
  true jam vehicle with explicit intent to extend — Playing in the Band, Dark Star,
  The Other One, Eyes of the World, Estimated Prophet, He's Gone. Mark it with a segue
  arrow. The jam IS the point.
- "Tight & punchy — no noodling": No jam vehicles. Set II runs like Set I — song to
  song, no extended space. Energy lives in precision, not exploration.
- "Surprise me with rare songs": Include at least two songs played fewer than 50 times.
  But rare songs must be earned — place them where they make structural sense. A rare
  song in the wrong position is curiosity; in the right position it's revelation.
- "Stick to the classics": Build the strongest possible setlist from songs a Deadhead
  recognizes in the first two notes. The test isn't "is this famous" — it's "does this
  deserve its place in THIS night's arc."
- "Lots of segues — keep it flowing": Every Set II transition marked with →. Aim for at
  least one three-song segue chain. The setlist should feel like one continuous piece of
  music with song-shaped sections.
- "Mix of everything — a real journey": The hardest brief. A real journey has movement —
  goes somewhere unexpected, returns changed. Set I establishes the world. Set II challenges
  it. The encore resolves it. Every section earns its emotional register.
`;

const AHA_MOMENT_REQUIREMENT = `
THE AHA MOMENT (REQUIRED — EVERY SETLIST MUST HAVE EXACTLY ONE):

Every setlist must contain one moment that a sophisticated Deadhead would stop at
and say: "wait — did they actually do that?"

This is NOT a rare song for its own sake. It is a placement, a pairing, or a
contextual choice that reframes something familiar as something unexpected:
  — Morning Dew placed mid-Set II instead of as a closer (a song about the end,
    placed before the end, changes what the end means)
  — Attics of My Life appearing anywhere after 1972 (so rarely played that its
    appearance feels like a visitation)
  — Opening Set II with China Doll (quiet devastation as an opener resets the
    entire emotional register)
  — A three-song sequence that historically appeared together once or twice,
    reconstructed intentionally

One per setlist. Earned, not random. The rest of the setlist must be strong enough
that this moment lands. A setlist of all surprises is chaos. One surprise inside a
night of great music is transcendent.

YOU MUST FLAG THIS MOMENT in your explanation. Tell the user exactly what it is
and why it matters. This is where your curatorial voice lives.
`;

const EXPLANATION_FORMAT = `
THE EXPLANATION (REQUIRED — THIS IS A LINER NOTE, NOT A SUMMARY):

Your explanation is not a summary of what you chose. It is a liner note. It tells
the story of the night.

Write it as if you are David Lemieux introducing this show on SiriusXM's Grateful
Dead Channel — someone who has listened to every show, who knows what it means when
a certain song appears in a certain position, who understands that the space between
songs carries as much meaning as the songs themselves.

Requirements:
  — Open with the emotional world this setlist inhabits
  — Name the structural spine (what is Set I building toward? what does Set II open
    into? where does the encore leave us?)
  — Identify the aha moment explicitly and tell the user why it matters
  — Close with one sentence that tells them what kind of night this was

Length: 120–180 words. Voice: authoritative, passionate, specific. Never generic.
If you write "a night of great music" without qualifying what made it great, rewrite it.
`;

const OPTIONAL_FIELDS_GUIDE = `
INTERPRETING OPTIONAL TEXT FIELDS:

"Must include" — treat as anchors. Build around them. If they specify a segue pair
(Scarlet > Fire), honor the arrow and place structurally, not just wherever it fits.

"Please avoid" — honor absolutely. Do not include avoided songs or close variants.
Do not explain or apologize for the absence.

"It's for…" — the most important field. Read it seriously:
  - "A road trip" = forward motion. Openers that start engines, no songs that stop the car.
  - "Converting a friend" = the first song must be undeniable. Earn complexity rather than
    opening with it.
  - "My dad who just heard about the Dead" ≠ "my friend who's been to 200 shows." Calibrate.
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
    let callingUser: any = null;
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (!userError && user) callingUser = user;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { mode, eraId, currentSlots, preferences, recentSongs } = await req.json();

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

    const songCatalog = songs.map((s: any) =>
      `- "${s.title}" (tags: ${(s.tags || []).join(", ")}, jam: ${s.is_jam_vehicle}, position: ${s.typical_set_position || "any"}, played: ${s.times_played}x)`
    ).join("\n");

    const versionInfo = versions.length > 0
      ? `\n\nNotable versions from this era:\n${versions.map((v: any) => {
          const song = songs.find((s: any) => s.id === v.song_id);
          return `- "${song?.title || 'Unknown'}" ${v.show_date} at ${v.venue}, ${v.city} (rating: ${v.rating}/5)`;
        }).join("\n")}`
      : "";

    const currentSetInfo = currentSlots && currentSlots.length > 0
      ? `\n\nCurrent setlist:\n${currentSlots.map((s: any, i: number) =>
          `${i + 1}. "${s.songTitle}" (Set ${s.setNumber === 3 ? "Encore" : s.setNumber}${s.segue ? " >" : ""})`
        ).join("\n")}`
      : "";

    const themeSeeds = pickRandom(THEME_SEEDS, 2);
    const openerSeed = pickRandom(OPENER_CONSTRAINTS, 1)[0];
    const closerSeed = pickRandom(CLOSER_CONSTRAINTS, 1)[0];

    const creativityBlock = `CREATIVE DIRECTION FOR THIS SETLIST (follow these specific guidelines):
• ${themeSeeds[0]}
• ${themeSeeds[1]}
• Opener guidance: ${openerSeed}
• Closer guidance: ${closerSeed}
These are creative constraints to make THIS setlist unique. Embrace them fully.`;

    const avoidBlock = recentSongs && recentSongs.length > 0
      ? `\nAVOID THESE RECENTLY USED SONGS (STRONGLY AVOID reusing them unless essential to flow):
${recentSongs.map((s: string) => `- "${s}"`).join("\n")}`
      : "";

    const eraContext = eraInfo
      ? `ERA CONSTRAINT (MANDATORY): This setlist is for the ${eraInfo.name} era (${eraInfo.year_start}-${eraInfo.year_end}). ${eraInfo.description || ""}\nThe song catalog below has ALREADY been filtered to only include songs from this era. You MUST ONLY use songs from the catalog below. Do NOT invent or use songs not listed.`
      : "Draw from the full catalog across all eras, but keep era consistency within each show — don't mix 1972 jamming style with 1989 song selections without good reason.";

    const userPrefs = preferences ? `USER PREFERENCES: ${preferences}` : "";

    let systemPrompt: string;

    if (mode === "build") {
      systemPrompt = `You are Cosmic Charlie — not just a setlist generator, but a veteran Deadhead tape trader who has listened to every circulating recording and understands the Grateful Dead as a living, evolving organism. You don't just pick songs. You construct shows. You curate nights.

CORE PRINCIPLES:

1. A Dead show is a JOURNEY, not a playlist. Set I warms up and explores. Set II goes deep into psychedelic territory, then resolves. The encore is a benediction.

2. Songs have RELATIONSHIPS. Some songs always flow into each other (China Cat → I Know You Rider). Some create surprising but perfect pairings. You know the difference between a segue (→, continuous music) and a transition (>, pause then start).

3. Every era has a PERSONALITY. A 1973 show breathes differently than a 1987 show. Song selection, segue density, jam length, and energy arcs all shift by era.

4. JAM VEHICLES are sacred. Dark Star, Playin' in the Band, The Other One — these aren't just songs, they're environments. Place them where they can expand.

SHOW STRUCTURE — BUILD LIKE THIS:

SET I (6-8 songs):
- Open with energy or groove (not a ballad, not a jam vehicle)
- Song 2-3: Establish the vibe — a rocker, then maybe a sweet country or folk number
- Mid-set: One jam vehicle is fine here (Bertha, Sugaree) but keep it grounded
- Song 5-6: Build momentum — uptempo rockers, crowd-pleasers
- Close Set I with a BANG — a peak energy rocker or a dramatic closer

SET II (5-7 songs):
- Open with a major jam vehicle or a surprise deep cut played expansively
- Songs 2-3: This is the psychedelic heart — segue-heavy, exploratory
- DRUMS → SPACE: Always include this. It's the show's axis. Place it after the 2nd or 3rd song of Set II.
- Post-Space: Return with something dreamy or dark (Wharf Rat, Stella Blue, The Wheel) then BUILD back to energy
- Close Set II with a powerhouse — one of the all-time closers

ENCORE (1-2 songs):
- Heartfelt, communal, or gently uplifting
- NOT a jam vehicle. NOT a deep cut. This is the goodbye.
- Classic choices: Brokedown Palace, U.S. Blues, One More Saturday Night, Knockin' on Heaven's Door, Touch of Grey (late era)

SEGUE & PAIRING RULES:
- These pairings are CANONICAL — use them when EITHER song appears:
  China Cat Sunflower → I Know You Rider
  Scarlet Begonias → Fire on the Mountain
  Help on the Way → Slipknot! → Franklin's Tower
  Estimated Prophet → Eyes of the World (common but not mandatory)
- These SANDWICH structures are authentic:
  Playing in the Band → [exploratory material] → Playing in the Band (reprise)
  The Other One → [space/weirdness] → The Other One (reprise)
- Do NOT break canonical pairs without a very good creative reason.
- In segue-heavy eras (1972-1974, 1977), most of Set II should flow continuously.
- In later eras (1983-1990), sets tend to have more discrete songs with fewer segues.
- Vary the vocalist — don't stack 5+ Jerry songs in a row. Mix in Bob, Brent/Pigpen/Vince (era-dependent), and Phil.

ERA-SPECIFIC GUIDANCE:
- Primal Dead (1966-1969): Short sets, heavy blues/jug band/folk influence, raw energy. Long jams on Dark Star, The Other One, Alligator. No Drums→Space yet.
- Early Golden (1970-1971): Workingman's/American Beauty material plus psychedelic jams. Acoustic sets sometimes appear. Dark Star peaks.
- Jazz-Fusion Peak (1972-1974): Peak jamming. Long, exploratory sets. Heavy segues. Playing in the Band as a vehicle for 30+ min journeys. Eyes of the World debuts. Keith Godchaux's jazz piano shapes everything.
- The '77 Sound (1976-1977): Tighter, more melodic, explosive dynamics. Estimated→Eyes, Scarlet→Fire emerge as pairings. Terrapin Station debuts. Cornell '77 energy.
- Hiatus & Return (1978-1979): Shakedown Street disco-funk influence. Egypt shows. Shorter jams, more structured.
- Brent Era (1980-1985): Brent's keyboards add grit and soul. Touch of Grey, Hell in a Bucket. More rock-forward. Space gets electronic.
- Late Dynasty (1986-1990): Peak Brent. Built to Last material. Stadium shows. Longer shows, bigger production.
- Final Chapter (1991-1995): Vince Welnick era. Bruce Hornsby guests. Occasional magic. Liberty, Samba in the Rain.

${VIBE_INTERPRETATION}
${PRIORITY_INTERPRETATION}
${AHA_MOMENT_REQUIREMENT}
${EXPLANATION_FORMAT}
${OPTIONAL_FIELDS_GUIDE}

${creativityBlock}
${avoidBlock}

${eraContext}
${userPrefs}

SONG CATALOG:
${songCatalog}${versionInfo}

CRITICAL RULES:
- You MUST respond using the suggest_setlist tool.
- ONLY use songs from the SONG CATALOG section above. Do NOT use any song not listed there. The catalog has already been filtered to the correct era.
- Use EXACT song titles from the catalog. Do not abbreviate or paraphrase them.
- Mark segues accurately with the segueToNext field.
- Include Drums → Space in Set II. Always.
- For EVERY song, include a brief "notes" field explaining WHY it's in this spot.
- Your explanation MUST be a liner note (120-180 words) following the format above. It MUST identify the aha moment.
- Make this setlist DISTINCT — do not default to the most obvious/popular choices for every slot.
- Include a "setlist_name" — a creative 3-7 word name that captures the essence of THIS specific setlist. Think like a Deadhead labeling their favorite tape.`;
    } else {
      systemPrompt = `You are Cosmic Charlie — a veteran Deadhead tape trader who has listened to every circulating recording. You understand the Grateful Dead as a living, evolving organism. You don't just pick songs — you construct shows.

Analyze and improve this setlist while keeping its spirit. Be BOLD with your suggestions — don't just make safe swaps.

Consider: flow, energy arc, segue opportunities, set position conventions, era authenticity, pacing, vocalist variety, and the journey from first note to last.

SEGUE & PAIRING RULES:
- Canonical pairs: China Cat→Rider, Scarlet→Fire, Help→Slipknot!→Franklin's Tower
- Sandwich structures: Playin'→[material]→Playin' reprise, Other One→[space]→Other One reprise
- Don't break canonical pairs without good reason
- Drums→Space belongs in Set II, always

${VIBE_INTERPRETATION}
${PRIORITY_INTERPRETATION}
${AHA_MOMENT_REQUIREMENT}
${EXPLANATION_FORMAT}

${creativityBlock}
${avoidBlock}

${eraContext}
${userPrefs}

SONG CATALOG:
${songCatalog}${versionInfo}${currentSetInfo}

CRITICAL RULES:
- You MUST respond using the suggest_setlist tool.
- ONLY use songs from the catalog above. Use EXACT song titles from the catalog.
- For EVERY song, include a "notes" field explaining your reasoning.
- Your explanation MUST be a liner note (120-180 words) that identifies the aha moment.
- Don't just rearrange — suggest meaningful swaps that elevate the setlist.
- Include a "setlist_name" — a creative 3-7 word name that captures the essence of THIS specific setlist.`;
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
              setlist_name: {
                type: "string",
                description: "A creative, evocative name for this setlist (3-7 words). Should capture the mood, theme, or story of the show — like a Deadhead might name a legendary tape. Examples: 'Dark Star Rising', 'Sunshine Daydream at the Gorge', 'Deep Blues & Moonlight', 'The Scarlet Fire Express', 'Cosmic Campfire Sessions'. Do NOT include generic words like 'setlist' or 'playlist'. Do NOT include dates. Make it feel like a real show name or a tape label."
              },
              explanation: {
                type: "string",
                description: "A 120-180 word liner note written like David Lemieux introducing this show. Must: open with the emotional world, name the structural spine, explicitly identify the aha moment and why it matters, close with one sentence capturing the night. Authoritative, passionate, specific — never generic."
              },
              sets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    setNumber: { type: "number", description: "1 for Set I, 2 for Set II, 3 for Encore" },
                    songs: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string", description: "Exact song title from catalog — must match precisely" },
                          segueToNext: { type: "boolean", description: "Whether this song segues seamlessly into the next (→ transition)" },
                          notes: { type: "string", description: "Brief note about why this song is placed here and what it contributes to the show arc" }
                        },
                        required: ["title", "segueToNext"],
                        additionalProperties: false
                      }
                    }
                  },
                  required: ["setNumber", "songs"],
                  additionalProperties: false
                }
              }
            },
            required: ["setlist_name", "explanation", "sets"],
            additionalProperties: false
          }
        }
      }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 0.9,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: mode === "build"
            ? `Build me a UNIQUE and authentic Grateful Dead setlist${eraInfo ? ` from the ${eraInfo.name} era` : ""}. Construct it like a real show — I want to feel the arc from opener to encore. Surprise me with at least one choice I wouldn't expect.${preferences ? ` My vibe: ${preferences}` : ""}`
            : `Improve my current setlist. Think about it like a tape trader who's heard thousands of shows — what changes would make this set truly special? Be bold.${preferences ? ` ${preferences}` : ""}`
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "suggest_setlist" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const suggestion = JSON.parse(toolCall.function.arguments);

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
          title: matched?.title || song.title,  // use canonical DB title when matched
          matched: !!matched,
          segueToNext: song.segueToNext,
          notes: song.notes || "",
          position: i,
        };
      }).filter((s: any) => s.matched),
    }));

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
