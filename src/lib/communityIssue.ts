import { songbookDb } from "@/lib/songbookDb";
import { supabase } from "@/integrations/supabase/client";
import { songSlug } from "@/lib/songSlug";
import { decodeArchiveNotes } from "@/hooks/useSetlist";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";
import type { PlayableSlot } from "@/contexts/AudioPlayerContext";

/**
 * A Songbook issue that the community wrote, rather than the editorial series.
 *
 * The curated issues live in `song_features` and carry hand-written prose plus
 * hand-entered venues. A community entry has neither — what it has is the
 * guide its author actually built. So this assembles the same *kind* of page
 * from what is genuinely known:
 *
 *   - the stats block from `songs` (first_played / last_played / times_played),
 *     which is the corrected data from the 2026-10-05 audit, not the import
 *   - the nights from the guide's own slots, which is this issue's body
 *   - the credit, because the point of the shelf is who got there first
 *
 * Venue and city are deliberately ABSENT. The curated issues show them because
 * someone typed them; `songs` holds only dates. Resolving a date to a venue at
 * render time means two Archive requests that can fail, and a failed resolve
 * must never be rendered as a guess — the same rule that keeps "could not ask
 * the Archive" from printing as "no tape of this night circulates". The stats
 * block already renders venue conditionally, so it degrades cleanly.
 */
export interface CommunityNight {
  position: number;
  /** The night itself, when the slot names one. */
  showDate: string | null;
  venue: string | null;
  archiveUrl: string | null;
  /** What the author said about this night, with the archive blob stripped. */
  note: string;
}

export interface CommunityIssue {
  songId: string;
  title: string;
  slug: string;
  firstPlayed: string | null;
  lastPlayed: string | null;
  /**
   * The venue of the first/last night, when the guide happens to include that
   * night. `songs` stores dates only, so this is the ONLY place a community
   * issue can learn a venue for them — see venueForDate. A curated issue
   * carries ftp_venue/ftp_city as columns, which is why its lifespan block had
   * a venue under each date and this one did not.
   */
  firstPlayedVenue: string | null;
  lastPlayedVenue: string | null;
  timesPlayed: number | null;
  /** Display name of whoever mapped it first. Never an email. */
  mappedBy: string;
  /** Who wrote it: the person a block applies to, and how the page knows its owner. */
  creatorId: string;
  setlistId: string;
  nights: CommunityNight[];
}

/**
 * Songs carry no slug column, so resolution compares derived slugs — the same
 * convention `/versions/:slug` uses, kept in one place in `songSlug`.
 */
export const matchSongBySlug = <T extends { title: string }>(
  songs: T[],
  slug: string,
): T | null => songs.find((s) => songSlug(s.title) === slug) ?? null;

/**
 * Load the community issue for a slug, or null when no song matches, the song
 * has no community entry, or the entry's guide has been made private.
 *
 * Callers must try `song_features` FIRST. A song can have both an editorial
 * issue and a community entry, and the editorial one is the issue — this is
 * only the fallback.
 */
/**
 * Charlie's note for a night usually opens by restating the night:
 *
 *   "1993-06-15 — Freedom Hall • A late-career standout that proves…"
 *
 * The card prints the date and the venue directly above it, so the reader gets
 * them twice — once as a heading, then again as the first eight words of the
 * prose. 23 of the 33 nights across the six community issues are written this
 * way, so this is the common case, not an outlier.
 *
 * Stripped ONLY when the preamble restates THIS night's own date, and only
 * when what precedes that date is a short label rather than prose — so a note
 * that genuinely opens on a different show is left alone, and "The best since
 * 1993-06-15 • …" cannot lose its first clause.
 *
 * Six of those nights are nothing BUT a restatement ("Last time played:
 * 1995-07-06 — Riverport Amphitheatre", and all three of Bird Song's). Those
 * come back empty, and the card renders no note rather than a line repeating
 * the heading above it.
 */
export const stripNightPreamble = (
  note: string | null | undefined,
  showDate: string | null | undefined,
): string => {
  const text = (note ?? "").trim();
  const date = (showDate ?? "").trim();
  if (!text || !date) return text;
  const escaped = date.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A leading segment carrying this night's date, ending at the bullet that
  // starts the prose or at the end of the note.
  const preamble = new RegExp(`^[^\u2022\n]{0,40}?${escaped}[^\u2022\n]*(?:\u2022\\s*|$)`);
  return text.replace(preamble, "").trim();
};

/**
 * One decoded slot as one night.
 *
 * Extracted from loadCommunityIssue so the decode-to-night step is testable
 * without a database behind it: the two fields it gets wrong are both silent
 * (a blank note, or a date printed twice), and neither shows up in a type.
 */
