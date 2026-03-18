import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { mode, eraId, currentSlots, preferences } = await req.json();

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

    let systemPrompt: string;

    if (mode === "build") {
      systemPrompt = `You are an expert Grateful Dead setlist curator — a true Dead Head with encyclopedic knowledge of their catalog.
Build a complete setlist following authentic Dead show structure:
- Set I: 6-8 songs, start with an upbeat opener, mix rockers and ballads, build energy
- Set II: 5-7 songs, feature 2-3 jam vehicles, include a "space" segment, peak with a powerhouse closer
- Encore: 1-2 songs, typically a heartfelt or crowd-pleasing choice

${eraInfo ? `Focus on the ${eraInfo.name} era (${eraInfo.year_start}-${eraInfo.year_end}). ${eraInfo.description || ""}` : "Draw from the full catalog."}
${preferences ? `User preferences: ${preferences}` : ""}

Song catalog:\n${songCatalog}${versionInfo}

CRITICAL: You MUST respond using the suggest_setlist tool. Only use songs from the catalog above. Use exact song titles.`;
    } else {
      systemPrompt = `You are an expert Grateful Dead setlist curator. Analyze and improve this setlist while keeping its spirit.
Consider: flow, energy arc, segue opportunities, set position conventions, era authenticity, and pacing.
${eraInfo ? `Era: ${eraInfo.name} (${eraInfo.year_start}-${eraInfo.year_end}). ${eraInfo.description || ""}` : ""}
${preferences ? `User preferences: ${preferences}` : ""}

Song catalog:\n${songCatalog}${versionInfo}${currentSetInfo}

CRITICAL: You MUST respond using the suggest_setlist tool. Only use songs from the catalog above. Use exact song titles. Include a brief explanation for changes.`;
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
                description: "Brief explanation of the setlist choices and flow"
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
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: mode === "build"
            ? `Build me an authentic Grateful Dead setlist${eraInfo ? ` from the ${eraInfo.name} era` : ""}.${preferences ? ` ${preferences}` : ""}`
            : `Improve my current setlist. Suggest better flow, swaps, and segue opportunities.${preferences ? ` ${preferences}` : ""}`
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
