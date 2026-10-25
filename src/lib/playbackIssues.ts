/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";
import type { PlayableSlot } from "@/contexts/AudioPlayerContext";

/**
 * "Oops — that one won't play." The client half of
 * supabase/migrations/20261025020000_playback_issues.sql.
 *
 * Same typing escape hatch as src/lib/webReleases.ts: types.ts is generated
 * from the live database and does not know these functions until it is
 * regenerated. Once it does, drop the cast and call `supabase.rpc` directly.
 */
// Looked up per call, not bound at import: a module that throws on load takes
// down every page that imports it, over an analytics-grade side path.
const rpc = (fn: string, args?: Record<string, unknown>): PromiseLike<{ data: any; error: any }> =>
  (supabase as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: any; error: any }>;
  }).rpc(fn, args);

declare const __BUILD_SHA__: string;

/**
 * Failures a fix can address. Network failures ("couldn't reach the Archive",
 * a stall, the resolve watchdog) are deliberately absent: a retry fixes those,
 * so promising to say when they are "fixed" would be a promise about nothing.
 */
export type PlaybackIssueKind = "not_on_tape" | "no_tape" | "wont_play" | "none_in_setlist";

export interface PlaybackFailure {
  kind: PlaybackIssueKind;
  songId: string | null;
  songTitle: string;
  showDate: string | null;
  archiveUrl?: string | null;
  trackUrl?: string | null;
  setlistId?: string | null;
  /** The slot the failure belongs to, so the bar can step aside for the card. */
  slotId?: string | null;
}

