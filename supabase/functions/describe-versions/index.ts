import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const { songTitle, versions } = await req.json();
    if (!songTitle || !versions?.length) {
      return new Response(JSON.stringify({ error: "songTitle and versions required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only describe the top 10 versions to keep costs reasonable
    const top = versions.slice(0, 10);

    const versionList = top
      .map((v: { date: string; venue: string; rating: number }, i: number) =>
        `${i + 1}. ${v.date} — ${v.venue || "Unknown venue"} (rating: ${v.rating ?? "N/A"})`
      )
      .join("\n");

    const prompt = `You are Cosmic Charlie, a veteran Grateful Dead tape trader and historian. For each live recording of "${songTitle}" listed below, write ONE evocative sentence (max 20 words) capturing what makes that particular version special — the energy, the jam, the moment. Channel David Lemieux liner notes: vivid, specific, enthusiastic but not hyperbolic. If you don't have specific knowledge of that show, infer from the era and venue.

Recordings:
${versionList}

Reply as a JSON array of strings, one per recording, in the same order. No preamble, just the JSON array.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      throw new Error(`AI API returned ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";

    // Parse the JSON — handle both raw array and wrapped object
    let descriptions: string[];
    try {
      const parsed = JSON.parse(content);
      descriptions = Array.isArray(parsed) ? parsed : (parsed.descriptions || parsed.results || Object.values(parsed));
    } catch {
      console.error("Failed to parse AI response:", content);
      descriptions = [];
    }

    // Map back to identifiers for the client
    const result: Record<string, string> = {};
    top.forEach((v: { identifier: string }, i: number) => {
      if (descriptions[i]) {
        result[v.identifier] = descriptions[i];
      }
    });

    return new Response(JSON.stringify({ descriptions: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
