// Fetch a Grateful Dead show's setlist from archive.org for a given date.
// Returns an ordered, set-segmented list of song titles + segue flags.
// No songs DB lookup here — the client fuzzy-matches against its songs table.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

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

// Try to parse `notes`/`description` text for set boundaries.
// Handles BOTH line-per-song format AND comma/arrow-separated inline format
// (very common in archive.org Dead descriptions, e.g.
//   "Set 1\n\nPicasso Moon, Half Step, Stranger, ...\n\nSet 2\n\nDark Star-> Playin'-> ...").
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
}

function splitInlineSetLine(line: string): { title: string; segue: boolean }[] {
  // Normalize segue arrows to a sentinel, split on commas + arrows, preserve segue info.
  const SEGUE = "\u0001";
  const tokens = line
    .replace(/\s*->\s*/g, SEGUE + ",")     // -> means segue then split
    .replace(/\s*>\s*/g, SEGUE + ",")      // bare > means segue then split
    .split(/\s*,\s*/);
  const out: { title: string; segue: boolean }[] = [];
  for (const tokRaw of tokens) {
    let tok = tokRaw.trim();
    if (!tok) continue;
    // Strip leading "E:" / "Encore:" prefix on inline encore item
    tok = tok.replace(/^(?:e|encore)\s*[:\-.]\s*/i, "");
    const segue = tok.endsWith(SEGUE);
    tok = tok.replace(new RegExp(SEGUE, "g"), "").trim();
    const cleaned = cleanTitle(tok);
    if (cleaned.length < 2) continue;
    if (/^(disc|tape|source|lineage|recorded|taper|transferred|set\s*[123])$/i.test(cleaned)) continue;
    out.push({ title: cleaned, segue });
  }
  return out;
}

