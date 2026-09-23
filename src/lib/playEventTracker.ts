import { supabase } from "@/integrations/supabase/client";

/**
 * Tracks per-song listening events for analytics.
 * One "session" = a contiguous listen of a single song. Pause/resume DOES NOT
 * create a new event — only a new song does. The event is updated on end.
 */

type EndedReason = "finished" | "skipped" | "paused" | "navigated_away" | "error";

export interface PlayEventStartInput {
  setlistId?: string | null;
  slotId?: string | null;
  songId?: string | null;
  archiveUrl?: string | null;
  songTitle?: string | null;
  showDate?: string | null;
  venue?: string | null;
}

interface ActiveEvent {
  id: string;
  startedAt: number;             // ms epoch
  accumulatedMs: number;         // listened time before current run
  runStartedAt: number | null;   // ms epoch when current play run began (null = paused)
  trackDurationMs: number | null;
  songTitle: string | null;
}

let active: ActiveEvent | null = null;

// Starts are serialized through this chain. startPlayEvent does async work
// (auth lookup, then insert) between checking `active` and setting it, so two
// starts firing in the same tick both saw active === null, both inserted, and
// the first row was orphaned at ended_reason='in_progress' forever — 19 such
// rows in production, including two inserted 7ms apart. Chaining means the
// second start waits for the first to own `active`, then finalizes it as
// skipped through the normal path.
let startChain: Promise<void> = Promise.resolve();

const getVisitorId = (): string | null => {
  try { return localStorage.getItem("ds_visitor_id"); } catch { return null; }
};

const currentListenedMs = (e: ActiveEvent, nowMs: number): number => {
  const live = e.runStartedAt ? Math.max(0, nowMs - e.runStartedAt) : 0;
  return e.accumulatedMs + live;
};

const isCompleted = (listenedMs: number, trackDurationMs: number | null): boolean => {
  if (!trackDurationMs || trackDurationMs <= 0) return false;
  return listenedMs / trackDurationMs >= 0.9;
};

/** Begin tracking a new song. Auto-finalizes any prior event as "skipped". */
export const startPlayEvent = async (input: PlayEventStartInput): Promise<void> => {
  const run = async (): Promise<void> => {
  if (active) {
    await finalizeActive("skipped");
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const visitorId = getVisitorId();
    const userId = user?.id ?? null;

    // Anonymous events require a visitor_id; signed-in events require user_id.
    if (!userId && !visitorId) return;

    const { data, error } = await supabase
      .from("play_events")
      .insert({
        user_id: userId,
        visitor_id: userId ? null : visitorId,
        setlist_id: input.setlistId ?? null,
        slot_id: input.slotId ?? null,
        song_id: input.songId ?? null,
        archive_url: input.archiveUrl ?? null,
        song_title: input.songTitle ?? null,
        show_date: input.showDate ?? null,
        venue: input.venue ?? null,
        ended_reason: "in_progress",
      })
      .select("id")
      .single();

    if (error || !data) return;

    active = {
      id: data.id,
      startedAt: Date.now(),
      accumulatedMs: 0,
      runStartedAt: Date.now(),
      trackDurationMs: null,
      songTitle: input.songTitle ?? null,
    };
  } catch {
    // Analytics never blocks UX
  }
  };

  startChain = startChain.then(run, run);
  return startChain;
};

/** Pause accounting (audio paused mid-track). */
export const pausePlayEvent = (): void => {
  if (!active || !active.runStartedAt) return;
  active.accumulatedMs = currentListenedMs(active, Date.now());
  active.runStartedAt = null;
};

/** Resume accounting (audio resumed from a pause). */
export const resumePlayEvent = (): void => {
  if (!active || active.runStartedAt) return;
  active.runStartedAt = Date.now();
};

/** Set or update the track's total duration so we can compute completion. */
export const setPlayEventTrackDuration = (trackDurationMs: number): void => {
  if (!active || !Number.isFinite(trackDurationMs) || trackDurationMs <= 0) return;
  active.trackDurationMs = Math.round(trackDurationMs);
};

/**
 * Finalize the active event with the given reason.
 *
 * Queued behind any start still in flight. A track that fails in the first
 * few milliseconds calls this before its own row has been inserted; unqueued,
 * it found `active` empty and did nothing, and the next start then closed the
 * row as "skipped". That is how 13 load errors on 2026-09-23 were logged as
 * 13 skips.
 */
export const finalizePlayEvent = (reason: EndedReason): Promise<void> => {
  const run = () => finalizeActive(reason);
  startChain = startChain.then(run, run);
  return startChain;
};

/** Close out whatever is active right now. Not queued — callers are. */
const finalizeActive = async (reason: EndedReason): Promise<void> => {
  const e = active;
  if (!e) return;
  active = null;

  const nowMs = Date.now();
  const listenedMs = currentListenedMs(e, nowMs);
  const completed = isCompleted(listenedMs, e.trackDurationMs);

  try {
    await supabase
      .from("play_events")
      .update({
        ended_at: new Date(nowMs).toISOString(),
        duration_played_ms: Math.round(listenedMs),
        track_duration_ms: e.trackDurationMs,
        completed,
        ended_reason: reason,
      })
      .eq("id", e.id);
  } catch {
    // Analytics never blocks UX
  }
};

// Best-effort flush when the tab is closed / hidden.
if (typeof window !== "undefined") {
  const flushOnExit = () => {
    if (active) {
      // Fire-and-forget; browsers may cut us off.
      void finalizeActive("navigated_away");
    }
  };
  window.addEventListener("pagehide", flushOnExit);
  window.addEventListener("beforeunload", flushOnExit);
  // NOTE: deliberately no visibilitychange handler here.
  //
  // There used to be one that called pausePlayEvent() when the tab went
  // hidden. Hiding the tab does not stop the tape — background audio is the
  // whole point of the Media Session work — and nothing called
  // resumePlayEvent() on the way back, because the audio element never
  // emitted a pause/play pair. So backgrounding once froze runStartedAt at
  // null and the listen clock stayed dead for the rest of the track.
  //
  // That is what produced 92 rows with ended_reason='finished' whose
  // duration_played_ms averaged 33% of the wall-clock time the row was open
  // (567s open against a 438s average track — the song really did play out).
  // Real pauses already arrive through the audio element's pause event,
  // togglePlay, the Media Session handlers and the gapless engine's
  // onPlayStateChanged. Tab visibility is not a playback signal.
}
