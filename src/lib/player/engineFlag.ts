/**
 * Playback engine selection — the rollback lever for the gapless swap.
 *
 * `player_engine` in localStorage picks the engine; default is 'gapless'.
 * Rollback for a full release cycle: `localStorage.setItem('player_engine', 'legacy')`.
 * The legacy path (remount-per-track <AudioPlayer>) stays intact and switchable
 * until the segue tests have held up in production for a week.
 */

export type PlayerEngine = "gapless" | "legacy";

export const PLAYER_ENGINE_STORAGE_KEY = "player_engine";

export function getPlayerEngineFlag(): PlayerEngine {
  try {
    const stored = window.localStorage.getItem(PLAYER_ENGINE_STORAGE_KEY);
    if (stored === "legacy" || stored === "gapless") return stored;
  } catch {
    /* SSR / storage unavailable */
  }
  return "gapless";
}

/** Web Audio is required for HYBRID playback; without it (old browsers, jsdom) we stay on legacy. */
export function isGaplessSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  return !!(window.AudioContext ?? w.webkitAudioContext);
}

/** The engine actually in effect: the flag, downgraded to legacy when unsupported. */
export function resolvePlayerEngine(): PlayerEngine {
  return getPlayerEngineFlag() === "gapless" && isGaplessSupported() ? "gapless" : "legacy";
}
