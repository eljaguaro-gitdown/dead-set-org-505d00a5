import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Creative constraint pools to inject variety into every generation
const THEME_SEEDS = [
  "Feature at least 2 deep cuts that casual fans might not know",
  "Build around a legendary segue pairing as the centerpiece",
  "Include a thematic thread — songs that share lyrical motifs or musical keys",
  "Front-load Set I with high-energy rockers, then let Set II breathe with spacey jams",
  "Channel a late-night vibe — darker, more psychedelic choices",
  "Create contrast: pair the most delicate ballad with the heaviest jam vehicle",
  "Include at least one song the Dead rarely played — a true rarity",
  "Build Set II around an extended jam suite (3+ songs connected by segues)",
  "Go for a sunshine daydream feel — upbeat, joyful, danceable throughout",
  "Feature songs with storytelling lyrics prominently",
  "Create a 'second set sandwich' — bookend the jams with tight, punchy songs",
  "Include a surprising opener that breaks convention",
  "Build tension through Set I that explodes in a Set II peak",
  "Weave in songs that complement each other melodically across sets",
  "Go heavy on the blues — Pigpen-era spirit even if using later catalog",
  "Feature an unconventional encore choice that leaves the crowd buzzing",
  "Mix tempos dramatically — follow every slow song with something uptempo",
  "Create a 'journey' setlist that tells an emotional arc from start to finish",
  "Lean into the weird — Drums/Space adjacent songs, experimental choices",
  "Channel a Sunday afternoon festival set — crowd-pleasers with depth",
];

const OPENER_CONSTRAINTS = [
  "Start with something unexpected — avoid the obvious openers",
  "Open with a mid-tempo groove that builds, not a blast of energy",
  "Choose an opener that sets a specific mood for the whole show",
  "Start with a song that was rarely used as an opener historically",
];

const CLOSER_CONSTRAINTS = [
  "End Set I with a song that leaves the crowd wanting more, not satisfied",
  "Close Set II with something emotionally devastating, not just loud",
  "Pick an encore that recontextualizes the whole show",
  "End with quiet power rather than volume",
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { mode, eraId, currentSlots, preferences, recentSongs } = await req.json();

    // Fetch songs catalog for context
    const songsQuery = supabase.from("songs").select("id, title, tags, is_jam_vehicle, typical_set_position, times_played");
    const { data: songs } = await songsQuery;

    // Fetch eras for context
    const { data: eras } = await supabase.from("eras").select("*");
    const eraInfo = eraId ? eras?.find((e: any) => e.id === eraId) : null;

    // Fetch notable versions if era is specified
    let versions: any[] = [];
    if (eraId) {
      const { data } = await supabase.from("notable_versions").select("*").eq("era_id", eraId);
      versions = data || [];
    }

    const songCatalog = (songs || []).map((s: any) =>
      `- "${s.title}" (tags: ${(s.tags || []).join(", ")}, jam: ${s.is_jam_vehicle}, position: ${s.typical_set_position || "any"}, played: ${s.times_played}x)`
    ).join("\n");

    const versionInfo = versions.length > 0
      ? `\n\nNotable versions from this era:\n${versions.map((v: any) => {
          const song = songs?.find((s: any) => s.id === v.song_id);
          return `- "${song?.title}" ${v.show_date} at ${v.venue}, ${v.city} (rating: ${v.rating}/5)`;
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
      ? `ERA CONTEXT: Focus on the ${eraInfo.name} era (${eraInfo.year_start}-${eraInfo.year_end}). ${eraInfo.description || ""}`
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
- Make this setlist DISTINCT — do not default to the most obvious/popular choices for every slot.`;
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
- Don't just rearrange — suggest meaningful swaps that elevate the setlist.`;
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
            required: ["explanation", "sets"],
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
        temperature: 1.2,
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
