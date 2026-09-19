import type { PlayableSlot } from "@/contexts/AudioPlayerContext";
import type { LadderVersion } from "@/components/SongEraLadder";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";

/**
 * Turning era-ladder rows into playable slots.
 *
 * `LadderVersion` is a narrowed SELECT over `notable_versions` — it carries the
 * columns the ladder draws and nothing else — so a slot's `version` has to be
 * completed from SYNTHETIC_VERSION_DEFAULTS before the player will take it.
 * Both ladder surfaces (/song/:id and /songbook/:slug) build slots here rather
 * than each spelling the columns out inline, which is how the single-version
 * tap and the sleepers playlist stay the same object.
 */

interface LadderSong {
  id: string;
  title: string;
}

/** One ladder row as a playable slot. `position` orders it inside a playlist. */
export const ladderSlot = (
  song: LadderSong,
  v: LadderVersion,
  position = 0,
): PlayableSlot => ({
  id: `ladder-${song.id}-${v.id}`,
  song: { id: song.id, title: song.title },
  version: {
    ...SYNTHETIC_VERSION_DEFAULTS,
    id: v.id,
    song_id: song.id,
    show_date: v.show_date ?? "",
    venue: v.venue,
    city: v.city,
    era_id: v.era_id,
    archive_org_url: v.archive_org_url,
    blurb: v.blurb,
    is_benchmark: v.is_benchmark,
    source_url: v.source_url,
    vote_source: v.vote_source,
    votes: v.votes,
  },
  setNumber: 1,
  position,
  segueToNext: false,
});

/**
 * A run of ladder rows as one playlist, played oldest first — the same song
 * walking forward through the years, which is the point of the ladder.
 * Versions with no recording behind them are dropped: the player can only
 * start on a slot that carries an archive_org_url, and a dead slot mid-queue
 * is a gap the listener has to skip past.
 */
export const ladderPlaylist = (
  song: LadderSong,
  versions: LadderVersion[],
): PlayableSlot[] =>
  versions
    .filter((v) => !!v.archive_org_url)
    .sort((a, b) => (a.show_date ?? "").localeCompare(b.show_date ?? ""))
    .map((v, i) => ladderSlot(song, v, i));
