import { encodeArchiveNotes } from "@/hooks/useSetlist";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";
import type { Database } from "@/integrations/supabase/types";
import {
  MILESTONE_LABEL,
  milestoneNote,
  type MilestoneEntry,
} from "@/lib/firstLastPlayed";

type Song = Database["public"]["Tables"]["songs"]["Row"];

/**
 * Turning a Version Explorer result into the slots of a saved listening guide.
 *
 * A saved guide used to keep only prose: every slot went in with no version
 * and no archive metadata, so the player fell back to whatever tape the song
 * resolved to by default. The "Ramble On Rose — Listening Guide" saved on
 * 2026-10-03 had six slots, none of them bound, and its first card described a
 * 1971 debut while playing a 1989 Charlotte tape. The prose and the music were
 * describing different nights.
 *
 * So each slot now carries the archive blob that binds its own recording, in
 * the one format encodeArchiveNotes owns.
 */

export interface GuideVersion {
  showDate: string;
  venue: string | null;
  archiveUrl: string | null;
  rating: number | null;
  whyThisVersion: string;
}

export interface GuideSong {
  songId: string;
  title: string;
  matched: boolean;
  segueToNext: boolean;
  notes: string;
  position: number;
}

/**
 * Notes for one guide slot: the archive blob that binds the recording, then
 * the prose beneath it. Builds the slot shape encodeArchiveNotes reads instead
 * of writing a second copy of that JSON — two encoders of this blob is the
 * divergence the single-source test exists to prevent.
 *
 * The blob is written whenever we know the NIGHT, with or without a tape URL.
 * It used to be written only when an archive URL came with the pick, and the
 * URL is optional in the Version Explorer's result — so for any song with no
 * catalog versions (232 of 234 of them) every slot saved as bare prose. The
 * date the card printed lived only inside that prose string, the player had
 * nothing structured to resolve, and it fell back to a by-title search for the
 * whole song. That is how the Althea guide saved on 2026-10-04 came back
 * "couldn't find audio" on every row while all four nights sat on the Archive.
 * Storing the night unbound lets the player resolve that night on demand.
 */
export const guideNotes = (
  showDate: string,
  venue: string | null,
  archiveUrl: string | null,
  rating: number | null,
  prose: string,
): string => {
  // Nothing to bind without a night — prose is all there is to keep.
  if (!showDate) return prose;
  return encodeArchiveNotes({
    id: `guide-${showDate}`,
    song: {} as Song,
    version: {
      ...SYNTHETIC_VERSION_DEFAULTS,
      id: `archive-guide-${showDate}`,
      song_id: "",
      show_date: showDate,
      venue,
      archive_org_url: archiveUrl,
      rating,
    },
    setNumber: 1,
    position: 0,
    segueToNext: false,
    notes: prose,
  });
};

/** A standalone first/last-played night as a guide slot — tape or no tape. */
const milestoneGuideSong = (m: MilestoneEntry, songId: string, songTitle: string): GuideSong => ({
  songId,
  title: songTitle,
  matched: true,
  segueToNext: false,
  notes: guideNotes(m.date, m.venue, m.archiveUrl, null, milestoneNote(m)),
  position: 0,
});

/**
 * The guide's slots, in reading order: the night the song was born opens it,
 * Charlie's picks run through the middle, the night it was retired closes it.
 * A milestone Charlie already picked stays where he put it and is labelled
 * there rather than printed twice.
 */
export const buildGuideSongs = (
  songId: string,
  songTitle: string,
  versions: GuideVersion[],
  milestones: MilestoneEntry[],
): GuideSong[] => {
  const standalone = milestones.filter((m) => m.listIndex === null);
  const ftp = standalone.find((m) => m.kind === "ftp");
  const ltp = standalone.find((m) => m.kind === "ltp");
  const labelFor = (i: number) => milestones.find((m) => m.listIndex === i) || null;

  const middle = versions.map((v, i) => {
    const m = labelFor(i);
    const prose = [
      m ? MILESTONE_LABEL[m.kind] : null,
      `${v.showDate} — ${v.venue || "Unknown Venue"}`,
      v.whyThisVersion || null,
    ]
      .filter(Boolean)
      .join(" • ");
    return {
      songId,
      title: songTitle,
      matched: true,
      segueToNext: false,
      notes: guideNotes(v.showDate, v.venue, v.archiveUrl, v.rating, prose),
      position: 0,
    };
  });

  return [
    ...(ftp ? [milestoneGuideSong(ftp, songId, songTitle)] : []),
    ...middle,
    ...(ltp ? [milestoneGuideSong(ltp, songId, songTitle)] : []),
  ].map((song, i) => ({ ...song, position: i + 1 }));
};
