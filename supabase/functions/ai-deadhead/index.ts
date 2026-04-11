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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate the caller (optional — guests can use the wizard too)
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

    // Fetch songs catalog for context
    const { data: allSongs } = await supabase.from("songs").select("id, title, tags, is_jam_vehicle, typical_set_position, times_played, first_played, last_played");

    // Fetch eras for context
    const { data: eras } = await supabase.from("eras").select("*");
    const eraInfo = eraId ? eras?.find((e: any) => e.id === eraId) : null;

    // Filter songs by era year range if an era is selected
    let songs = allSongs || [];
    if (eraInfo) {
      songs = songs.filter((s: any) => {
        if (!s.first_played) return false;
        const firstYear = parseInt(s.first_played.substring(0, 4), 10);
        const lastYear = s.last_played ? parseInt(s.last_played.substring(0, 4), 10) : 9999;
        // Song was in the repertoire during this era if it was first played before era ended
        // AND last played after era started
        return firstYear <= eraInfo.year_end && lastYear >= eraInfo.year_start;
      });
    }

    // Fetch notable versions if era is specified
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

    // Inject randomized creative constraints for variety
    const themeSeeds = pickRandom(THEME_SEEDS, 2);
    const openerSeed = pickRandom(OPENER_CONSTRAINTS, 1)[0];
    const closerSeed = pickRandom(CLOSER_CONSTRAINTS, 1)[0];

    const creativityBlock = `CREATIVE DIRECTION FOR THIS SETLIST (follow these specific guidelines):
• ${themeSeeds[0]}
• ${themeSeeds[1]}
• Opener guidance: ${openerSeed}
• Closer guidance: ${closerSeed}
These are creative constraints to make THIS setlist unique. Embrace them fully.`;

    // Avoid recently generated songs if provided
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
      systemPrompt = `You are Cosmic Charlie — not just a setlist generator, but a veteran Deadhead tape trader who has listened to every circulating recording and understands the Grateful Dead as a living, evolving organism. You don't just pick songs. You construct shows.

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

${creativityBlock}
${avoidBlock}

${eraContext}
${userPrefs}

SONG CATALOG:
${songCatalog}${versionInfo}

CRITICAL RULES:
- You MUST respond using the suggest_setlist tool.
- ONLY use songs from the catalog above.
- Mark segues accurately with the segueToNext field.
- Include Drums → Space in Set II. Always.
- For EVERY song, include a brief "notes" field explaining WHY it's in this spot.
- Your explanation should read like a Deadhead describing why this show would be special.
- Make this setlist DISTINCT — do not default to the most obvious/popular choices for every slot.
- Include a "setlist_name" — a creative 3-7 word name that captures the essence of THIS specific setlist. Think like a Deadhead labeling their favorite tape. It should reflect the mood, energy, or story of the show you just built.`;
    } else {
      systemPrompt = `You are Cosmic Charlie — a veteran Deadhead tape trader who has listened to every circulating recording. You understand the Grateful Dead as a living, evolving organism. You don't just pick songs — you construct shows.

Analyze and improve this setlist while keeping its spirit. Be BOLD with your suggestions — don't just make safe swaps.

Consider: flow, energy arc, segue opportunities, set position conventions, era authenticity, pacing, vocalist variety, and the journey from first note to last.

SEGUE & PAIRING RULES:
- Canonical pairs: China Cat→Rider, Scarlet→Fire, Help→Slipknot!→Franklin's Tower
- Sandwich structures: Playin'→[material]→Playin' reprise, Other One→[space]→Other One reprise
- Don't break canonical pairs without good reason
- Drums→Space belongs in Set II, always

${creativityBlock}
${avoidBlock}

${eraContext}
${userPrefs}

SONG CATALOG:
${songCatalog}${versionInfo}${currentSetInfo}

CRITICAL RULES:
- You MUST respond using the suggest_setlist tool.
- ONLY use songs from the catalog above. Use exact song titles.
- For EVERY song, include a "notes" field explaining your reasoning.
- Include a brief explanation that reads like a Deadhead describing the changes.
- Don't just rearrange — suggest meaningful swaps that elevate the setlist.
- Include a "setlist_name" — a creative 3-7 word name that captures the essence of THIS specific setlist. Think like a Deadhead labeling their favorite tape.`;
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
                description: "Brief explanation of the setlist choices, flow, and what makes this particular setlist special — written like a Deadhead describing a show"
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
                          title: { type: "string", description: "Exact song title from catalog" },
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

    // Map song titles back to IDs
    const songMap = new Map((songs || []).map((s: any) => [s.title.toLowerCase(), s]));
    const resolvedSets = suggestion.sets.map((set: any) => ({
      setNumber: set.setNumber,
      songs: set.songs.map((song: any, i: number) => {
        const matched = songMap.get(song.title.toLowerCase());
        return {
          songId: matched?.id || null,
          title: song.title,
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
