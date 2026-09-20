import { isNativeApp } from "@/lib/nativeApp";

/**
 * Where Supabase should send the user back to after an email confirmation,
 * a password reset, or an OAuth round trip.
 *
 * On the web this is just the site origin. Inside the Capacitor shell,
 * `window.location.origin` is `capacitor://localhost` — a scheme Supabase
 * will not accept as a redirect target and iOS had no handler for, so every
 * confirmation and reset link fell through to the project's Site URL and
 * opened the website in Safari while the app stayed signed out.
 *
 * Every native auth route now ends here: email confirmation and password
 * reset come back through DeepLinkPlugin, and OAuth comes back through
 * ASWebAuthenticationSession (src/lib/oauthSignIn.ts). Both hand the URL to
 * the same parser, src/lib/nativeAuthSession.ts.
 *
 * Both of these must agree with this scheme:
 *   - ios/App/App/Info.plist          → CFBundleURLTypes
 *   - Supabase → Authentication → URL Configuration → Redirect URLs
 */
export const NATIVE_URL_SCHEME = "org.deadset.app";
export const NATIVE_AUTH_CALLBACK = `${NATIVE_URL_SCHEME}://auth-callback`;

/**
 * @param next in-app path to land on once the session is established.
 */
export function authRedirectTo(next: string = "/"): string {
  const path = next.startsWith("/") ? next : `/${next}`;

  if (isNativeApp()) {
    return path === "/"
      ? NATIVE_AUTH_CALLBACK
      : `${NATIVE_AUTH_CALLBACK}?next=${encodeURIComponent(path)}`;
  }

  if (typeof window === "undefined") return path;
  return path === "/" ? window.location.origin : `${window.location.origin}${path}`;
}