/**
 * The venue of whichever night in the guide falls on `date`.
 *
 * Same date means same show means same venue, so this is a lookup rather than
 * a guess — and it is the only venue a community issue has for its first and
 * last played, because `songs` carries `first_played`/`last_played` as bare
 * dates with no venue column. Across the six issues it fills 7 of the 12
 * slots; the rest render the date alone, which is what we actually know.
 */
export const venueForDate = (
  nights: CommunityNight[],
  date: string | null | undefined,
): string | null => {
  if (!date) return null;
  const match = nights.find((n) => n.showDate === date && n.venue?.trim());
  return match?.venue?.trim() ?? null;
};

export const nightFromSlot = (
  position: number,
  decoded: ReturnType<typeof decodeArchiveNotes>,
): CommunityNight => ({
  position,
  showDate: decoded.version?.show_date ?? null,
  venue: decoded.version?.venue ?? null,
  archiveUrl: decoded.version?.archive_org_url ?? null,
  // The note lives in `description` when the blob carries a `note` key, and
  // otherwise in the free text trailing the newline (`decoded.notes`) — which
  // is how all six community issues are actually written. Reading only the
  // first renders every night blank.
  note: stripNightPreamble(
    (decoded.version?.description ?? "").trim() || (decoded.notes ?? "").trim(),
    decoded.version?.show_date,
  ),
});

export const loadCommunityIssue = async (
  slug: string,
): Promise<CommunityIssue | null> => {
  try {
    const { data: songRows } = await supabase
      .from("songs")
      .select("id, title, first_played, last_played, times_played");
    const song = matchSongBySlug(songRows ?? [], slug);
    if (!song) return null;

    const { data: entry } = await songbookDb
      .from("songbook_entries")
      .select("setlist_id, creator_id")
      .eq("song_id", song.id)
      .maybeSingle();
    if (!entry) return null;

    // A guide the author later made private must not keep rendering as an
    // issue; the shelf only ever showed it because it was public.
    const { data: setlist } = await supabase
      .from("setlists")
      .select("id, is_public")
      .eq("id", entry.setlist_id)
      .maybeSingle();
    if (!setlist || !setlist.is_public) return null;

    const { data: slots } = await supabase
      .from("setlist_slots")
      .select("id, position, notes")
      .eq("setlist_id", entry.setlist_id)
      .order("position", { ascending: true });

    // creator_id references auth.users, not profiles, so the name comes from a
    // separate lookup by user_id — the same reason the shelf itself does two
    // queries rather than embedding `profiles(display_name)`.
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", entry.creator_id)
      .maybeSingle();

    const nights: CommunityNight[] = (slots ?? []).map((slot) =>
      nightFromSlot(slot.position, decodeArchiveNotes(slot.id, song.id, slot.notes)),
    );

    return {
      songId: song.id,
      title: song.title,
      slug,
      firstPlayed: song.first_played,
      lastPlayed: song.last_played,
      firstPlayedVenue: venueForDate(nights, song.first_played),
      lastPlayedVenue: venueForDate(nights, song.last_played),
      timesPlayed: song.times_played,
      mappedBy: profile?.display_name?.trim() || "a Deadhead",
      creatorId: entry.creator_id,
      setlistId: entry.setlist_id,
      nights,
    };
  } catch (e) {
    // The shelf is additive: a failure here must leave the editorial series
    // rendering exactly as it does today, and the page shows its not-found
    // state rather than a broken one.
    console.error("[songbook] community issue failed", e);
    return null;
  }
};

/**
 * A community issue's nights as playable slots.
 *
 * Same job `ladderPlayback` does for the era ladder, and same rule: a night
 * with no recording behind it is DROPPED, because the player can only start on
 * a slot carrying an archive_org_url and a dead slot mid-queue is a gap the
 * listener has to skip past. Every community guide today stores an archive
 * blob per night, so nothing is currently lost to this.
 */
export const communitySlot = (
  issue: Pick<CommunityIssue, "songId" | "title">,
  night: CommunityNight,
  position = 0,
): PlayableSlot => ({
  id: `songbook-${issue.songId}-${night.position}`,
  song: { id: issue.songId, title: issue.title },
  version: {
    ...SYNTHETIC_VERSION_DEFAULTS,
    id: `songbook-${issue.songId}-${night.position}`,
    song_id: issue.songId,
    show_date: night.showDate ?? "",
    venue: night.venue,
    archive_org_url: night.archiveUrl,
    description: night.note || null,
  },
  setNumber: 1,
  position,
  segueToNext: false,
});

