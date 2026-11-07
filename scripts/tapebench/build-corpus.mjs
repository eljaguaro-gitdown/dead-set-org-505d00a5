#!/usr/bin/env node
/**
 * Build the TapeBench corpus: every tap the product can offer, sampled in
 * proportion to the real surfaces, as one versioned JSON.
 *
 *   node scripts/tapebench/build-corpus.mjs > scripts/tapebench/corpus.json
 *
 * Reads the public tables through the anon key in .env (songs,
 * notable_versions, song_features, songbook_entries + their slots, public
 * setlists' slots with their precomputed playability). playback_issues is
 * admin-only, so the open and recent reports are a committed fixture,
 * scripts/tapebench/issues.json, refreshed by hand from the admin queue.
 *
 * Each tap carries what the bench needs to find the control on screen and
 * what the labeller needs to ask the Archive: the surface, the route, the
 * song, the night, and the stored recording (if any). Ground truth is NOT
 * written here — label.mjs asks the player's own resolver, so the corpus
 * never carries a second opinion about what is on tape.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, ".env"), "utf8").split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")]),
);
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!URL_ || !KEY) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY missing from .env");

async function rest(q) {
  const res = await fetch(`${URL_}/rest/v1/${q}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!res.ok) throw new Error(`${q}: ${res.status} ${await res.text()}`);
  return res.json();
}

const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const day = (d) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null);
const archiveNotes = (notes) => {
  if (typeof notes !== "string" || !notes.startsWith('{"__archive":true')) return null;
  try { return JSON.parse(notes.split("\n")[0]); } catch { return null; }
};

const songs = await rest("songs?select=id,title,first_played,last_played,times_played&order=times_played.desc.nullslast");
const byId = new Map(songs.map((s) => [s.id, s]));
const taps = [];
const tap = (t) => taps.push({ id: `${t.surface}:${t.songId}:${t.showDate ?? "x"}:${t.key ?? ""}`.replace(/\s+/g, ""), ...t });

// 1. Songbook: first- and last-played nights of every song the Songbook can
//    front — the curated issues, the community issues, and the spotlight
//    rotation (which draws from song_features and songbook_entries). The
//    version picker also offers these two nights for every song.
const features = await rest("song_features?select=slug,song_id,ftp_date,ltp_date,published,spotlight");
const entries = await rest("songbook_entries?select=id,song_id,setlist_id");
const songbookSongIds = new Set([...features.map((f) => f.song_id), ...entries.map((e) => e.song_id)]);
for (const sid of songbookSongIds) {
  const s = byId.get(sid);
  if (!s) continue;
  for (const [which, date] of [["first", day(s.first_played)], ["last", day(s.last_played)]]) {
    if (!date) continue;
    tap({ surface: "songbook_spotlight", route: `/songbook`, songId: sid, title: s.title, showDate: date, archiveUrl: null, key: which });
  }
}

// 2. Version picker: every song's debut and farewell (the hero and the
//    milestones), deliberately including the medley songs, plus every
//    catalog version (notable_versions) the picker lists.
const MEDLEY = ["Slipknot!", "Franklin's Tower", "Fire on the Mountain", "China Cat Sunflower", "I Know You Rider", "Help on the Way", "Scarlet Begonias", "Playing in the Band", "Drums", "Space", "The Other One", "Cryptical Envelopment"];
const PICKER_EXTRA = ["Dark Star", "Althea", "Bird Song", "Ripple", "Eyes of the World", "Stella Blue", "Viola Lee Blues", "Shakedown Street", "Crazy Fingers", "Jack Straw", "Sugaree", "Bertha", "Morning Dew", "Terrapin Station", "Estimated Prophet", "Wharf Rat", "Truckin'", "Sugar Magnolia", "Uncle John's Band", "Brokedown Palace", "Box of Rain", "Touch of Grey", "St. Stephen", "Casey Jones", "Friend of the Devil", "Deal", "Loser", "Tennessee Jed", "Brown Eyed Women", "Ramble On Rose", "Row Jimmy", "Here Comes Sunshine", "Let It Grow", "Mississippi Half-Step", "Black Peter", "Cumberland Blues", "He's Gone", "Looks Like Rain", "Cassidy", "Music Never Stopped", "The Music Never Stopped", "Samson and Delilah", "Lazy Lightning", "Supplication", "Comes a Time", "Blues for Allah", "Unbroken Chain", "Days Between", "So Many Roads", "Standing on the Moon", "Black Muddy River", "Foolish Heart", "Feel Like a Stranger", "Alabama Getaway", "Lost Sailor", "Saint of Circumstance", "New Speedway Boogie", "Dire Wolf", "High Time", "Candyman", "Cold Rain and Snow", "Good Lovin", "Not Fade Away", "Going Down the Road Feeling Bad", "One More Saturday Night", "U.S. Blues", "Promised Land", "Me and My Uncle", "El Paso", "Mexicali Blues", "Big River", "Mama Tried", "Jack-A-Roe", "Peggy-O", "It Must Have Been the Roses", "China Doll", "Weather Report Suite", "Let Me Sing Your Blues Away", "The Wheel", "Might as Well", "Lady with a Fan", "Throwing Stones", "Hell in a Bucket", "West L.A. Fadeaway", "I Need a Miracle", "Victim or the Crime", "Way to Go Home", "Corrina", "Liberty", "Eternity", "Lazy River Road", "Easy Answers", "Samba in the Rain", "Picasso Moon", "Built to Last", "Blow Away", "Just a Little Light", "Mason's Children", "Alligator", "Caution (Do Not Stop on Tracks)", "The Eleven", "Cosmic Charlie", "New Potato Caboose", "Born Cross-Eyed", "The Golden Road", "Cream Puff War", "Easy Wind", "Mr. Charlie", "Dupree's Diamond Blues", "Duprees Diamond Blues"];
const pickerTitles = new Set([...MEDLEY, ...PICKER_EXTRA]);
for (const s of songs) {
  if (!pickerTitles.has(s.title)) continue;
  for (const [which, date] of [["first", day(s.first_played)], ["last", day(s.last_played)]]) {
    if (!date) continue;
    tap({ surface: "version_picker", route: `/versions/${slugify(s.title)}`, songId: s.id, title: s.title, showDate: date, archiveUrl: null, key: which, medley: MEDLEY.includes(s.title) });
  }
}
const versions = await rest("notable_versions?select=id,song_id,show_date,archive_org_url,is_benchmark");
for (const v of versions) {
  const s = byId.get(v.song_id);
  if (!s) continue;
  tap({ surface: "version_picker", route: `/versions/${slugify(s.title)}`, songId: s.id, title: s.title, showDate: day(v.show_date), archiveUrl: v.archive_org_url, key: `nv-${v.id.slice(0, 8)}`, medley: MEDLEY.includes(s.title) });
}

// 3. The landing "Pick a song" flow: lands on /versions/:slug and plays the
//    hero (the debut). One tap per song in the picker set — same night as
//    the picker's "first", a different surface and route.
for (const s of songs) {
  if (!pickerTitles.has(s.title) || !day(s.first_played)) continue;
  tap({ surface: "landing_pick", route: `/`, songId: s.id, title: s.title, showDate: day(s.first_played), archiveUrl: null, key: "hero" });
}

// 4. Saved setlist slots, including every non-playable one. Public setlists
//    only (that is what the anon key can read, and what a stranger can tap).
const playability = await rest("setlist_slot_playability?select=slot_id,status,direct_track_url,match_score,error_message");
const pById = new Map(playability.map((p) => [p.slot_id, p]));
const slots = await rest("setlist_slots?select=id,setlist_id,song_id,notes,set_number,position,notable_version_id,notable_versions(show_date,archive_org_url),setlists!inner(is_public)&setlists.is_public=eq.true&order=setlist_id,set_number,position");
for (const sl of slots) {
  const s = byId.get(sl.song_id);
  if (!s) continue;
  const meta = archiveNotes(sl.notes);
  const showDate = day(sl.notable_versions?.show_date) ?? day(meta?.show_date);
  const archiveUrl = sl.notable_versions?.archive_org_url ?? meta?.archive_org_url ?? null;
  const p = pById.get(sl.id);
  tap({ surface: "setlist_poster", route: `/setlist/${sl.setlist_id}`, songId: s.id, title: s.title, showDate, archiveUrl, key: `slot-${sl.id.slice(0, 8)}`, slotId: sl.id, precomputed: p ? { status: p.status, directTrackUrl: p.direct_track_url, matchScore: p.match_score, error: p.error_message } : null, communityIssue: entries.some((e) => e.setlist_id === sl.setlist_id) });
}

// 5. Every open or recent playback report (fixture).
const issues = JSON.parse(fs.readFileSync(path.join(root, "scripts/tapebench/issues.json"), "utf8"));
for (const i of issues) {
  const s = byId.get(i.song_id);
  tap({ surface: "issue", route: s ? `/versions/${slugify(s.title)}` : "/", songId: i.song_id, title: i.song_title, showDate: day(i.show_date), archiveUrl: i.archive_url, trackUrl: i.track_url, key: `issue-${i.id.slice(0, 8)}`, issue: { kind: i.kind, status: i.status, id: i.id } });
}

// Sample to a bench-sized corpus, in proportion to the real surfaces. The
// field data (PostHog, 30 days to 2026-11-06) puts most taps on the song
// pages and the Songbook, with saved setlists behind them; every surface
// keeps all of its must-haves (medley songs, non-playable slots, issues)
// and fills the rest by a seeded shuffle, so the file is reproducible.
let seed = 20261106;
const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const take = (list, must, n) => {
  const kept = list.filter(must);
  const rest = shuffle(list.filter((t) => !must(t)));
  return [...kept, ...rest.slice(0, Math.max(0, n - kept.length))];
};
const by = (surface) => taps.filter((t) => t.surface === surface);
const sampled = [
  ...by("songbook_spotlight"),
  ...take(by("version_picker"), (t) => t.medley || t.key.startsWith("nv-"), 140),
  ...take(by("landing_pick"), (t) => MEDLEY.includes(t.title), 40),
  ...take(by("setlist_poster"), (t) => (t.precomputed && t.precomputed.status !== "playable") || t.communityIssue, 130),
  ...by("issue"),
];
const corpus = {
  version: 1,
  sampled: { from: taps.length, to: sampled.length },
  builtAt: new Date().toISOString(),
  source: { songs: songs.length, versions: versions.length, features: features.length, entries: entries.length, publicSlots: slots.length, issues: issues.length },
  counts: Object.fromEntries([...new Set(sampled.map((t) => t.surface))].map((s) => [s, sampled.filter((t) => t.surface === s).length])),
  taps: sampled,
};
process.stdout.write(JSON.stringify(corpus, null, 1) + "\n");
console.error(`corpus: ${sampled.length} of ${taps.length} taps`, corpus.counts);
