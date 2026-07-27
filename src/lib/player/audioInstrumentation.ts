/**
 * Playback instrumentation for the gapless swap. `audio_track_advanced`'s
 * `gapless` prop is the wild-signal for whether transitions are actually
 * seamless for real users — a meaningful share of gapped advances in
 * production means the CORS or preload path is degrading regardless of how
 * it behaves on our own devices.
 *
 * PostHog is loaded globally (window.posthog); analytics must never break
 * playback, so every capture is wrapped.
 */

type AudioEvent =
  | "audio_play_started"
  | "audio_track_advanced"
  | "audio_segue_completed"
  | "audio_error"
  | "audio_autoplay_blocked";

type PostHogGlobal = {
  posthog?: { capture?: (event: string, props?: Record<string, unknown>) => void };
};

export function captureAudioEvent(event: AudioEvent, props: Record<string, unknown> = {}): void {
  try {
    const ph = (window as Window & PostHogGlobal).posthog;
    ph?.capture?.(event, props);
  } catch {
    /* never let analytics interfere with the tape */
  }
}

/** Pull the Internet Archive item identifier out of a /download/ track URL. */
export function archiveIdentifierFromUrl(url: string | null | undefined): string | null {
  const m = url?.match(/archive\.org\/download\/([^/?#]+)/);
  return m?.[1] ?? null;
}
