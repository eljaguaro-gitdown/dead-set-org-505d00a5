/**
 * score-sleepers — which recordings of a song are rated well and rarely heard.
 *
 * Fetches a song's recordings from the Internet Archive's public search and
 * runs them through the shared rule in ../_shared/sleeperScore.ts. The rule
 * lives there rather than here so it can be tested from src/ without a Deno
 * runtime or a network; this file is only fetch, shape, and respond.
 *
 * Scope note: this is the FLOOR for songs nobody has hand-curated. Where
 * `notable_versions.votes` carries transcribed headyversion votes — Crazy
 * Fingers and Shakedown Street at the time of writing — those are the better
 * signal and the caller should prefer them. This endpoint does not read or
 * overwrite them; it is additive, which is the whole point.
 *
 * Fair use: reads public metadata about items the app already links to and
 * streams, stores nothing of anyone else's, and hands back the Archive
 * identifier so every result links home.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { z } from "npm:zod@3.25.76";
import {
  scoreSleepers,
  type ArchiveRecording,
} from "../_shared/sleeperScore.ts";

const RequestSchema = z.object({
  songTitle: z.string().min(1).max(120),
  /** Optional era clamp, same shape the client's archiveOrg.ts uses. */
  yearStart: z.number().int().min(1965).max(1995).optional(),
  yearEnd: z.number().int().min(1965).max(1995).optional(),
  /** How many recordings to weigh. The Archive caps a page at a few hundred. */
  rows: z.number().int().min(1).max(200).default(100),
});

/**
 * The same query `src/lib/archiveOrg.ts` has used for months, plus the three
 * fields the sleeper rule needs. `publicdate` is when the item went up on the
 * Archive, not the show date — the rule divides downloads by it so a 2004
 * upload is not mistaken for a more popular one than a 2019 upload.
 */
function buildSearchUrl(
  title: string,
  rows: number,
  yearStart?: number,
  yearEnd?: number,
): string {
  const era =
    yearStart && yearEnd ? ` AND date:[${yearStart}-01-01 TO ${yearEnd}-12-31]` : "";
  const clean = title.replace(/["!?.,;:()\[\]]/g, "").trim();
  const q = encodeURIComponent(`collection:GratefulDead "${clean}"${era}`);
  const fl = ["identifier", "date", "avg_rating", "num_reviews", "downloads", "publicdate"]
    .map((f) => `fl[]=${f}`)
    .join("&");
  return `https://archive.org/advancedsearch.php?q=${q}&${fl}&rows=${rows}&page=1&output=json`;
}

/** The Archive returns numbers as strings often enough to be worth coercing. */
const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Bad request", detail: parsed.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { songTitle, yearStart, yearEnd, rows } = parsed.data;

    const url = buildSearchUrl(songTitle, rows, yearStart, yearEnd);
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      // Surfaced rather than swallowed: a rate limit or an outage here means
      // the scores are absent, not that the song has no sleepers.
      return new Response(
        JSON.stringify({ error: `Internet Archive returned ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await res.json();
    const docs: Record<string, unknown>[] = body?.response?.docs ?? [];

    const recordings: ArchiveRecording[] = docs.map((d) => ({
      identifier: String(d.identifier ?? ""),
      date: str(d.date),
      avgRating: num(d.avg_rating),
      numReviews: num(d.num_reviews),
      downloads: num(d.downloads),
      publicDate: str(d.publicdate),
    })).filter((r) => r.identifier !== "");

    const report = scoreSleepers(recordings);

    return new Response(
      JSON.stringify({
        songTitle,
        considered: recordings.length,
        leaderPullsPerMonth: report.leaderPullsPerMonth,
        bestRating: report.bestRating,
        sleepers: report.sleepers,
        scored: report.scored,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("score-sleepers failed:", e);
    return new Response(
      JSON.stringify({ error: (e as Error)?.message ?? "Unexpected failure" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
