import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-visitor-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BOT_UA = /bot|crawl|spider|facebook|twitter|slack|discord|telegram|whatsapp|linkedin|pinterest|preview|embed|fetch|curl/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const setlistId = url.searchParams.get("id");
    const format = url.searchParams.get("format"); // "image" for SVG, default is HTML

    if (!setlistId) {
      return new Response("Missing id", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch setlist
    const { data: setlist } = await supabase
      .from("setlists")
      .select("*")
      .eq("id", setlistId)
      .single();

    if (!setlist) {
      return new Response("Setlist not found", { status: 404, headers: corsHeaders });
    }

    // Only serve OG data for public setlists
    if (!setlist.is_public) {
      return new Response("Not found", { status: 404, headers: corsHeaders });
    }

    // Fetch slots with songs
    const { data: slotsRaw } = await supabase
      .from("setlist_slots")
      .select("set_number, position, song_id, segue_to_next")
      .eq("setlist_id", setlistId)
      .order("set_number")
      .order("position");

    const songIds = (slotsRaw || []).map((s: any) => s.song_id);
    const { data: songs } = await supabase
      .from("songs")
      .select("id, title")
      .in("id", songIds);

    const songMap = new Map((songs || []).map((s: any) => [s.id, s.title]));

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

    // Build song names for description
    const songNames = (slotsRaw || []).map((s: any) => songMap.get(s.song_id) || "").filter(Boolean);
    const firstSongs = songNames.slice(0, 3).join(", ");
    const songCount = songNames.length;

    // ===== IMAGE FORMAT: return SVG poster =====
    if (format === "image") {
      const sets: Record<number, { title: string; segue: boolean }[]> = {};
      for (const slot of slotsRaw || []) {
        if (!sets[slot.set_number]) sets[slot.set_number] = [];
        sets[slot.set_number].push({
          title: songMap.get(slot.song_id) || "Unknown",
          segue: slot.segue_to_next || false,
        });
      }

      const width = 1200;
      const height = 630;

      let songListSvg = "";
      let yPos = 320;

      for (const [setNum, songList] of Object.entries(sets)) {
        const setLabel = Number(setNum) === 3 ? "ENCORE" : `SET ${setNum}`;
        songListSvg += `<text x="600" y="${yPos}" text-anchor="middle" fill="#8B7A5E" font-family="Georgia, serif" font-size="14" letter-spacing="4">${setLabel}</text>`;
        yPos += 28;

        const songLine = songList
          .map((s, i) => s.title + (s.segue && i < songList.length - 1 ? " →" : ""))
          .join("  ·  ");

        const maxChars = 70;
        const words = songLine.split("  ");
        let currentLine = "";
        for (const word of words) {
          if ((currentLine + word).length > maxChars) {
            songListSvg += `<text x="600" y="${yPos}" text-anchor="middle" fill="#DBC8A0" font-family="Georgia, serif" font-size="18">${escapeXml(currentLine.trim())}</text>`;
            yPos += 26;
            currentLine = word + "  ";
          } else {
            currentLine += word + "  ";
          }
        }
        if (currentLine.trim()) {
          songListSvg += `<text x="600" y="${yPos}" text-anchor="middle" fill="#DBC8A0" font-family="Georgia, serif" font-size="18">${escapeXml(currentLine.trim())}</text>`;
          yPos += 26;
        }
        yPos += 16;
      }

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="${width}" height="${height}" fill="#3D3122"/>
        <rect x="30" y="30" width="${width - 60}" height="${height - 60}" fill="none" stroke="#8B7A5E" stroke-width="1" opacity="0.3"/>
        <defs>
          <radialGradient id="glow" cx="50%" cy="25%" r="40%">
            <stop offset="0%" stop-color="#C8952A" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="#3D3122" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#glow)"/>
        <circle cx="600" cy="100" r="45" fill="none" stroke="#C8952A" stroke-width="2" opacity="0.6"/>
        <text x="600" y="108" text-anchor="middle" fill="#C8952A" font-family="Georgia, serif" font-size="28" font-weight="bold">☠</text>
        <text x="600" y="185" text-anchor="middle" fill="#8B7A5E" font-family="Georgia, serif" font-size="16" letter-spacing="12">GRATEFUL DEAD</text>
        <text x="600" y="230" text-anchor="middle" fill="#DBC8A0" font-family="Georgia, serif" font-size="36" font-weight="bold">${escapeXml(truncate(setlist.title, 50))}</text>
        <text x="600" y="268" text-anchor="middle" fill="#8B7A5E" font-family="monospace" font-size="13">${eraName ? escapeXml(eraName) + "  ·  " : ""}curated by ${escapeXml(creatorName)}</text>
        <line x1="200" y1="290" x2="1000" y2="290" stroke="#C8952A" stroke-width="0.5" opacity="0.4"/>
        ${songListSvg}
        <text x="600" y="${height - 50}" text-anchor="middle" fill="#8B7A5E" font-family="monospace" font-size="11" letter-spacing="3">DEAD-SET.ORG · ${songCount} SONGS</text>
      </svg>`;

      return new Response(svg, {
        headers: {
          ...corsHeaders,
          "Content-Type": "image/svg+xml",
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      });
    }

    // ===== DEFAULT: HTML with OG meta tags for crawlers =====
    const ogTitle = `${setlist.title} — Dead-Set.Org`;
    const ogDescription = `A${eraName ? ` ${eraName}` : ""} dream setlist by ${creatorName}. ${songCount} songs including ${firstSongs}...`;
    const siteUrl = "https://dead-set.org";
    const canonicalUrl = `${siteUrl}/setlist/${setlistId}`;
    const ogImageUrl = `${supabaseUrl}/functions/v1/og-image?id=${setlistId}&format=image`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(ogTitle)}</title>
  <meta name="description" content="${escapeHtml(ogDescription)}">
  
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:site_name" content="Dead-Set.Org">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
  <meta name="twitter:image" content="${ogImageUrl}">
  
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}">
</head>
<body>
  <p>Redirecting to <a href="${canonicalUrl}">${escapeHtml(ogTitle)}</a>...</p>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("OG image error:", error);
    return new Response("Internal error", { status: 500, headers: corsHeaders });
  }
});

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}
