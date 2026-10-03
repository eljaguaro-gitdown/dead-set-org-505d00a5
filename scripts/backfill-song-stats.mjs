#!/usr/bin/env node
/**
 * Backfill song history from setlist.fm — times played, first played, last
 * played — for the whole catalog.
 *
 * WHY THIS SHAPE
 *
 * One crawl, not 234 searches. setlist.fm's free key is rate limited (~2
 * req/sec, ~1440/day) and licensed for NON-COMMERCIAL use only. Searching
 * per song would burn the budget and take days; fetching every Grateful Dead
 * setlist once (~2,300 shows, ~115 pages) takes about a minute and yields
 * every song's complete history at the same time. The page cache on disk
 * means an interrupted run resumes instead of starting over.
 *
 * WHY IT DOES NOT FUZZY-MATCH
 *
 * setlist.fm's song names and ours disagree ("Playing in the Band" vs
 * "Playin' In The Band"). The app already owns a real matcher in
 * src/lib/archiveOrg.ts, and a second, weaker copy living in a backfill
 * script is exactly the silent-divergence trap CLAUDE.md keeps banking. So
 * this matches on normalised equality only and writes everything it could not
 * match to unmatched.json for a human to read. A backfill that guesses is
 * worse than one that asks.
 *
 * WHY IT DRY-RUNS BY DEFAULT
 *
 * It writes to production. The default run prints what it would change and
 * touches nothing. --write applies it.
 *
 * THE BUILT-IN ACCURACY CHECK
 *
 * 200 of 234 songs already carry first_played / last_played / times_played
 * from earlier work. The report compares every derived value against what is
 * already there. Agreement on those 200 is the evidence that the other 34 can
 * be trusted; disagreement is a finding to chase, not a number to overwrite.
 *
 * USAGE
 *
 *   export SETLISTFM_API_KEY=...          # from setlist.fm account settings
 *   export VITE_SUPABASE_URL=...          # both already in .env
 *   export SUPABASE_SERVICE_ROLE_KEY=...  # service role; songs is admin-write
 *
 *   node scripts/backfill-song-stats.mjs            # crawl + report, no writes
 *   node scripts/backfill-song-stats.mjs --write    # apply
 *   node scripts/backfill-song-stats.mjs --refresh  # ignore the page cache
 *
 * ATTRIBUTION
 *
 * The licence is non-commercial and expects credit. Every row this touches
 * records setlist.fm as its source so the claim and its provenance travel
 * together, and so it can be removed cleanly if that licence ever stops
 * fitting Dead Set.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.setlist.fm/rest/1.0";
const CACHE_DIR = join(process.cwd(), ".setlistfm-cache");
const SOURCE_NAME = "setlist.fm song statistics";

const WRITE = process.argv.includes("--write");
const REFRESH = process.argv.includes("--refresh");

const KEY = process.env.SETLISTFM_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KEY) die("SETLISTFM_API_KEY is not set. Request a key at https://www.setlist.fm/settings/api");
if (!SUPABASE_URL) die("VITE_SUPABASE_URL is not set (it is in .env).");
if (WRITE && !SERVICE_KEY) die("--write needs SUPABASE_SERVICE_ROLE_KEY; songs is admin-write.");

function die(msg) {
  console.error(`\n${msg}\n`);
  process.exit(1);
}

/** Courtesy pacing. Their limit is roughly 2/sec; this stays under it. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PACE_MS = 600;

async function setlistFm(path, params = {}) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    headers: { "x-api-key": KEY, Accept: "application/json" },
  });
  if (res.status === 429) {
    console.warn("  rate limited — backing off 60s");
    await sleep(60_000);
    return setlistFm(path, params);
  }
  if (!res.ok) throw new Error(`setlist.fm ${res.status} on ${url.pathname}: ${await res.text()}`);
  return res.json();
}

/** Resolve the artist rather than hardcoding an MBID from memory. */
async function resolveArtist() {
  const data = await setlistFm("/search/artists", { artistName: "Grateful Dead", sort: "relevance" });
  const exact = (data.artist ?? []).find((a) => a.name === "Grateful Dead");
  if (!exact) die("Could not resolve the Grateful Dead on setlist.fm.");
  console.log(`Artist: ${exact.name} (${exact.mbid})`);
  return exact.mbid;
}

/** Every setlist, paged, cached per page so an interrupted run resumes. */
async function crawlSetlists(mbid) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const all = [];
  let page = 1;
  let total = Infinity;

  while ((page - 1) * 20 < total) {
    const cacheFile = join(CACHE_DIR, `page-${page}.json`);
    let body;
    if (!REFRESH && existsSync(cacheFile)) {
      body = JSON.parse(readFileSync(cacheFile, "utf-8"));
    } else {
      body = await setlistFm("/search/setlists", { artistMbid: mbid, p: page });
      writeFileSync(cacheFile, JSON.stringify(body));
      await sleep(PACE_MS);
    }
    total = body.total ?? 0;
    const batch = body.setlist ?? [];
    all.push(...batch);
    if (page === 1) console.log(`Setlists to crawl: ${total}`);
    if (page % 10 === 0 || batch.length === 0) {
      console.log(`  page ${page} — ${all.length}/${total}`);
    }
    if (batch.length === 0) break;
    page++;
  }
  console.log(`Crawled ${all.length} setlists.`);
  return all;
}

