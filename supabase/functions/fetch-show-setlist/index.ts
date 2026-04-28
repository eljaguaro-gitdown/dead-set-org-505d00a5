// Fetch a Grateful Dead show's setlist from archive.org for a given date.
// Returns an ordered, set-segmented list of song titles + segue flags.
// No songs DB lookup here — the client fuzzy-matches against its songs table.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface ParsedTrack {
  rawTitle: string;
  setNumber: number; // 1, 2, or 3 (encore)
  position: number;
  segueToNext: boolean;
}

interface ShowResult {
  archiveId: string;
  archiveUrl: string;
  date: string;
  venue: string | null;
  city: string | null;
  tracks: ParsedTrack[];
}

const isAudioFile = (f: any): boolean => {
  const fmt = f.format || "";
  const name = (f.name || "").toLowerCase();
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

// Pick the best recording identifier for the date.
// Prefer SBD, then highest avg_rating, then most-downloaded.
async function findBestRecordingForDate(date: string): Promise<string | null> {
  const q = encodeURIComponent(`collection:GratefulDead AND date:${date}`);
  const url = `https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&fl[]=avg_rating&fl[]=downloads&fl[]=source&sort[]=avg_rating+desc&sort[]=downloads+desc&rows=15&output=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const docs: any[] = data?.response?.docs || [];
  if (docs.length === 0) return null;

  // Prefer soundboards
  const sbd = docs.find((d) => /sbd|soundboard|matrix/i.test(d.source || d.identifier || ""));
  return (sbd || docs[0]).identifier;
}

// Strip leading track-number / disc prefix and trailing file ext.
function cleanTitle(raw: string): string {
  return raw
    .replace(/\.[^.]+$/, "")
    .replace(/^d\d+t\d+\s*[-.]?\s*/i, "")
    .replace(/^t?\d+\s*[-.]?\s*/, "")
    .replace(/\s*->\s*$/, "")
    .replace(/\s*>\s*$/, "")
    .trim();
}

// Detect segue indicators in the original title or trailing notes.
function detectSegue(raw: string): boolean {
  return /->|>\s*$|\s>\s|segue/i.test(raw);
}

// Try to parse `notes` text for set boundaries.
// Many archive uploads use:
//   Set 1:
//   1. Promised Land
//   2. Sugaree ->
//   ...
//   Set 2:
//   ...
//   Encore:
function parseNotesSetlist(notes: string): { title: string; segue: boolean; setNumber: number }[] | null {
  if (!notes) return null;
  const lines = notes.split(/\r?\n/);
  let currentSet = 0;
  const out: { title: string; segue: boolean; setNumber: number }[] = [];

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) continue;
    const setMatch = line.match(/^(?:set\s*(one|two|three|1|2|3)|first\s*set|second\s*set|third\s*set|encore)\s*[:.\-]?/i);
    if (setMatch) {
      if (/encore/i.test(line)) currentSet = 3;
      else if (/one|first|1/i.test(setMatch[1] || line)) currentSet = 1;
      else if (/two|second|2/i.test(setMatch[1] || line)) currentSet = 2;
      else if (/three|third|3/i.test(setMatch[1] || line)) currentSet = 3;
      continue;
    }
    if (currentSet === 0) continue;

    // Strip leading track numbers / bullets
    const cleaned = line
      .replace(/^[\s\d.\-)>]+/, "")
      .replace(/\s*\[[^\]]*\]\s*$/, "")
      .trim();
    if (!cleaned || cleaned.length < 2) continue;
    // Skip obvious non-song lines
    if (/^(disc|d\d|tape|reel|comments?|notes?|source|lineage|recorded|taper|transferred)/i.test(cleaned)) continue;

    const segue = detectSegue(line);
    const title = cleanTitle(cleaned).replace(/\s*->?\s*$/, "").trim();
    if (title.length < 2) continue;
    out.push({ title, segue, setNumber: currentSet });
  }

  return out.length >= 5 ? out : null;
}

// Fallback: derive from the audio file list.
// Heuristic for set breaks: gaps in disc numbering (d1 → d2) usually = next set.
function parseFromFiles(files: any[]): ParsedTrack[] {
  const audio = files.filter(isAudioFile);
  // De-dup by track title (multiple formats of same track)
  const seen = new Set<string>();
  const ordered: any[] = [];
  for (const f of audio) {
    const key = (f.title || f.name || "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(f);
  }
  // Sort by track number if present
  ordered.sort((a, b) => {
    const ta = parseInt(a.track || a.name?.match(/t(\d+)/i)?.[1] || "0", 10);
    const tb = parseInt(b.track || b.name?.match(/t(\d+)/i)?.[1] || "0", 10);
    if (ta && tb) return ta - tb;
    return (a.name || "").localeCompare(b.name || "");
  });

  // Detect disc breaks for set assignment
  const tracks: ParsedTrack[] = [];
  let currentSet = 1;
  let lastDisc = 1;
  let posInSet = 0;

  ordered.forEach((f, idx) => {
    const discMatch = (f.name || "").match(/d(\d+)t/i);
    const disc = discMatch ? parseInt(discMatch[1], 10) : lastDisc;
    if (disc > lastDisc) {
      // New disc — assume set boundary
      currentSet = Math.min(currentSet + 1, 3);
      posInSet = 0;
      lastDisc = disc;
    }
    const rawTitle = f.title || f.name || "";
    const segue = detectSegue(rawTitle);
    const title = cleanTitle(rawTitle);
    if (!title) return;
    tracks.push({
      rawTitle: title,
      setNumber: currentSet,
      position: posInSet++,
      segueToNext: segue,
    });
  });

  return tracks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { date } = await req.json();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(JSON.stringify({ error: "Invalid date. Use YYYY-MM-DD." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const archiveId = await findBestRecordingForDate(date);
    if (!archiveId) {
      return new Response(JSON.stringify({ error: "No show found for that date" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const metaRes = await fetch(`https://archive.org/metadata/${archiveId}`);
    if (!metaRes.ok) {
      return new Response(JSON.stringify({ error: "Couldn't load show metadata" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const meta = await metaRes.json();

    const m = meta.metadata || {};
    const venue = m.venue || m.coverage?.split(",")[0]?.trim() || null;
    const city = m.coverage || null;
    const notes: string = [m.notes, m.description].filter(Boolean).join("\n\n");

    // Try parsing the human-written setlist first — it has correct set breaks.
    const parsedFromNotes = parseNotesSetlist(notes);
    let tracks: ParsedTrack[];

    if (parsedFromNotes) {
      // Re-number positions per set
      const counts = new Map<number, number>();
      tracks = parsedFromNotes.map((t) => {
        const pos = counts.get(t.setNumber) || 0;
        counts.set(t.setNumber, pos + 1);
        return {
          rawTitle: t.title,
          setNumber: t.setNumber,
          position: pos,
          segueToNext: t.segue,
        };
      });
    } else {
      tracks = parseFromFiles(meta.files || []);
    }

    if (tracks.length === 0) {
      return new Response(JSON.stringify({ error: "Found the show but couldn't parse its setlist" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result: ShowResult = {
      archiveId,
      archiveUrl: `https://archive.org/details/${archiveId}`,
      date,
      venue,
      city,
      tracks,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-show-setlist error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
