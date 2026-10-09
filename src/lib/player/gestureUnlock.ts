/**
 * Tiny silent WAV (44 bytes), played inside the user's tap to "unlock" iOS
 * Safari audio. Without it, the async work in playSingle (waiting on the
 * Archive to resolve a track) breaks the gesture chain, and iOS refuses to
 * start the real audio afterwards.
 *
 * Lived inline in HeroSection. Moved here once a second hero control needed
 * it, so the two cannot drift apart.
 */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=";

/** Call synchronously inside a click handler, before any await. Best effort. */
export const unlockAudioInGesture = (): void => {
  try {
    const unlock = new Audio(SILENT_WAV);
    unlock.volume = 0;
    void unlock.play().catch(() => {});
  } catch {
    // best effort: no Audio constructor (tests, odd webviews) is not an error
  }
};
