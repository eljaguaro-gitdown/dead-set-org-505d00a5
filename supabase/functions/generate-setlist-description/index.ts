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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { setlistId } = await req.json();
    if (!setlistId) throw new Error("setlistId is required");

    // Use service role for data reads (needed for era join), but verify ownership first
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch setlist and verify the user is the owner or a collaborator
    const { data: setlist } = await supabase
      .from("setlists")
      .select("*, eras(*)")
      .eq("id", setlistId)
      .single();
    if (!setlist) throw new Error("Setlist not found");

    const isOwner = setlist.creator_id === userId;
    if (!isOwner) {
      const { data: collab } = await supabase
        .from("collaborators")
        .select("id")
        .eq("setlist_id", setlistId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!collab) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch slots with songs
    const { data: slotsData } = await supabase
      .from("setlist_slots")
      .select("*, songs(*)")
      .eq("setlist_id", setlistId)
      .order("set_number")
      .order("position");

    if (!slotsData || slotsData.length === 0) {
      throw new Error("Setlist has no songs");
    }

    const era = (setlist as any).eras;
    const songsBySet: Record<number, string[]> = {};
    for (const slot of slotsData) {
      const setNum = slot.set_number;
      if (!songsBySet[setNum]) songsBySet[setNum] = [];
      const song = (slot as any).songs;
      const segue = slot.segue_to_next ? " >" : "";
      songsBySet[setNum].push(`${song.title}${segue}`);
    }

    let setlistText = "";
    for (const [setNum, songs] of Object.entries(songsBySet)) {
      const label = Number(setNum) === 3 ? "Encore" : `Set ${setNum}`;
      setlistText += `${label}: ${songs.join(", ")}\n`;
    }

    const jamVehicles = slotsData
      .filter((s: any) => (s as any).songs?.is_jam_vehicle)
      .map((s: any) => (s as any).songs.title);

    const systemPrompt = `You are a music journalist channeling the spirit of Rolling Stone Magazine circa 1977. You write about the Grateful Dead with reverence, wit, and insider knowledge. You know the catalog intimately — the jams, the segues, the deep cuts, the crowd pleasers.

Your task: Write a 1-2 sentence evocative description of this setlist that would work as:
- A warmup/lead-in teaser for someone about to listen
- A social media description that's searchable and shareable
- A mini show review that captures what makes THIS particular set special

Tone: Titillating, playful, respectful of Dead culture. Like a knowing wink from someone who's been on the bus. Appeal to purists (mention specific musical choices, segues, deep cuts) but be accessible to newcomers. Think "Rolling Stone blurb meets the back of a bootleg tape."

Consider:
- The specific song choices and their placement
- Notable segues (marked with >)
- Jam vehicles and their positioning in the set
- The overall energy arc and flow
- Era-specific context if available
- Opening and closing choices
- Any surprising or unconventional picks

DO NOT use clichés like "long strange trip" or "what a long strange trip." Be fresh. Be specific to THIS setlist.
KEEP IT TO 1-2 SENTENCES MAX. Punchy and evocative.`;

    const userPrompt = `Here's the setlist:
Title: "${setlist.title}"
${era ? `Era: ${era.name} (${era.year_start}-${era.year_end}). ${era.description || ""}` : "No specific era selected."}

${setlistText}
${jamVehicles.length > 0 ? `Notable jam vehicles in this set: ${jamVehicles.join(", ")}` : ""}

Write the description.`;

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
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Cosmic Charlie is taking a breather — try again in a few minutes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("The liner notes didn't make it to tape. Try again in a moment.");
    }

    const data = await response.json();
    const description = data.choices?.[0]?.message?.content?.trim();
    if (!description) throw new Error("The liner notes came back blank. Try again in a moment.");

    // Save to setlist
    await supabase.from("setlists").update({ description }).eq("id", setlistId);

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-setlist-description error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
