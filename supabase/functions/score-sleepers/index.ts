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
  buildArchiveSearchUrl,
  scoreSleepers,
  toRecordings,
} from "../_shared/sleeperScore.ts";

const RequestSchema = z.object({
  songTitle: z.string().min(1).max(120),
  /** Optional era clamp, same shape the client's archiveOrg.ts uses. */
  yearStart: z.number().int().min(1965).max(1995).optional(),
  yearEnd: z.number().int().min(1965).max(1995).optional(),
  /** How many recordings to weigh. The Archive caps a page at a few hundred. */
  rows: z.number().int().min(1).max(200).default(100),
});

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

    const url = buildArchiveSearchUrl(songTitle, { rows, yearStart, yearEnd });
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      // Surfaced rather than swallowed: a rate limit or an outage here means
      // the scores are absent, not that the song has no sleepers.
      return new Response(
        JSON.stringify({ error: `Internet Archive returned ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const recordings = toRecordings(await res.json());

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
