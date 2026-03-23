import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const setlistId = url.searchParams.get("id");

    if (!setlistId) {
      return new Response("Missing id", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch setlist data
    const { data: setlist } = await supabase
      .from("setlists")
      .select("*")
      .eq("id", setlistId)
      .single();

    if (!setlist) {
      return new Response("Setlist not found", { status: 404, headers: corsHeaders });
    }

    // Fetch slots with songs
    const { data: slotsRaw } = await supabase
      .from("setlist_slots")
      .select("set_number, position, song_id, segue_to_next")
      .eq("setlist_id", setlistId)
      .order("set_number")
      .order("position");

    const songIds = (slotsRaw || []).map((s) => s.song_id);
    const { data: songs } = await supabase
      .from("songs")
      .select("id, title")
      .in("id", songIds);

    const songMap = new Map((songs || []).map((s) => [s.id, s.title]));

    // Fetch era & creator
    let eraName = "";
    if (setlist.era_id) {
      const { data: era } = await supabase.from("eras").select("name").eq("id", setlist.era_id).single();
      eraName = era?.name || "";
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", setlist.creator_id)
      .single();

    const creatorName = profile?.display_name || "Unknown Head";

    // Build set groups
    const sets: Record<number, { title: string; segue: boolean }[]> = {};
    for (const slot of slotsRaw || []) {
      if (!sets[slot.set_number]) sets[slot.set_number] = [];
      sets[slot.set_number].push({
        title: songMap.get(slot.song_id) || "Unknown",
        segue: slot.segue_to_next || false,
      });
    }

    // Generate SVG poster
    const width = 1200;
    const height = 630;
    const bgColor = "#3D3122";
    const textColor = "#DBC8A0";
    const mutedColor = "#8B7A5E";
    const goldColor = "#C8952A";

    let songListSvg = "";
    let yPos = 320;

    for (const [setNum, songList] of Object.entries(sets)) {
      const setLabel = Number(setNum) === 3 ? "ENCORE" : `SET ${setNum}`;
      songListSvg += `<text x="600" y="${yPos}" text-anchor="middle" fill="${mutedColor}" font-family="Georgia, serif" font-size="14" letter-spacing="4">${setLabel}</text>`;
      yPos += 28;

      const songLine = songList
        .map((s, i) => s.title + (s.segue && i < songList.length - 1 ? " →" : ""))
        .join("  ·  ");

      // Wrap long lines
      const maxChars = 70;
      const words = songLine.split("  ");
      let currentLine = "";
      for (const word of words) {
        if ((currentLine + word).length > maxChars) {
          songListSvg += `<text x="600" y="${yPos}" text-anchor="middle" fill="${textColor}" font-family="Georgia, serif" font-size="18">${escapeXml(currentLine.trim())}</text>`;
          yPos += 26;
          currentLine = word + "  ";
        } else {
          currentLine += word + "  ";
        }
      }
      if (currentLine.trim()) {
        songListSvg += `<text x="600" y="${yPos}" text-anchor="middle" fill="${textColor}" font-family="Georgia, serif" font-size="18">${escapeXml(currentLine.trim())}</text>`;
        yPos += 26;
      }
      yPos += 16;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="${bgColor}"/>
      <rect x="30" y="30" width="${width - 60}" height="${height - 60}" fill="none" stroke="${mutedColor}" stroke-width="1" opacity="0.3"/>
      
      <!-- Radial glow -->
      <defs>
        <radialGradient id="glow" cx="50%" cy="25%" r="40%">
          <stop offset="0%" stop-color="${goldColor}" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="${bgColor}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#glow)"/>
      
      <!-- SYF circle placeholder -->
      <circle cx="600" cy="100" r="45" fill="none" stroke="${goldColor}" stroke-width="2" opacity="0.6"/>
      <text x="600" y="108" text-anchor="middle" fill="${goldColor}" font-family="Georgia, serif" font-size="28" font-weight="bold">☠</text>
      
      <!-- GRATEFUL DEAD -->
      <text x="600" y="185" text-anchor="middle" fill="${mutedColor}" font-family="Georgia, serif" font-size="16" letter-spacing="12">GRATEFUL DEAD</text>
      
      <!-- Title -->
      <text x="600" y="230" text-anchor="middle" fill="${textColor}" font-family="Georgia, serif" font-size="36" font-weight="bold">${escapeXml(truncate(setlist.title, 50))}</text>
      
      <!-- Era & Creator -->
      <text x="600" y="268" text-anchor="middle" fill="${mutedColor}" font-family="monospace" font-size="13">${eraName ? escapeXml(eraName) + "  ·  " : ""}curated by ${escapeXml(creatorName)}</text>
      
      <!-- Decorative rule -->
      <line x1="200" y1="290" x2="1000" y2="290" stroke="${goldColor}" stroke-width="0.5" opacity="0.4"/>
      
      <!-- Songs -->
      ${songListSvg}
      
      <!-- Footer -->
      <text x="600" y="${height - 50}" text-anchor="middle" fill="${mutedColor}" font-family="monospace" font-size="11" letter-spacing="3">DEAD SET · ${(slotsRaw || []).length} SONGS</text>
    </svg>`;

    // Return SVG as image
    return new Response(svg, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("OG image error:", error);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}
