// Precomputes per-slot Archive.org playability so the hero "Now Spinning" CTA
// (and any future Play All) can rely on cached direct track URLs instead of
// running live archive.org lookups on every click.
//
// Mirrors the matching logic in src/lib/archiveOrg.ts but runs server-side so
// we never violate the workspace rule about hitting archive.org from the client.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STOP_WORDS = new Set([
  "the","a","an","of","in","on","to","and","is","it","be",
  "at","for","with","my","i","you","your","as","or","by",
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
  const ct = compact(trackTitle), cs = compact(songTitle);
  if (!ct || !cs) return 0;
  if (ct === cs) return 100;
  if (cs.length >= 4 && ct.includes(cs)) return 90;
  if (ct.length >= 4 && cs.includes(ct)) return 85;
  const trackTok = tokens(trackTitle).filter((t) => t.length > 1);
  const songTok = tokens(songTitle).filter((t) => t.length > 1);
  const trackSig = new Set(trackTok.filter((t) => !STOP_WORDS.has(t)));
  const songSig = new Set(songTok.filter((t) => !STOP_WORDS.has(t)));
  if (trackSig.size === 0 || songSig.size === 0) return 0;
  const overlap = [...songSig].filter((t) => trackSig.has(t)).length;
  if (overlap === songSig.size && overlap === trackSig.size) return 95;
  if (overlap === songSig.size) return 80;
  if (overlap === trackSig.size && overlap >= 2) return 70;
  return 0;
}

const isAudioFile = (f: any) => {
  const fmt = f.format || "";
  const name = (f.name || "").toLowerCase();
  return fmt === "VBR MP3" || fmt === "Ogg Vorbis" || fmt === "Flac" || fmt === "24bit Flac"
    || name.endsWith(".mp3") || name.endsWith(".ogg") || name.endsWith(".flac");
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
            await new Promise((r) => setTimeout(r, 600)); continue;
          }
          break;
        }
        const meta = await res.json();
        if ((meta.files || []).length > 0) return { files: meta.files, resolvedId: id };
        break;
      } catch {
        if (attempt === 0) { await new Promise((r) => setTimeout(r, 600)); continue; }
      }
    }
  }
  return null;
}

async function resolveSlot(archiveUrl: string, songTitle: string) {
  const m = archiveUrl.match(/archive\.org\/details\/([^/?#]+)/);
  const identifier = m?.[1];
  if (!identifier) return { status: "error" as const, error: "invalid archive URL" };

  const meta = await fetchMetadata(identifier);
  if (!meta) return { status: "error" as const, error: "metadata fetch failed" };

  const isMp3 = (f: any) =>
    f.format === "VBR MP3" || (f.name || "").toLowerCase().endsWith(".mp3");
  let bestScore = 0; let bestFile: any = null;
  for (const f of meta.files.filter(isAudioFile)) {
    const score = matchScore(f.title || f.name || "", songTitle);
    // MP3 wins ties: raw FLAC won't stream through AVPlayer in the iOS app.
    if (score > bestScore || (score === bestScore && bestFile && !isMp3(bestFile) && isMp3(f))) {
      bestScore = score; bestFile = f;
    }
  }
  if (bestFile && bestScore >= 60) {
    return {
      status: "playable" as const,
      direct_track_url: `https://archive.org/download/${meta.resolvedId}/${encodeURIComponent(bestFile.name)}`,
      match_score: bestScore,
    };
  }
  return { status: "unresolved" as const, match_score: bestScore };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 40), 100);
  const staleDays = Number(url.searchParams.get("stale_days") ?? 7);

  const { data: rows, error: pickErr } = await supabase
    .rpc("next_slots_to_check", { _limit: limit, _stale_days: staleDays });

  if (pickErr) {
    return new Response(JSON.stringify({ error: pickErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const results = { processed: 0, playable: 0, unresolved: 0, errored: 0 };

  for (const row of (rows ?? []) as Array<{ slot_id: string; archive_org_url: string; song_title: string }>) {
    const r = await resolveSlot(row.archive_org_url, row.song_title);
    const payload: Record<string, unknown> = {
      slot_id: row.slot_id,
      status: r.status,
      checked_at: new Date().toISOString(),
      direct_track_url: (r as any).direct_track_url ?? null,
      match_score: (r as any).match_score ?? null,
      error_message: (r as any).error ?? null,
    };
    const { error: upErr } = await supabase
      .from("setlist_slot_playability")
      .upsert(payload, { onConflict: "slot_id" });
    if (upErr) { results.errored++; continue; }
    results.processed++;
    if (r.status === "playable") results.playable++;
    else if (r.status === "unresolved") results.unresolved++;
    else results.errored++;
    // Be polite to archive.org
    await new Promise((r) => setTimeout(r, 150));
  }

  return new Response(JSON.stringify(results),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
