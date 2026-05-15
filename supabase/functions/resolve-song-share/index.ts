const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STOP_WORDS = new Set([
  "the", "a", "an", "of", "in", "on", "to", "and", "is", "it", "be",
  "at", "for", "with", "my", "i", "you", "your", "as", "or", "by",
]);

const normalize = (s: string): string =>
  s.toLowerCase()
    .replace(/\bgood\s+times\s+blues\b/g, "good time blues")
    .replace(/\.[^.]+$/, "")
    .replace(/^d\d+t\d+\s*[-.]?\s*/i, "")
    .replace(/^t?\d+\s*[-.]?\s*/, "")
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const compact = (s: string): string => normalize(s).replace(/\s+/g, "");

const tokens = (s: string): string[] =>
  normalize(s).split(" ").filter(Boolean).map((t) => (t === "in" ? t : t.replace(/in$/, "ing")));

function matchScore(trackTitle: string, songTitle: string): number {
  const ct = compact(trackTitle);
  const cs = compact(songTitle);
  if (!ct || !cs) return 0;
  if (ct === cs) return 100;
  if (cs.length >= 4 && ct.includes(cs)) return 90;
  if (ct.length >= 4 && cs.includes(ct)) return 85;

  const trackSig = new Set(tokens(trackTitle).filter((t) => t.length > 1 && !STOP_WORDS.has(t)));
  const songSig = new Set(tokens(songTitle).filter((t) => t.length > 1 && !STOP_WORDS.has(t)));
  if (trackSig.size === 0 || songSig.size === 0) return 0;

  const overlap = [...songSig].filter((t) => trackSig.has(t)).length;
  if (overlap === songSig.size && overlap === trackSig.size) return 95;
  if (overlap === songSig.size) return 80;
  if (overlap === trackSig.size && overlap >= 2) return 70;
  return 0;
}

const isAudioFile = (file: any): boolean => {
  const fmt = file.format || "";
  const name = (file.name || "").toLowerCase();
  return (
    fmt === "VBR MP3" ||
    fmt === "Ogg Vorbis" ||
    fmt === "Flac" ||
    fmt === "24bit Flac" ||
    name.endsWith(".mp3") ||
    name.endsWith(".ogg") ||
    name.endsWith(".flac")
  );
};

async function fetchMetadata(identifier: string): Promise<{ files: any[]; resolvedId: string } | null> {
  const variants = [identifier];
  if (/\.flac\d*$/i.test(identifier)) variants.push(identifier.replace(/\.flac\d*$/i, ""));

  for (const id of variants) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`https://archive.org/metadata/${id}`);
        if (!res.ok) {
          if (attempt === 0 && (res.status >= 500 || res.status === 429)) {
            await new Promise((resolve) => setTimeout(resolve, 600));
            continue;
          }
          break;
        }
        const meta = await res.json();
        const files = meta.files || [];
        if (files.length > 0) return { files, resolvedId: id };
        break;
      } catch {
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }
      }
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { archiveOrgUrl, songTitle } = await req.json();
    if (typeof archiveOrgUrl !== "string" || typeof songTitle !== "string") {
      return new Response(JSON.stringify({ error: "archiveOrgUrl and songTitle are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const downloadMatch = archiveOrgUrl.match(/archive\.org\/download\/([^/?#]+)\/([^?#]+)/);
    if (downloadMatch?.[1] && downloadMatch?.[2]) {
      return new Response(JSON.stringify({ directTrackUrl: archiveOrgUrl, matchScore: 100 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detailsMatch = archiveOrgUrl.match(/archive\.org\/details\/([^/?#]+)/);
    const identifier = detailsMatch?.[1];
    if (!identifier) {
      return new Response(JSON.stringify({ directTrackUrl: null, error: "Invalid archive.org URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const meta = await fetchMetadata(identifier);
    if (!meta) {
      return new Response(JSON.stringify({ directTrackUrl: null, error: "Metadata unavailable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let bestScore = 0;
    let bestFile: any = null;
    for (const file of meta.files.filter(isAudioFile)) {
      const score = matchScore(file.title || file.name || "", songTitle);
      if (score > bestScore) {
        bestScore = score;
        bestFile = file;
      }
    }

    const directTrackUrl = bestFile && bestScore >= 60
      ? `https://archive.org/download/${meta.resolvedId}/${encodeURIComponent(bestFile.name)}`
      : null;

    return new Response(JSON.stringify({ directTrackUrl, matchScore: bestScore }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});