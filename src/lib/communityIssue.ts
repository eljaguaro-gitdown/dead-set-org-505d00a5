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
  timesPlayed: number | null;
  /** Display name of whoever mapped it first. Never an email. */
  mappedBy: string;
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

    const nights: CommunityNight[] = (slots ?? []).map((slot) => {
      const decoded = decodeArchiveNotes(slot.id, song.id, slot.notes);
      return {
        position: slot.position,
        showDate: decoded.version?.show_date ?? null,
        venue: decoded.version?.venue ?? null,
        archiveUrl: decoded.version?.archive_org_url ?? null,
        // The author's note about THIS tape lives in `description` — the
        // decoder lifts it out of the archive blob. `decoded.notes` is only
        // whatever free text trails the blob after the newline, which is
        // usually empty. Reading the wrong one renders every night blank.
        note: (decoded.version?.description ?? "").trim() || (decoded.notes ?? "").trim(),
      };
    });

    return {
      songId: song.id,
      title: song.title,
      slug,
      firstPlayed: song.first_played,
      lastPlayed: song.last_played,
      timesPlayed: song.times_played,
      mappedBy: profile?.display_name?.trim() || "a Deadhead",
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

/** The whole guide, oldest night first — the song walking forward in time. */
export const communityPlaylist = (issue: CommunityIssue): PlayableSlot[] =>
  issue.nights
    .filter((n) => !!n.archiveUrl)
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
