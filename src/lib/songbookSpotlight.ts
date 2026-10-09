import { supabase } from "@/integrations/supabase/client";
import { songbookDb } from "@/lib/songbookDb";
import { isoWeekIndex } from "@/lib/featuredRotation";
import { hasVoteData, sleepers } from "@/lib/sleeperMath";
import { decodeArchiveNotes } from "@/hooks/useSetlist";
import { nightFromSlot, venueForDate, type CommunityNight } from "@/lib/communityIssue";
import { songSlug } from "@/lib/songSlug";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";
import type { PlayableSlot } from "@/contexts/AudioPlayerContext";

/**
 * The Songbook card on the home page: which song it carries this week, and
 * what it says about that song.
 *
 * It used to be a takeover: whichever `song_features` row had `spotlight =
 * true` sat in the hero until somebody cleared the flag by hand. Crazy Fingers
 * had held it since 2026-09-18. That column is no longer read. The card now
 * walks the whole shelf, one song a week, with no cron and no flag to forget:
 *
 *   1. A NEW ISSUE LEADS ITS LAUNCH WEEK. An editorial issue whose `week_of`
 *      is less than seven days old takes the card, so publishing one is
 *      visible the same day.
 *   2. OTHERWISE THE SHELF ROTATES. Issues newest first, then the community
 *      entries in the order they were mapped, advancing one place every ISO
 *      week (Monday, UTC). The week index seeds the position, so every visitor
 *      sees the same song all week.
 *
 * Community entries ride in the same rotation. 2 of the 8 songs on the shelf
 * are editorial issues; with only those, the card would repeat every other
 * week. A community entry is never labelled an issue (the shelf's own rule),
 * and its card is built from what is actually known: lifespan from `songs`
 * and the nights from the guide.
 *
 * The card names nobody. The guide's own page credits whoever mapped it; the
 * front door is the community's. When the rotation went in, 5 of the 6
 * community entries had one mapper, the founder, which would have put one
 * handle on the home page 5 weeks in 8. So the name is not loaded at all,
 * and the card cannot print what it was never given.
 *
 * Adding a song to the shelf shifts the positions after it, so the card can
 * change mid-week when something is published. Same trade featuredRotation
 * makes, for the same reason: no table to keep in step.
 */

// ── shelf entries ───────────────────────────────────────────────────────────

/** The `song_features` columns the card prints. */
export interface IssueFields {
  headline: string | null;
  ftp_date: string | null;
  ftp_venue: string | null;
  ftp_city: string | null;
  ltp_date: string | null;
  ltp_venue: string | null;
  ltp_city: string | null;
  ltp_note: string | null;
  times_played: number | null;
}

interface ShelfBase {
  slug: string;
  title: string;
  songId: string;
  /** Issue: its `week_of`. Community: when it was mapped. Orders the shelf. */
  since: string;
}

export interface IssueEntry extends ShelfBase {
  kind: "issue";
  issueNumber: number | null;
  issue: IssueFields;
}

export interface CommunityEntry extends ShelfBase {
  kind: "community";
  setlistId: string;
  /** From `songs`, which is what the community issue page prints too. */
  firstPlayed: string | null;
  lastPlayed: string | null;
  timesPlayed: number | null;
}

export type ShelfEntry = IssueEntry | CommunityEntry;

// ── rotation ────────────────────────────────────────────────────────────────

/**
 * The week the rotation began, 2026-10-05. Position 0 is the newest issue, so
 * the first week carries the song the card already had (Crazy Fingers). Only
 * the design changes that week, and the rotation starts the Monday after.
 */
export const ROTATION_EPOCH_WEEK = isoWeekIndex(new Date("2026-10-05T12:00:00Z"));

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Issues newest first, then community entries oldest first. A song with both
 * an issue and a community entry appears once, as the issue. The issue page
 * makes the same choice, since the editorial entry is the one at that url.
 */
export const shelfOrder = (entries: ShelfEntry[]): ShelfEntry[] => {
  const issues = entries
    .filter((e): e is IssueEntry => e.kind === "issue")
    .sort((a, b) => b.since.localeCompare(a.since) || a.slug.localeCompare(b.slug));
  const covered = new Set(issues.map((i) => i.songId));
  const community = entries
    .filter((e): e is CommunityEntry => e.kind === "community" && !covered.has(e.songId))
    .sort((a, b) => a.since.localeCompare(b.since) || a.slug.localeCompare(b.slug));
  return [...issues, ...community];
};

