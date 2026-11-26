/**
 * check-nights: did the band play this song on these nights?
 *
 * Called before a listening guide is saved, with Charlie's picks. A pick both
 * setlist records rule out (JerryBase doesn't list it, and no Relisten source
 * of the night carries it) comes back `not_played`, and the client leaves it
 * out of the guide. Before this, those nights went straight onto the Songbook
 * shelf: 15 of 82 Songbook nights audited on 2026-11-24 were nights the song
 * wasn't played (docs/tape-desk/LOG.md).
 *
 * Read-only, public data, no secrets. verify_jwt is off (config.toml) because
 * guests save guides from the builder too, so the request is bounded here
 * instead: one song, at most MAX_DATES dates, a few at a time.
 *
 *   POST { songTitle: string, dates: string[] }
 *   → 200 { results: [{ date, verdict: "played" | "not_played" | "unknown", why }] }
 */
import { judgeNight } from "../_shared/nightCheck.ts";
import { readNight } from "../_shared/nightSources.ts";
import { pickVerdict } from "../_shared/pickVerdict.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-visitor-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_DATES = 12;
const PARALLEL = 3;
/** Shorter than the desk's 15s: a fan is waiting on the save. */
const TIMEOUT_MS = 8_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { songTitle?: unknown; dates?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "songTitle and dates required" }, 400);
  }
  const songTitle = typeof body.songTitle === "string" ? body.songTitle.trim().slice(0, 200) : "";
  const dates = Array.isArray(body.dates)
    ? [...new Set(body.dates.filter((d): d is string => typeof d === "string" && DATE.test(d)))].slice(0, MAX_DATES)
    : [];
  if (!songTitle || dates.length === 0) return json({ error: "songTitle and dates required" }, 400);

  const results: Array<{ date: string; verdict: string; why: string }> = [];
  for (let i = 0; i < dates.length; i += PARALLEL) {
    const batch = dates.slice(i, i + PARALLEL);
    const settled = await Promise.all(
      batch.map(async (date) => {
        try {
          const raw = await readNight(date, { archive: false, timeoutMs: TIMEOUT_MS });
          const j = judgeNight({ song: songTitle, date, ...raw });
          return { date, verdict: pickVerdict(j), why: j.why };
        } catch (e) {
          console.error("check-nights: night failed", date, e);
          return { date, verdict: "unknown", why: "the check failed" };
        }
      }),
    );
    results.push(...settled);
  }
  return json({ results });
});
