import { supabase } from "@/integrations/supabase/client";
import { authRedirectTo, NATIVE_URL_SCHEME } from "@/lib/authRedirect";
import { isNativeApp } from "@/lib/nativeApp";
import { markOAuthRedirect } from "@/lib/authFunnel";
import { WebAuth } from "@/lib/webAuth";
import { establishSessionFromCallbackUrl } from "@/lib/nativeAuthSession";

/**
 * The single way this app starts a Google or Apple sign-in.
 *
 * Two surfaces call it — the /auth page and AuthModal — and they used to hold
 * their own near-identical copies of the redirect dance. That is the same
 * shape as the encodeArchiveNotes divergence banked in CLAUDE.md: two copies
 * of one protocol, both "working", quietly disagreeing. One entry point, two
 * platform branches inside it.
 *
 * Web: unchanged. `signInWithOAuth` navigates the tab away and the session is
 * picked up when the browser comes back.
 *
 * Native: the tab cannot navigate away and come back — and Google blocks
 * embedded web views outright — so the URL is requested WITHOUT redirecting
 * (`skipBrowserRedirect`), handed to ASWebAuthenticationSession, and the
 * callback it captures is turned into a session in-process. The fan never
 * leaves the app, so the caller gets a resolved session rather than a promise
 * that a redirect will eventually happen.
 */
export type OAuthProvider = "google" | "apple";

export type OAuthSignInResult =
  /** Web only: the browser is navigating away; nothing left to do here. */
  | { status: "redirecting" }
  /** Native only: the session is live on this client right now. */
  | { status: "signed-in"; next: string; userId: string | null }
  /** The fan dismissed the sheet. Not an error — say nothing. */
  | { status: "cancelled" }
  | { status: "error"; message: string };

const START_FAILED_MESSAGE = "Couldn't start sign-in. Give it another go.";

export async function signInWithProvider(
  provider: OAuthProvider,
  next: string = "/",
): Promise<OAuthSignInResult> {
  // Fires oauth_redirect_started and leaves the provider in sessionStorage,
  // which is what useAuth reads on SIGNED_IN to log oauth_returned. Native
  // completes in-process rather than via a redirect, but the funnel is the
  // same two events either way, so web and native stay comparable.
  markOAuthRedirect(provider);

  if (!isNativeApp()) {
    sessionStorage.setItem("post_oauth_redirect", "1");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authRedirectTo(next) },
    });
    if (error) return { status: "error", message: error.message };
    return { status: "redirecting" };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: authRedirectTo(next), skipBrowserRedirect: true },
  });
  if (error) return { status: "error", message: error.message };
  if (!data?.url) return { status: "error", message: START_FAILED_MESSAGE };

  let callbackUrl: string;
  try {
    const result = await WebAuth.signIn({
      url: data.url,
      callbackScheme: NATIVE_URL_SCHEME,
    });
    callbackUrl = result.url;
  } catch (e) {
    const code = (e as { code?: string } | null)?.code;
    if (code === "cancelled") return { status: "cancelled" };
    console.warn("[auth] native oauth session failed", e);
    const message = (e as { message?: string } | null)?.message;
    return { status: "error", message: message || START_FAILED_MESSAGE };
  }

  const outcome = await establishSessionFromCallbackUrl(callbackUrl);
  if (outcome.status === "signed-in") return outcome;
  if (outcome.status === "error") return { status: "error", message: outcome.message };
  // "ignored" means the provider came back with neither a code nor tokens.
  return { status: "error", message: START_FAILED_MESSAGE };
}