function parseNotesSetlist(notes: string): { title: string; segue: boolean; setNumber: number }[] | null {
  if (!notes) return null;
  const text = stripHtml(notes);
  const lines = text.split(/\r?\n/);
  let currentSet = 0;
  const out: { title: string; segue: boolean; setNumber: number }[] = [];

  for (const lineRaw of lines) {
    let line = lineRaw.trim();
    if (!line) continue;

    // Section header line. May appear as "Set 1", "Set 1:", "First Set", "Encore:"
    // either alone OR as a prefix to inline song list (e.g. "Set 1: Picasso Moon, ...").
    const headerRe = /^(set\s*(?:one|two|three|1|2|3)|first\s*set|second\s*set|third\s*set|encore|e)\s*[:.\-]?\s*/i;
    const headerMatch = line.match(headerRe);
    if (headerMatch) {
      const tag = headerMatch[0].toLowerCase();
      if (/encore|^e\s*[:.\-]/.test(tag)) currentSet = 3;
      else if (/one|first|1/.test(tag)) currentSet = 1;
      else if (/two|second|2/.test(tag)) currentSet = 2;
      else if (/three|third|3/.test(tag)) currentSet = 3;
      // Strip the header so any inline songs on the same line still get parsed.
      line = line.slice(headerMatch[0].length).trim();
      if (!line) continue;
    }
    if (currentSet === 0) continue;

    // Inline format: songs separated by commas and/or arrows on a single line.
    if (/[,>]|->/.test(line)) {
      for (const t of splitInlineSetLine(line)) {
        out.push({ title: t.title, segue: t.segue, setNumber: currentSet });
      }
      continue;
    }

    // Line-per-song format: strip leading numbers/bullets.
    const cleanedLine = line
      .replace(/^[\s\d.\-)>]+/, "")
      .replace(/\s*\[[^\]]*\]\s*$/, "")
      .trim();
    if (!cleanedLine || cleanedLine.length < 2) continue;
    if (/^(disc|d\d|tape|reel|comments?|notes?|source|lineage|recorded|taper|transferred)/i.test(cleanedLine)) continue;

    const segue = detectSegue(line);
    const title = cleanTitle(cleanedLine).replace(/\s*->?\s*$/, "").trim();
    if (title.length < 2) continue;
    out.push({ title, segue, setNumber: currentSet });
  }

  // Filter out junk entries (tunings, drums/space are kept as they're real setlist entries
  // but won't fuzzy-match unless the songs DB has them).
  const filtered = out.filter((t) => !/^(tuning|tune[\s-]?up|applause|banter|crowd|intro|outro|encore\s*break)$/i.test(t.title));
  return filtered.length >= 4 ? filtered : null;
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
    const tMatch =
      lower.match(/[^a-z]t(\d+)/i) ||
      lower.match(/^(\d+)[\s_.-]/) ||
      lower.match(/^(\d{1,3})[a-z]/i); // e.g. "02PicassoMoon.flac"
    return { set: null, disc: null, track: tMatch ? parseInt(tMatch[1], 10) : null };
  };

  // De-dup multiple format copies of the same logical track.
  // Key on (set/disc, track) when available, else on a normalized title
  // (alphanumerics only, lowercased) so "Picasso Moon" and "PicassoMoon"
  // collapse to a single entry.
  const normForKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const byKey = new Map<string, { file: any; parsed: ReturnType<typeof parseFilename>; cleaned: string }>();
  for (const f of audio) {
    const parsed = parseFilename(f.name || "");
    // Prefer the human-written title when present; the filename often loses spaces.
    const cleaned = cleanTitle(f.title || f.name || "");
    const key =
      parsed.set !== null && parsed.track !== null
        ? `s${parsed.set}t${parsed.track}`
        : parsed.disc !== null && parsed.track !== null
          ? `d${parsed.disc}t${parsed.track}`
          : parsed.track !== null
            ? `t${parsed.track}`
            : `n:${normForKey(cleaned)}`;
    const existing = byKey.get(key);
    const looksLikeFilename = (s: string) => !s || /^gd\d{2,4}/i.test(s) || /[a-z][A-Z]/.test(s);
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
    const body = await req.json();
    let date: string | undefined = body.date;
    const month: number | undefined = body.month;
    const day: number | undefined = body.day;
    const aggregate: boolean = body.aggregate === true;

    // Find all show dates matching MM-DD across 1965-1995.
    // Query each year individually — archive has 18k+ Dead recordings and
    // a single bulk query can't be filtered server-side by MM-DD.
    const findMatchingDates = async (mm: string, dd: string): Promise<string[]> => {
      const years = Array.from({ length: 31 }, (_, i) => 1965 + i);
      const results = await Promise.all(
        years.map(async (yr) => {
          const iso = `${yr}-${mm}-${dd}`;
          const q = encodeURIComponent(
            `collection:GratefulDead AND date:[${iso} TO ${iso}]`,
          );
          const searchUrl = `https://archive.org/advancedsearch.php?q=${q}&fl[]=date&rows=1&output=json`;
          try {
            const sRes = await fetch(searchUrl);
            if (!sRes.ok) return null;
            const sData = await sRes.json();
            return (sData?.response?.numFound ?? 0) > 0 ? iso : null;
          } catch { return null; }
        }),
      );
      return results.filter((d): d is string => !!d).sort();
    };

    // Aggregate mode: pull tracks from EVERY show on this MM-DD across all years.
    if (aggregate && Number.isInteger(month) && Number.isInteger(day)) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const dates = await findMatchingDates(mm, dd);
      if (dates.length === 0) {
        return new Response(
          JSON.stringify({ error: `No Grateful Dead shows on ${mm}/${dd} across all years.` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Fetch each show's tracks in parallel (cap at 30 dates to be safe)
      const limited = dates.slice(0, 30);
      const showResults = await Promise.all(
        limited.map(async (d) => {
          try {
            const id = await findBestRecordingForDate(d);
            if (!id) return null;
            const mr = await fetch(`https://archive.org/metadata/${id}`);
            if (!mr.ok) return null;
            const meta = await mr.json();
            const m = meta.metadata || {};
            const venue = m.venue || m.coverage?.split(",")[0]?.trim() || null;
            const notes: string = [m.notes, m.description].filter(Boolean).join("\n\n");
            const parsedFromNotes = parseNotesSetlist(notes);
            const tracks: ParsedTrack[] = parsedFromNotes
              ? parsedFromNotes.map((t, i) => ({ rawTitle: t.title, setNumber: t.setNumber, position: i, segueToNext: t.segue }))
              : parseFromFiles(meta.files || []);
            return { date: d, venue, archiveId: id, tracks };
          } catch { return null; }
        }),
      );

      // Aggressive normalization to collapse near-duplicates:
      // strip parenthetical/bracket asides ("(reprise)", "[jam]"), version markers
      // ("part 2", "pt. ii", "version 3"), "feat./featuring/with X", segue arrows,
      // leading articles, then punctuation + whitespace.
      const ROMAN: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4", v: "5" };
      const normalizeTitle = (raw: string): string => {
        let s = " " + raw.toLowerCase() + " ";
        s = s.replace(/[\(\[][^)\]]*[\)\]]/g, " ");                    // (reprise), [jam]
        s = s.replace(/\s(feat\.?|ft\.?|featuring|with|w\/)\s.+$/g, " "); // feat. X
        s = s.replace(/\s(jam|reprise|tease|tuning|intro|outro|finale|coda)\b/g, " ");
        s = s.replace(/\s(pt\.?|part)\s*([ivx]+|\d+)\b/g, (_m, _p, n) => " " + (ROMAN[n] || n));
        s = s.replace(/\sv(ersion|er)?\.?\s*\d+\b/g, " ");
        s = s.replace(/\s(take|tk)\s*\d+\b/g, " ");
        s = s.replace(/->|>/g, " ");
        s = s.replace(/^\s*(the|a|an)\s+/g, " ");
        s = s.replace(/[^a-z0-9]+/g, "");
        return s;
      };

      const seen = new Map<string, { rawTitle: string; date: string; venue: string | null; setNumber: number }>();
      for (const show of showResults) {
        if (!show) continue;
        for (const t of show.tracks) {
          const key = normalizeTitle(t.rawTitle);
          if (key.length < 2) continue;
          if (!seen.has(key)) {
            seen.set(key, { rawTitle: t.rawTitle, date: show.date, venue: show.venue, setNumber: t.setNumber });
          }
        }
      }

      const allUnique = Array.from(seen.values());
      if (allUnique.length === 0) {
        return new Response(
          JSON.stringify({ error: `Found shows on ${mm}/${dd} but couldn't parse any setlists.` }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Cap to a realistic show length: 8-10 per set, 2 sets + 1-2 encore (~20 songs).
      // Sample evenly across years so the setlist spans eras, not just the earliest shows.
      allUnique.sort((a, b) => a.date.localeCompare(b.date));
      const SET_SIZE = 9;
      const ENCORE_SIZE = 2;
      const TARGET = SET_SIZE * 2 + ENCORE_SIZE; // 20
      let unique: typeof allUnique;
      if (allUnique.length <= TARGET) {
        unique = allUnique;
      } else {
        const step = allUnique.length / TARGET;
        const picked: typeof allUnique = [];
        for (let i = 0; i < TARGET; i++) {
          picked.push(allUnique[Math.floor(i * step)]);
        }
        unique = picked;
      }
      const total = unique.length;
      const encoreCount = Math.min(ENCORE_SIZE, Math.max(1, total - SET_SIZE * 2));
      const set1End = Math.min(SET_SIZE, Math.floor((total - encoreCount) / 2));
      const aggregatedTracks: Array<ParsedTrack & { sourceDate?: string; sourceVenue?: string | null }> = unique.map((u, i) => {
        let setNumber: number;
        if (i >= total - encoreCount) setNumber = 3;
        else if (i < set1End) setNumber = 1;
        else setNumber = 2;
        return {
          rawTitle: u.rawTitle,
          setNumber,
          position: i,
          segueToNext: false,
          sourceDate: u.date,
          sourceVenue: u.venue,
        };
      });

      const yearsRepresented = Array.from(new Set(unique.map((u) => u.date.slice(0, 4)))).sort();
      const result = {
        archiveId: "aggregate",
        archiveUrl: `https://archive.org/search.php?query=collection%3AGratefulDead+AND+date%3A*-${mm}-${dd}`,
        date: `${mm}-${dd}-aggregate`,
        venue: `${MONTHS[month - 1]} ${day} — across ${yearsRepresented.length} year${yearsRepresented.length === 1 ? "" : "s"} (${yearsRepresented.join(", ")})`,
        city: null,
        tracks: aggregatedTracks,
        aggregate: true,
        showsScanned: limited.length,
        yearsRepresented: yearsRepresented.length,
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Random-year mode: pick one show on this MM-DD.
    if (!date && Number.isInteger(month) && Number.isInteger(day)) {
      const mm = String(month).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const dates = await findMatchingDates(mm, dd);
      if (dates.length === 0) {
        return new Response(
          JSON.stringify({ error: `No Grateful Dead shows on ${mm}/${dd} across all years.` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      date = dates[Math.floor(Math.random() * dates.length)];
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(JSON.stringify({ error: "Invalid date. Use YYYY-MM-DD or {month, day}." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const archiveId = await findBestRecordingForDate(date);
    if (!archiveId) {
      const nearby = await findNearbyShowDates(date);
      const niceList = nearby.slice(0, 3).join(", ");
      const message = nearby.length
        ? `No show on ${date} — the Dead were off that night. Nearby shows: ${niceList}`
        : `No show found on ${date} (and none within a few weeks).`;
      return new Response(
        JSON.stringify({ error: message, nearbyDates: nearby }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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
