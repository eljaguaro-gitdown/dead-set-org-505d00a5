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
  if (active) {
    await finalizePlayEvent("skipped");
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

/** Finalize the active event with the given reason. */
export const finalizePlayEvent = async (reason: EndedReason): Promise<void> => {
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
      void finalizePlayEvent("navigated_away");
    }
  };
  window.addEventListener("pagehide", flushOnExit);
  window.addEventListener("beforeunload", flushOnExit);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && active) {
      // Persist accumulated time but keep the row open in case they return.
      pausePlayEvent();
    }
  });
}
