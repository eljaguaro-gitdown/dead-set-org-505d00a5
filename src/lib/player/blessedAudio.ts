/**
 * Audio elements started inside the fan's tap, for the engine to play through
 * after the tap's async work is done.
 *
 * WHY. iOS lets an <audio> element start only if play() is called on THAT
 * element during a user gesture — after which the element stays allowed,
 * whatever its src becomes. The old unlock (gestureUnlock.ts) played a silent
 * WAV on a brand-new `new Audio()` and threw it away. `gapless` then built
 * its own element for each track in `addTrack`, which runs after the Archive
 * lookup — seconds after the tap, on an element nobody had touched in it. On
 * a fast resolve the browser's ~1 s activation window sometimes still
 * covered it; on a slow one iOS refused with NotAllowedError: the field's
 * `audio_autoplay_blocked` (10 in 30 days, every one on iOS), and the
 * "Tap to start the tape" prompt after the fan had already tapped.
 *
 * HOW. `blessAudioElements()` runs synchronously in the tap: it starts a
 * silent WAV on a few fresh elements and keeps them. `withBlessedAudio(fn)`
 * makes `new Audio()` hand those elements out for the duration of `fn` — the
 * engine wraps its `queue.addTrack` calls in it, so the element `gapless`
 * builds for a track IS one that was started in the tap. When the pool runs
 * dry it falls back to an ordinary element, which is exactly the old
 * behaviour, never worse.
 *
 * The pool is refilled on every gesture. Elements are cheap; four covers the
 * current track, gapless's two preloads, and one appended track.
 */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=";

export const BLESSED_POOL_SIZE = 4;

const pool: HTMLAudioElement[] = [];
let stats = { blessed: 0, handedOut: 0, fellBack: 0 };

type AudioCtor = typeof Audio;
const nativeAudio = (): AudioCtor | null =>
  typeof window !== "undefined" && typeof window.Audio === "function" ? window.Audio : null;

/** Call synchronously inside a tap, before any await. Best effort; never throws. */
export function blessAudioElements(size = BLESSED_POOL_SIZE): void {
  const Native = nativeAudio();
  if (!Native) return;
  while (pool.length < size) {
    try {
      const el = new Native();
      el.preload = "auto";
      el.src = SILENT_WAV;
      // play() IS the blessing. Pause once it starts so a pooled element is
      // idle until the engine adopts it; a rejection (a browser that refused
      // even this) leaves an ordinary element, no worse than before.
      const p = el.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          if (pool.includes(el)) el.pause();
        }).catch(() => undefined);
      }
      pool.push(el);
      stats.blessed++;
    } catch {
      return; // no media support (tests, odd webviews): nothing to bless
    }
  }
}

/**
 * Run `fn` with `new Audio()` handing out blessed elements. Synchronous on
 * purpose: `window.Audio` is swapped only for the length of the call, so
 * nothing else on the page can take an element meant for the engine.
 */
export function withBlessedAudio<T>(fn: () => T): T {
  const Native = nativeAudio();
  if (!Native) return fn();
  function PooledAudio(this: unknown, src?: string): HTMLAudioElement {
    const el = pool.shift();
    if (!el) {
      stats.fellBack++;
      return new Native(src);
    }
    stats.handedOut++;
    // Forget the silent WAV; the caller sets its own src next. Changing src
    // keeps the element allowed to play on iOS — that is the whole point.
    el.pause();
    el.removeAttribute("src");
    el.preload = "none";
    if (src !== undefined) el.src = src;
    return el;
  }
  PooledAudio.prototype = Native.prototype;
  const w = window as unknown as { Audio: AudioCtor };
  w.Audio = PooledAudio as unknown as AudioCtor;
  try {
    return fn();
  } finally {
    w.Audio = Native;
  }
}

/** How many blessed elements are waiting. */
export const blessedPoolSize = (): number => pool.length;

/** Counters, for ?debug=audio and the bench. */
export const blessedAudioStats = () => ({ ...stats, waiting: pool.length });

/** Test seam. */
export function resetBlessedAudio(): void {
  pool.length = 0;
  stats = { blessed: 0, handedOut: 0, fellBack: 0 };
}