/**
 * What the map itself shows — findings, not invention.
 *
 * A curated issue carries an editor's essay. A community issue has the
 * author's per-night notes and nothing above them, so when those notes are
 * thin the page reads as a bare list. Bird Song is the case that exposed it:
 * all three of its notes were only a restatement of their own date, so once
 * the duplicate preamble was stripped there was nothing left at all.
 *
 * This is derived from the picks, never written for them: how far apart the
 * chosen nights sit, and which rooms they start and end in. Everything here
 * is checkable against the list underneath it.
 */
export const communityFindings = (issue: CommunityIssue): string | null => {
  const dated = issue.nights
    .filter((n) => n.showDate)
    .sort((a, b) => (a.showDate ?? "").localeCompare(b.showDate ?? ""));
  if (dated.length < 2) return null;
  const first = dated[0];
  const last = dated[dated.length - 1];

  /**
   * Completed anniversaries, not days divided by an average year. Both of the
   * obvious ways are wrong in opposite directions and this is the only thing
   * that is right in both: subtracting calendar years alone called 1971-12-31
   * to 1972-01-01 "a year apart" when it is one DAY, and dividing days by
   * 365.25 called two calendar years with no leap day between them (730 days,
   * e.g. 1973-03-24 to 1975-03-24) "a year", because 730 / 365.25 is 1.998.
   * The window for that second error is only a few days wide per span, which
   * is exactly why it would have survived in the copy indefinitely.
   */
  const ymd = (d: string) => d.split("-").map(Number);
  const [fy, fm, fd] = ymd(first.showDate as string);
  const [ly, lm, ld] = ymd(last.showDate as string);
  if ([fy, fm, fd, ly, lm, ld].some((n) => !Number.isFinite(n))) return null;
  // One off the difference when the last night falls before the anniversary.
  const years = ly - fy - (lm < fm || (lm === fm && ld < fd) ? 1 : 0);

  /**
   * Rooms are compared on their first comma segment, trimmed and case-folded,
   * so "Winterland Arena" and "Winterland Arena, San Francisco, CA" are one
   * room rather than two. And only the segment is printed: a full venue string
   * with its own commas makes "A to B" unreadable.
   */
  const room = (v?: string | null) => (v ?? "").split(",")[0].trim();
  const a = room(first.venue);
  const b = room(last.venue);
  const between =
    a && b && a.toLowerCase() !== b.toLowerCase() ? `, ${a} to ${b}` : "";

  // No leading count: the sentence before this one already says how many
  // nights there are, and saying it twice reads like a stutter.
  if (years >= 2) return `${years} years between the first and the last${between}.`;
  if (years === 1) return `A year between the first and the last${between}.`;
  return `All inside one year${between}.`;
};

/** The whole guide, oldest night first — the song walking forward in time. */
export const communityPlaylist = (issue: CommunityIssue): PlayableSlot[] =>
  issue.nights
    // A night is playable when it can be RESOLVED, which a stored url is only
    // one way of being. 21 of the 33 nights across the community issues name
    // their night and carry no url — the Version Explorer's picks arrive that
    // way — and AudioPlayerContext.resolveSlot looks those up by night through
    // findRecordingForDate. Filtering on the url alone dropped every one:
    // Viola Lee Blues offered nothing at all, Eyes of the World 2 of its 7.
    .filter((n) => !!n.archiveUrl || !!n.showDate)
    .sort((a, b) => (a.showDate ?? "").localeCompare(b.showDate ?? ""))
    .map((n, i) => communitySlot(issue, n, i));

/**
 * What a shared link should say about this issue.
 *
 * The bare title told a reader nothing — a WhatsApp paste read "Dead Set — a
 * discovery tool", which is the app, not the song. This leads with what makes
 * the song worth opening: how long it ran, how often, and how many nights
 * somebody picked out of it.
 */
export const communityShareText = (issue: CommunityIssue): string => {
  const playable = issue.nights.filter((n) => n.showDate).length;
  const from = issue.firstPlayed?.slice(0, 4);
  const to = issue.lastPlayed?.slice(0, 4);
  const span =
    from && to && from !== to
      ? ` between ${from} and ${to}`
      : from
        ? ` in ${from}`
        : "";
  const count =
    issue.timesPlayed != null ? `Played ${issue.timesPlayed} times${span}.` : "";
  const picked = playable
    ? ` ${playable} ${playable === 1 ? "night" : "nights"} worth knowing, mapped by ${issue.mappedBy}.`
    : ` Mapped by ${issue.mappedBy}.`;
  return `${count}${picked}`.trim();
};
