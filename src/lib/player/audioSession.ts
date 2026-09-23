/**
 * Tell Safari this page plays music, so the ring/silent switch doesn't mute it.
 *
 * iOS Safari puts a page into the "ambient" audio session as soon as it has a
 * Web Audio AudioContext, and ambient audio obeys the silent switch — for
 * every element on the page, including the plain <audio> the player uses on
 * iOS. The `gapless` library creates that context on every play and every
 * track fetch, even with `webAudioIsDisabled`, so on a phone set to silent
 * the tape "played" with the clock running and no sound. Found 2026-09-23
 * on the web player; flipping the switch off made it audible.
 *
 * `navigator.audioSession` (Safari 17+) is the supported fix: "playback" is
 * the session music apps use, which plays through the silent switch. Older
 * Safari has no API for this. The native app is unaffected — its
 * AVAudioSession is already .playback.
 */

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

export function preferPlaybackAudioSession(): void {
  try {
    const session = (navigator as AudioSessionNavigator).audioSession;
    if (session && session.type !== "playback") session.type = "playback";
  } catch {
    /* never let this block the tape */
  }
}