export interface KnownGoodTape {
  songId: string;
  songTitle: string;
  showDate: string | null;
  archiveUrl: string | null;
  trackUrl: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/** Slots built from Archive search carry made-up ids; the database wants a real one or nothing. */
export const asUuid = (id: string | null | undefined): string | null => (id && UUID.test(id) ? id : null);

/** "1979-08-04" (or "1979-08-04T…") → "1979-08-04"; anything else → null. */
export const asIsoDate = (raw: string | null | undefined): string | null => {
  const m = raw?.match(ISO_DATE);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/** The same rule the database enforces, checked before we ever hand a url to the player. */
export const isArchiveTrackUrl = (url: string | null | undefined): url is string =>
  !!url && url.length <= 500 && /^https:\/\/archive\.org\/download\/[A-Za-z0-9._-]+\/[^?#\s]+$/.test(url);

/**
 * Taper shorthand: "1979-08-04" → "8/4/79". String surgery on purpose —
 * new Date("YYYY-MM-DD") parses as UTC and shifts a day in Pacific time.
 */
export const shortShowDate = (raw: string | null | undefined): string | null => {
  const m = raw?.match(ISO_DATE);
  return m ? `${Number(m[2])}/${Number(m[3])}/${m[1].slice(2)}` : null;
};

/** What the card says about THIS failure. Pure, so the voice is testable. */
export const oopsCopy = (f: Pick<PlaybackFailure, "kind" | "songTitle" | "showDate">) => {
  const date = shortShowDate(f.showDate);
  switch (f.kind) {
    case "not_on_tape":
      return {
        headline: `Oops. ${f.songTitle} won't play.`,
        detail: date
          ? `We pulled the ${date} tape and couldn't find it on there.`
          : "We pulled the tape and couldn't find it on there.",
      };
    case "no_tape":
      return {
        headline: `Oops. ${f.songTitle} won't play.`,
        detail: date ? `We couldn't turn up a tape of ${date}.` : "We couldn't turn up a tape of it.",
      };
    case "wont_play":
      return {
        headline: `Oops. ${f.songTitle} won't play.`,
        detail: "The tape's on the Archive, but it won't spin for us.",
      };
    case "none_in_setlist":
      return {
        headline: "Oops. None of these would spin.",
        detail: "We couldn't turn up a tape for any of them.",
      };
  }
};

export const NOTED_LINE = "We're on it, and thanks to you this community project gets a little better. It's been noted.";
export const SIGNED_IN_PROMISE = "We'll let you know as soon as it's fixed.";
export const SIGNED_OUT_PROMISE = "Sign in and we'll let you know as soon as it's fixed.";

const buildSha = () => (typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "unknown");

/**
 * File the failure. Resolves with the issue id, or null if it could not be
 * filed — and then the card must NOT say "it's been noted".
 */
export async function reportPlaybackIssue(f: PlaybackFailure, notify = true): Promise<string | null> {
  try {
    const { data, error } = await rpc("report_playback_issue", {
      p_kind: f.kind,
      p_song_id: asUuid(f.songId),
      p_song_title: f.songTitle.slice(0, 200),
      p_show_date: asIsoDate(f.showDate),
      p_archive_url: f.archiveUrl ?? null,
      p_track_url: f.trackUrl ?? null,
      p_setlist_id: asUuid(f.setlistId),
      p_build_sha: buildSha(),
      p_notify: notify,
    });
    if (error || typeof data !== "string") return null;
    return data;
  } catch {
    return null;
  }
}

export async function setPlaybackCredit(issueId: string, credit: boolean): Promise<boolean> {
  try {
    const { data, error } = await rpc("set_playback_credit", { p_issue_id: issueId, p_credit: credit });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function followPlaybackIssue(issueId: string): Promise<boolean> {
  try {
    const { data, error } = await rpc("follow_playback_issue", { p_issue_id: issueId });
    return !error && data === true;
  } catch {
    return false;
  }
}

// ── Tapes we know play ───────────────────────────────────────────────────

/**
 * Tracks that played for THIS visitor, newest first. The database is the main
 * source; this covers the gap before anyone else has played anything since a
 * deploy, and it is as "known" as anything gets — it played here minutes ago.
 */
const playedHere: KnownGoodTape[] = [];

/** How much real audio counts as "it plays". */
export const PLAYS_OK_AFTER_SECONDS = 20;

/** Called by the player once a track has really played. Fire-and-forget. */
export function recordTapeOk(slot: PlayableSlot): void {
  const trackUrl = slot.directTrackUrl;
  if (!isArchiveTrackUrl(trackUrl)) return;
  const songId = asUuid(slot.song.id);
  const tape: KnownGoodTape = {
    songId: slot.song.id,
    songTitle: slot.song.title,
    showDate: asIsoDate(slot.version?.show_date),
    archiveUrl: slot.version?.archive_org_url ?? null,
    trackUrl,
  };
  const at = playedHere.findIndex((t) => t.trackUrl === trackUrl);
  if (at >= 0) playedHere.splice(at, 1);
  playedHere.unshift(tape);
  playedHere.length = Math.min(playedHere.length, 10);
  if (!songId) return;
  // try as well as catch: a synchronous throw would escape .catch, and an
  // unhandled rejection fails the whole vitest run (CLAUDE.md).
  try {
    void Promise.resolve(
      rpc("record_tape_ok", {
        p_song_id: songId,
        p_show_date: tape.showDate,
        p_archive_url: tape.archiveUrl,
        p_track_url: trackUrl,
      }),
    ).catch(() => undefined);
  } catch {
    // A missed "it played" costs one suggestion; never a crash.
  }
}

/** Test seam: forget this visitor's plays. */
export function resetPlayedHere(): void {
  playedHere.length = 0;
}

const sameNight = (t: KnownGoodTape, f: Pick<PlaybackFailure, "songId" | "showDate">) =>
  t.songId === f.songId && t.showDate === asIsoDate(f.showDate);

/**
 * One tape to offer instead of the one that failed: the same song on another
 * night if one is known to play, otherwise a recently heard tape of anything.
 * Null when we do not KNOW of one — the card then offers nothing rather than
 * a guess dressed up as a promise.
 */
export async function fetchKnownGoodTape(
  f: Pick<PlaybackFailure, "songId" | "showDate" | "trackUrl">,
): Promise<KnownGoodTape | null> {
  try {
    const { data, error } = await rpc("suggest_known_good_tape", {
      p_song_id: asUuid(f.songId),
      p_exclude_date: asIsoDate(f.showDate),
      p_exclude_track: f.trackUrl ?? null,
    });
    const row = !error && Array.isArray(data) ? data[0] : null;
    if (row && isArchiveTrackUrl(row.track_url) && row.song_id && row.song_title) {
      return {
        songId: row.song_id,
        songTitle: row.song_title,
        showDate: asIsoDate(row.show_date),
        archiveUrl: row.archive_url ?? null,
        trackUrl: row.track_url,
      };
    }
  } catch {
    // fall through to what played here
  }
  return playedHere.find((t) => !sameNight(t, f) && t.trackUrl !== f.trackUrl) ?? null;
}

/** "https://archive.org/download/<id>/<file>" → "https://archive.org/details/<id>". */
export const detailsUrlFromTrack = (trackUrl: string): string | null => {
  const m = trackUrl.match(/^https:\/\/archive\.org\/download\/([A-Za-z0-9._-]+)\//);
  return m ? `https://archive.org/details/${m[1]}` : null;
};

/**
 * A known-good tape as a slot the player can start with no Archive lookup at
 * all. The recording url is REQUIRED for that, not decoration: playSingle
 * treats a slot with no archive_org_url as "resolve this night", and the
 * resolver can pick another tape or fail — so the one track we know plays
 * would be thrown away for a guess. Seen in a browser: the offered tape
 * re-raised the very card that offered it. Derived from the track when the
 * database had no recording url to give.
 */
export function knownGoodToSlot(t: KnownGoodTape): PlayableSlot {
  return {
    id: `known-good-${t.trackUrl}`,
    song: { id: t.songId, title: t.songTitle },
    version: {
      ...SYNTHETIC_VERSION_DEFAULTS,
      id: `known-good-${t.trackUrl}`,
      song_id: t.songId,
      show_date: t.showDate ?? "",
      archive_org_url: t.archiveUrl ?? detailsUrlFromTrack(t.trackUrl),
    },
    setNumber: 1,
    position: 0,
    segueToNext: false,
    directTrackUrl: t.trackUrl,
  };
}

// ── "We'll let you know": the fixed side ────────────────────────────────

export interface FixedTape {
  issueId: string;
  songId: string | null;
  songTitle: string;
  showDate: string | null;
  creditOk: boolean;
}

export async function fetchMyFixedTapes(): Promise<FixedTape[]> {
  try {
    const { data, error } = await rpc("my_fixed_tapes");
    if (error || !Array.isArray(data)) return [];
    return data.map((r: any) => ({
      issueId: r.issue_id,
      songId: r.song_id ?? null,
      songTitle: r.song_title,
      showDate: asIsoDate(r.show_date),
      creditOk: !!r.credit_ok,
    }));
  } catch {
    return [];
  }
}

export async function markFixedTapeSeen(issueId: string): Promise<void> {
  try {
    await rpc("mark_fixed_tape_seen", { p_issue_id: issueId });
  } catch {
    // The notice comes back next visit; that is the right failure.
  }
}

export interface CommunityFix {
  issueId: string;
  songTitle: string;
  showDate: string | null;
  verifiedAt: string;
  credited: string[];
}

export async function fetchCommunityFixes(limit = 20): Promise<CommunityFix[]> {
  try {
    const { data, error } = await rpc("community_fixes", { p_limit: limit });
    if (error || !Array.isArray(data)) return [];
    return data
      .map((r: any) => ({
        issueId: r.issue_id,
        songTitle: r.song_title,
        showDate: asIsoDate(r.show_date),
        verifiedAt: r.verified_at,
        credited: Array.isArray(r.credited) ? r.credited.filter(Boolean) : [],
      }))
      .filter((f: CommunityFix) => f.credited.length > 0);
  } catch {
    return [];
  }
}

// ── Signed out at the moment it broke ───────────────────────────────────

const PENDING_KEY = "dead_set_pending_playback_follows";

/** Remember an issue a signed-out fan wants to hear about, for after sign-in. */
export function rememberPendingFollow(issueId: string): void {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
    if (!list.includes(issueId)) list.push(issueId);
    localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-10)));
  } catch {
    // Storage blocked: they can still flag it again once signed in.
  }
}

/** Attach every remembered issue to the now-signed-in fan, then forget them. */
export async function claimPendingFollows(): Promise<number> {
  let list: string[] = [];
  try {
    list = JSON.parse(localStorage.getItem(PENDING_KEY) || "[]");
  } catch {
    return 0;
  }
  if (!Array.isArray(list) || list.length === 0) return 0;
  let claimed = 0;
  for (const id of list) {
    if (typeof id === "string" && (await followPlaybackIssue(id))) claimed++;
  }
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // ignore
  }
  return claimed;
}
