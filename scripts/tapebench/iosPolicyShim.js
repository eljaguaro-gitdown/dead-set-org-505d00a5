/**
 * An emulation of iOS Safari's media autoplay rule, injected into every page
 * of the WebKit profile. Headless Playwright WebKit enforces no autoplay
 * policy at all (measured 2026-11-06: play() with no gesture resolves), so
 * without this the bench could never see the field's autoplay_blocked.
 *
 * The rule emulated (WebKit's MediaElementSession, as observed on iOS):
 *   - an <audio> element may start only if play() is called while the page
 *     has transient user activation, i.e. within ACTIVATION_MS of a real
 *     tap, OR the element has already been started that way once ("blessed");
 *   - a blessed element stays blessed when its src changes.
 * Everything else rejects with NotAllowedError, exactly as Safari does.
 *
 * ACTIVATION_MS is WebKit's transient-activation window. It is a model,
 * not a measurement of a real iPhone; DECISIONS.md says so, and the field
 * events (play_failed stage=gesture) are what confirm or refute it.
 */
(() => {
  const ACTIVATION_MS = 1000;
  let lastGesture = -1e9;
  for (const ev of ["pointerdown", "pointerup", "touchend", "click", "keydown"]) {
    window.addEventListener(ev, (e) => { if (e.isTrusted) lastGesture = performance.now(); }, true);
  }
  const blessed = new WeakSet();
  const nativePlay = HTMLMediaElement.prototype.play;
  window.__iosShim = { blocked: 0, blessed: 0, allowedByActivation: 0 };
  HTMLMediaElement.prototype.play = function () {
    const active = performance.now() - lastGesture <= ACTIVATION_MS;
    if (!blessed.has(this)) {
      if (!active) {
        window.__iosShim.blocked++;
        (window.__iosShim.refusals ??= []).push({ src: String(this.currentSrc || this.src || "").slice(0, 120), at: Math.round(performance.now() - lastGesture), stack: String(new Error().stack || "").split("\n").slice(1, 6).join(" | ").slice(0, 400) });
        return Promise.reject(new DOMException(
          "The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.",
          "NotAllowedError",
        ));
      }
      blessed.add(this);
      window.__iosShim.blessed++;
      window.__iosShim.allowedByActivation++;
    }
    return nativePlay.call(this);
  };
})();
