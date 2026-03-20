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
    let songsQuery = supabase.from("songs").select("id, title, tags, is_jam_vehicle, typical_set_position, times_played");
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

    const creativityBlock = `
CREATIVE DIRECTION FOR THIS SETLIST (follow these specific guidelines):
• ${themeSeeds[0]}
• ${themeSeeds[1]}
• Opener guidance: ${openerSeed}
• Closer guidance: ${closerSeed}
These are creative constraints to make THIS setlist unique. Embrace them fully.`;

    // Avoid recently generated songs if provided
    const avoidBlock = recentSongs && recentSongs.length > 0
      ? `\nIMPORTANT: The user has recently seen setlists featuring these songs. STRONGLY AVOID reusing them unless essential to flow:
${recentSongs.map((s: string) => `- "${s}"`).join("\n")}`
      : "";

    let systemPrompt: string;

    if (mode === "build") {
      systemPrompt = `You are an expert Grateful Dead setlist curator — a true Dead Head with encyclopedic knowledge of their catalog. You pride yourself on NEVER building the same setlist twice. Each setlist should feel like a unique show.

Build a complete setlist following authentic Dead show structure:
- Set I: 6-8 songs, start with an opener, mix rockers and ballads, build energy
- Set II: 5-7 songs, feature 2-3 jam vehicles, include a "space" segment, peak with a powerhouse closer
- Encore: 1-2 songs, typically a heartfelt or crowd-pleasing choice

${creativityBlock}

${eraInfo ? `Focus on the ${eraInfo.name} era (${eraInfo.year_start}-${eraInfo.year_end}). ${eraInfo.description || ""}` : "Draw from the full catalog across all eras."}
${preferences ? `User preferences: ${preferences}` : ""}
${avoidBlock}

Song catalog:\n${songCatalog}${versionInfo}

CRITICAL: You MUST respond using the suggest_setlist tool. Only use songs from the catalog above. Use exact song titles. Make this setlist DISTINCT — do not default to the most obvious/popular choices for every slot.`;
    } else {
      systemPrompt = `You are an expert Grateful Dead setlist curator. Analyze and improve this setlist while keeping its spirit. Be BOLD with your suggestions — don't just make safe swaps.

Consider: flow, energy arc, segue opportunities, set position conventions, era authenticity, and pacing.

${creativityBlock}

${eraInfo ? `Era: ${eraInfo.name} (${eraInfo.year_start}-${eraInfo.year_end}). ${eraInfo.description || ""}` : ""}
${preferences ? `User preferences: ${preferences}` : ""}

Song catalog:\n${songCatalog}${versionInfo}${currentSetInfo}

CRITICAL: You MUST respond using the suggest_setlist tool. Only use songs from the catalog above. Use exact song titles. Include a brief explanation for changes. Don't just rearrange — suggest meaningful swaps that elevate the setlist.`;
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
                description: "Brief explanation of the setlist choices, flow, and what makes this particular setlist special and unique"
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
                          segueToNext: { type: "boolean", description: "Whether this song segues into the next" },
                          notes: { type: "string", description: "Brief note about why this song is placed here" }
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
            ? `Build me a UNIQUE and authentic Grateful Dead setlist${eraInfo ? ` from the ${eraInfo.name} era` : ""}. Surprise me — I want something I haven't seen before.${preferences ? ` ${preferences}` : ""}`
            : `Improve my current setlist. Be bold — suggest meaningful changes, not just safe rearrangements.${preferences ? ` ${preferences}` : ""}`
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
