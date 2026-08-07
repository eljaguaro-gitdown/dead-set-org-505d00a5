/**
 * True when running inside the Capacitor native shell (the iOS/Android app).
 *
 * The native runtime injects `window.Capacitor` into the WKWebView before any
 * app code runs, so this needs no imports and is safe to call from web-only
 * builds where the global simply doesn't exist.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}