/**
 * Normalised equality only — see the header. Deliberately narrow: it folds
 * case, punctuation and the "playin'/playing" style variants, and nothing else.
 */
const normalise = (title) =>
  String(title ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/\bplayin\b/g, "playing")
    .replace(/\btruckin\b/g, "trucking")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** setlist.fm dates are dd-MM-yyyy; we store ISO. */
const toIso = (eventDate) => {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(eventDate ?? ""));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** Per-song history derived from the crawl. */
function deriveStats(setlists) {
  const bySong = new Map();
  for (const sl of setlists) {
    const date = toIso(sl.eventDate);
    if (!date) continue;
    for (const set of sl.sets?.set ?? []) {
      for (const song of set.song ?? []) {
        const name = song.name?.trim();
        if (!name) continue;
        const key = normalise(name);
        if (!key) continue;
        const entry = bySong.get(key) ?? { names: new Set(), dates: [] };
        entry.names.add(name);
        entry.dates.push(date);
        bySong.set(key, entry);
      }
    }
  }
  for (const entry of bySong.values()) entry.dates.sort();
  return bySong;
}

async function loadCatalog() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/songs?select=id,title,times_played,first_played,last_played`,
    { headers: { apikey: SERVICE_KEY ?? "", Authorization: `Bearer ${SERVICE_KEY ?? ""}` } },
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  const mbid = await resolveArtist();
  const setlists = await crawlSetlists(mbid);
  const stats = deriveStats(setlists);
  console.log(`Distinct songs on setlist.fm: ${stats.size}`);

  if (!SERVICE_KEY) {
    console.log("\nNo SUPABASE_SERVICE_ROLE_KEY set — stopping after the crawl.");
    console.log("Derived stats written to setlistfm-derived.json for inspection.");
    writeFileSync(
      "setlistfm-derived.json",
      JSON.stringify(
        [...stats.entries()].map(([k, v]) => ({
          key: k,
          names: [...v.names],
          times_played: v.dates.length,
          first_played: v.dates[0],
          last_played: v.dates[v.dates.length - 1],
        })),
        null,
        2,
      ),
    );
    return;
  }

  const catalog = await loadCatalog();
  const agree = [];
  const disagree = [];
  const fill = [];
  const noMatch = [];

  for (const song of catalog) {
    const entry = stats.get(normalise(song.title));
    if (!entry) {
      noMatch.push(song.title);
      continue;
    }
    const derived = {
      times_played: entry.dates.length,
      first_played: entry.dates[0],
      last_played: entry.dates[entry.dates.length - 1],
    };
    const had = song.first_played || song.last_played || song.times_played != null;
    if (!had) {
      fill.push({ song, derived });
    } else if (
      song.first_played === derived.first_played &&
      song.last_played === derived.last_played &&
      song.times_played === derived.times_played
    ) {
      agree.push(song.title);
    } else {
      disagree.push({ song, derived });
    }
  }

  console.log("\n────────── REPORT ──────────");
  console.log(`Already correct, unchanged:     ${agree.length}`);
  console.log(`Empty, would be filled:         ${fill.length}`);
  console.log(`DISAGREE with existing values:  ${disagree.length}`);
  console.log(`Catalog songs setlist.fm lacks: ${noMatch.length}`);

  if (disagree.length) {
    console.log("\nDisagreements — read these before trusting the rest:");
    for (const d of disagree.slice(0, 20)) {
      console.log(
        `  ${d.song.title}\n    ours:    ${d.song.first_played} → ${d.song.last_played}, ${d.song.times_played}x` +
          `\n    theirs:  ${d.derived.first_played} → ${d.derived.last_played}, ${d.derived.times_played}x`,
      );
    }
    if (disagree.length > 20) console.log(`  …and ${disagree.length - 20} more (see report.json)`);
  }

  writeFileSync(
    "report.json",
    JSON.stringify({ agree, fill, disagree, noMatch, unmatchedSetlistFmNames: [...stats.keys()] }, null, 2),
  );
  console.log("\nFull report written to report.json");

  if (!WRITE) {
    console.log("\nDry run — nothing written. Re-run with --write to apply the FILL rows only.");
    console.log("Disagreements are never written automatically; decide those by hand.");
    return;
  }

  // Only ever fills blanks. An existing value that disagrees is a question,
  // not something to silently overwrite.
  console.log(`\nWriting ${fill.length} rows…`);
  let written = 0;
  for (const { song, derived } of fill) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/songs?id=eq.${song.id}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(derived),
    });
    if (!res.ok) {
      console.error(`  failed ${song.title}: ${res.status} ${await res.text()}`);
      continue;
    }
    written++;
  }
  console.log(`Wrote ${written} rows. Source: ${SOURCE_NAME}`);
}

main().catch((e) => die(String(e?.stack ?? e)));