/** An editorial issue in its first seven days. Never a future-dated one. */
export const isLaunchWeek = (entry: ShelfEntry, now: Date): boolean => {
  if (entry.kind !== "issue") return false;
  const t = Date.parse(`${entry.since.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(t)) return false;
  const age = now.getTime() - t;
  return age >= 0 && age < WEEK_MS;
};

/**
 * This week's song. `now` and `weekIndex` are parameters so a test can stand
 * on an exact Monday: a rotation you can only check by waiting a week will
 * never be checked.
 */
export const spotlightForWeek = (
  entries: ShelfEntry[],
  now: Date = new Date(),
  weekIndex: number = isoWeekIndex(now),
): ShelfEntry | null => {
  const ordered = shelfOrder(entries);
  if (ordered.length === 0) return null;
  const launching = ordered.find((e) => isLaunchWeek(e, now));
  if (launching) return launching;
  const n = ordered.length;
  return ordered[(((weekIndex - ROTATION_EPOCH_WEEK) % n) + n) % n];
};

// ── the card's model ───────────────────────────────────────────────────────

export type End = "first" | "last";

/** One end of the song's life on stage: the first night, or the last. */
export interface LifespanEnd {
  which: End;
  /** ISO date, which is what the player resolves. Null when unreadable. */
  date: string | null;
  /** As printed. For an issue this is the issue's own text, so the card and the page agree. */
  label: string | null;
  year: string | null;
  venue: string | null;
  city: string | null;
  /** A recording already on file for this night, when there is one. */
  archiveUrl: string | null;
  /** The ranked version's id, when this night is on the ladder. */
  versionId: string | null;
  /** The issue's own line about this night, e.g. "three shows before the band's last night". */
  note: string | null;
}

/**
 * What the card tells you is waiting inside. A count plus the noun it counts.
 * The sentence it renders lives in the card, beside the definition it needs.
 */
export type SpotlightFinding =
  | { kind: "sleepers"; count: number }
  | { kind: "nights"; count: number };

export interface SongbookSpotlight {
  kind: "issue" | "community";
  slug: string;
  title: string;
  songId: string;
  issueNumber: number | null;
  /** The issue's headline. Community entries have none, and none is invented. */
  headline: string | null;
  timesPlayed: number | null;
  first: LifespanEnd;
  last: LifespanEnd;
  finding: SpotlightFinding | null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A real calendar day, or null. Rejects Feb 30 rather than rolling it into March. */
const isoFromParts = (year: number, month: number, day: number): string | null => {
  const d = new Date(Date.UTC(year, month, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month || d.getUTCDate() !== day) return null;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

/**
 * An issue's lifespan date as an ISO date.
 *
 * `song_features.ftp_date` is free text typed into the issue: "June 17, 1975",
 * "Aug 31, 1978", "Sept 5, 1980". The card prints that text untouched and
 * hands the player this. It does not read `songs.first_played` instead,
 * because for both editorial songs the two disagree (Crazy Fingers:
 * 1975-02-28 in `songs`, June 17, 1975 in the sourced issue), and the card has
 * to play the night the page it links to names.
 */
export const parseIssueDate = (text: string | null | undefined): string | null => {
  const t = (text ?? "").trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return isoFromParts(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const m = t.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
  if (month < 0) return null;
  return isoFromParts(Number(m[3]), month, Number(m[2]));
};

/** `1975-06-17` -> `June 17, 1975`, the register the issues are written in. */
export const formatNight = (iso: string | null | undefined): string | null => {
  const m = (iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return null;
  return `${MONTH_NAMES[month]} ${Number(m[3])}, ${m[1]}`;
};

const yearOf = (date: string | null, label: string | null | undefined): string | null =>
  date?.slice(0, 4) ?? (label ?? "").match(/\b(19|20)\d{2}\b/)?.[0] ?? null;

const clean = (s: string | null | undefined): string | null => s?.trim() || null;

/** The fields of a ranked version the card can use. */
export interface RankedVersion {
  id: string;
  show_date: string | null;
  votes: number | null;
  archive_org_url: string | null;
}

export const issueSpotlight = (entry: IssueEntry, versions: RankedVersion[]): SongbookSpotlight => {
  const end = (
    which: End,
    text: string | null,
    venue: string | null,
    city: string | null,
    note: string | null,
  ): LifespanEnd => {
    const date = parseIssueDate(text);
    const ranked = date ? versions.find((v) => v.show_date === date) : undefined;
    return {
      which,
      date,
      label: clean(text),
      year: yearOf(date, text),
      venue: clean(venue),
      city: clean(city),
      archiveUrl: clean(ranked?.archive_org_url),
      versionId: ranked?.id ?? null,
      note: clean(note),
    };
  };
  const i = entry.issue;
  // The same rule as the ladder's sleeper card, from the same module, so the
  // home page and the issue cannot name a different number.
  const sleeperCount = hasVoteData(versions) ? sleepers(versions).length : 0;
  return {
    kind: "issue",
    slug: entry.slug,
    title: entry.title,
    songId: entry.songId,
    issueNumber: entry.issueNumber,
    headline: clean(i.headline),
    timesPlayed: i.times_played,
    first: end("first", i.ftp_date, i.ftp_venue, i.ftp_city, null),
    last: end("last", i.ltp_date, i.ltp_venue, i.ltp_city, i.ltp_note),
    finding: sleeperCount > 0 ? { kind: "sleepers", count: sleeperCount } : null,
  };
};

export const communitySpotlight = (
  entry: CommunityEntry,
  nights: CommunityNight[],
): SongbookSpotlight => {
  const end = (which: End, raw: string | null): LifespanEnd => {
    const date = raw ? raw.slice(0, 10) : null;
    // The guide is the only place a community entry learns a venue or a tape
    // for its first and last nights, and only when it happens to include them.
    const onTape = date ? nights.find((n) => n.showDate === date && n.archiveUrl) : undefined;
    return {
      which,
      date,
      label: formatNight(date),
      year: yearOf(date, null),
      venue: venueForDate(nights, date),
      city: null,
      archiveUrl: onTape?.archiveUrl ?? null,
      versionId: null,
      note: null,
    };
  };
  // Counted the way the issue page's Play all counts them: nights that name a date.
  const dated = nights.filter((n) => n.showDate).length;
  return {
    kind: "community",
    slug: entry.slug,
    title: entry.title,
    songId: entry.songId,
    issueNumber: null,
    headline: null,
    timesPlayed: entry.timesPlayed,
    first: end("first", entry.firstPlayed),
    last: end("last", entry.lastPlayed),
    finding: dated > 0 ? { kind: "nights", count: dated } : null,
  };
};

/**
 * Which night the card offers to play: the first time they played it, or the
 * last.
 *
 * A night with a recording already on file wins, because that tape has been
 * checked to carry the song. Crazy Fingers' first night is on its ladder with
 * a verified identifier, and its last is not. Otherwise the first night, which
 * the player looks up by date. The card checks that lookup before anyone taps
 * and moves to the other end if the Archive says the night has no tape.
 */
export const preferredEnd = (s: Pick<SongbookSpotlight, "first" | "last">): End | null => {
  const ends = [s.first, s.last];
  const onFile = ends.find((e) => e.date && e.archiveUrl);
  if (onFile) return onFile.which;
  return ends.find((e) => e.date)?.which ?? null;
};

export const spotlightSlotId = (s: Pick<SongbookSpotlight, "slug">, which: End): string =>
  `hero-songbook-${s.slug}-${which}`;

/**
 * The night as something the player can start.
 *
 * `found` is a lookup already made for this night. Pass it whole: the url
 * AND the track. A slot that carries the track starts with no network hop
 * between the tap and the sound, and on a phone that hop is most of the wait.
 */
export const spotlightSlot = (
  s: Pick<SongbookSpotlight, "slug" | "songId" | "title">,
  end: LifespanEnd,
  found?: { url: string; directTrackUrl?: string | null; venue?: string | null } | null,
): PlayableSlot => {
  const id = spotlightSlotId(s, end.which);
  const track = found?.directTrackUrl ? found : null;
  return {
    id,
    song: { id: s.songId, title: s.title },
    version: {
      ...SYNTHETIC_VERSION_DEFAULTS,
      id: end.versionId ?? id,
      song_id: s.songId,
      show_date: end.date ?? "",
      venue: end.venue ?? track?.venue ?? null,
      city: end.city,
      archive_org_url: track?.url ?? end.archiveUrl,
    },
    directTrackUrl: track?.directTrackUrl ?? null,
    setNumber: 1,
    position: 0,
    segueToNext: false,
  };
};

// ── loading ─────────────────────────────────────────────────────────────────

interface FeatureRow extends IssueFields {
  slug: string;
  title: string;
  week_of: string;
  issue_number: number | null;
  song_id: string | null;
}

interface EntryRow {
  created_at: string;
  song_id: string;
  setlist_id: string;
  songs: {
    title: string;
    first_played: string | null;
    last_played: string | null;
    times_played: number | null;
  } | null;
}

/** Every song on the shelf, in no particular order. `shelfOrder` orders it. */
export const loadShelf = async (): Promise<ShelfEntry[]> => {
  const { data: features } = await songbookDb
    .from("song_features")
    .select(
      "slug, title, week_of, issue_number, song_id, headline, ftp_date, ftp_venue, ftp_city, ltp_date, ltp_venue, ltp_city, ltp_note, times_played",
    )
    .eq("published", true);

  const issues: IssueEntry[] = ((features ?? []) as FeatureRow[])
    .filter((f) => !!f.song_id)
    .map((f) => ({
      kind: "issue",
      slug: f.slug,
      title: f.title,
      songId: f.song_id as string,
      since: f.week_of,
      issueNumber: f.issue_number,
      issue: f,
    }));

  // The community tier is additive. A failure here leaves the editorial issues
  // rotating exactly as they would on their own.
  let community: CommunityEntry[] = [];
  try {
    const { data: entries } = await songbookDb
      .from("songbook_entries")
      .select("created_at, song_id, setlist_id, songs(title, first_played, last_played, times_played)");
    const rows = ((entries ?? []) as EntryRow[]).filter((r) => r.songs?.title);

    // A guide its author has since made private leaves the shelf, as it does
    // on /songbook. The issue page would refuse it, and the card must not point
    // at "No issue here yet."
    const ids = [...new Set(rows.map((r) => r.setlist_id).filter(Boolean))];
    const open = new Set<string>();
    if (ids.length) {
      const { data: visible } = await songbookDb
        .from("setlists")
        .select("id")
        .eq("is_public", true)
        .in("id", ids);
      for (const v of (visible ?? []) as { id: string }[]) open.add(v.id);
    }

    community = rows
      .filter((r) => open.has(r.setlist_id))
      .map((r) => ({
        kind: "community",
        slug: songSlug(r.songs!.title),
        title: r.songs!.title,
        songId: r.song_id,
        since: r.created_at,
        setlistId: r.setlist_id,
        firstPlayed: r.songs!.first_played,
        lastPlayed: r.songs!.last_played,
        timesPlayed: r.songs!.times_played,
      }));
  } catch (e) {
    console.error("[songbook spotlight] community shelf failed", e);
  }

  return [...issues, ...community];
};

/** The details for the one song the card carries: a query or two, not eight. */
export const loadSpotlight = async (entry: ShelfEntry): Promise<SongbookSpotlight> => {
  if (entry.kind === "issue") {
    const { data } = await songbookDb
      .from("notable_versions")
      .select("id, show_date, votes, archive_org_url")
      .eq("song_id", entry.songId);
    return issueSpotlight(entry, (data ?? []) as RankedVersion[]);
  }

  const { data: slots } = await supabase
    .from("setlist_slots")
    .select("id, position, notes")
    .eq("setlist_id", entry.setlistId)
    .order("position", { ascending: true });
  const nights = (slots ?? []).map((slot) =>
    nightFromSlot(slot.position, decodeArchiveNotes(slot.id, entry.songId, slot.notes)),
  );
  return communitySpotlight(entry, nights);
};

/** This week's card, or null when the shelf is empty or unreachable. */
export const loadWeeklySpotlight = async (now: Date = new Date()): Promise<SongbookSpotlight | null> => {
  try {
    const pick = spotlightForWeek(await loadShelf(), now);
    return pick ? await loadSpotlight(pick) : null;
  } catch (e) {
    console.error("[songbook spotlight] failed", e);
    return null;
  }
};
