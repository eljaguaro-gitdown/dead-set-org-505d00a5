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

// Find Dead show dates within ±N days of the given date.
async function findNearbyShowDates(date: string, windowDays = 21): Promise<string[]> {
  const target = new Date(date + "T00:00:00Z");
  const start = new Date(target.getTime() - windowDays * 86400000).toISOString().slice(0, 10);
  const end = new Date(target.getTime() + windowDays * 86400000).toISOString().slice(0, 10);
  const q = encodeURIComponent(
    `collection:GratefulDead AND date:[${start}T00:00:00Z TO ${end}T23:59:59Z]`,
  );
  const url = `https://archive.org/advancedsearch.php?q=${q}&fl[]=date&rows=200&output=json&sort[]=date+asc`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const docs: any[] = data?.response?.docs || [];
  const dates = new Set<string>();
  for (const d of docs) {
    const iso = (d.date || "").slice(0, 10);
    if (iso && iso !== date) dates.add(iso);
  }
  // Sort by proximity to target
  return Array.from(dates).sort((a, b) => {
    const da = Math.abs(new Date(a + "T00:00:00Z").getTime() - target.getTime());
    const db = Math.abs(new Date(b + "T00:00:00Z").getTime() - target.getTime());
    return da - db;
  }).slice(0, 5);
}

// Strip leading track-number / disc / set prefix, trailing file ext, and decoration.
function cleanTitle(raw: string): string {
  return raw
    .replace(/\.[^.]+$/, "")                       // .flac, .mp3
    .replace(/^[ds]\d+t\d+\s*[-.:]?\s*/i, "")      // d1t03 — or s2t01 -
    .replace(/^t?\d+\s*[-.:]?\s*/, "")             // 03 - or t03.
    .replace(/[*†‡#@~]+/g, "")                     // segue/jam asterisks anywhere
    .replace(/^['"]+|['"]+$/g, "")                 // wrapping quotes
    .replace(/\s*->\s*$/, "")
    .replace(/\s*>\s*$/, "")
    .replace(/\s*[!?.]+$/, "")                     // trailing punctuation
    .replace(/\s+/g, " ")
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
// GD recordings encode set or disc + track in filename:
//   gd77-05-08s1t03.flac  → set 1, track 3
//   gd1990-03-29d1t04.shn → disc 1, track 4
function parseFromFiles(files: any[]): ParsedTrack[] {
  const audio = files.filter(isAudioFile);

  const parseFilename = (name: string): { set: number | null; disc: number | null; track: number | null } => {
    const lower = (name || "").toLowerCase();
    const setMatch = lower.match(/s(\d)t(\d+)/i);
    if (setMatch) {
      return { set: parseInt(setMatch[1], 10), disc: null, track: parseInt(setMatch[2], 10) };
    }
    const discMatch = lower.match(/d(\d)t(\d+)/i);
    if (discMatch) {
      return { set: null, disc: parseInt(discMatch[1], 10), track: parseInt(discMatch[2], 10) };
    }
    const tMatch = lower.match(/[^a-z]t(\d+)/i) || lower.match(/^(\d+)[\s_.-]/);
    return { set: null, disc: null, track: tMatch ? parseInt(tMatch[1], 10) : null };
  };

  // De-dup multiple format copies of the same logical track.
  // Key on (set/disc, track) when available, else on cleaned title.
  // Prefer the variant whose `title` is a real song name (not the filename).
  const byKey = new Map<string, { file: any; parsed: ReturnType<typeof parseFilename>; cleaned: string }>();
  for (const f of audio) {
    const parsed = parseFilename(f.name || "");
    const cleaned = cleanTitle(f.title || f.name || "");
    const key =
      parsed.set !== null && parsed.track !== null
        ? `s${parsed.set}t${parsed.track}`
        : parsed.disc !== null && parsed.track !== null
          ? `d${parsed.disc}t${parsed.track}`
          : `n:${cleaned.toLowerCase()}`;
    const existing = byKey.get(key);
    const looksLikeFilename = (s: string) => !s || /^gd\d{2,4}/i.test(s);
    if (!existing) {
      byKey.set(key, { file: f, parsed, cleaned });
    } else if (looksLikeFilename(existing.cleaned) && !looksLikeFilename(cleaned)) {
      byKey.set(key, { file: f, parsed, cleaned });
    }
  }

  const entries = Array.from(byKey.values());
  const usesSetMarkers = entries.some((e) => e.parsed.set !== null);

  entries.sort((a, b) => {
    const aGroup = usesSetMarkers ? (a.parsed.set ?? 99) : (a.parsed.disc ?? 99);
    const bGroup = usesSetMarkers ? (b.parsed.set ?? 99) : (b.parsed.disc ?? 99);
    if (aGroup !== bGroup) return aGroup - bGroup;
    const at = a.parsed.track ?? 999;
    const bt = b.parsed.track ?? 999;
    if (at !== bt) return at - bt;
    return (a.file.name || "").localeCompare(b.file.name || "");
  });

  const tracks: ParsedTrack[] = [];
  const posCounters = new Map<number, number>();

  for (const { file, parsed, cleaned } of entries) {
    // Skip junk titles that are still just the filename
    if (!cleaned || /^gd\d{2,4}[-_]?\d/i.test(cleaned)) continue;
    // Skip pre-show tunings, applause, banter, drums/space (often not in songs DB)
    if (/^(tuning|tune[\s-]?up|applause|banter|crowd[\s-]?noise|intro|outro)$/i.test(cleaned)) continue;

    const setNumber = usesSetMarkers
      ? Math.min(parsed.set ?? 1, 3)
      : Math.min(parsed.disc ?? 1, 3);
    const pos = posCounters.get(setNumber) || 0;
    posCounters.set(setNumber, pos + 1);

    tracks.push({
      rawTitle: cleaned,
      setNumber,
      position: pos,
      segueToNext: detectSegue(file.title || file.name || ""),
    });
  }

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
