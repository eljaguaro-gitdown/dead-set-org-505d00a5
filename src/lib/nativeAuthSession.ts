import { supabase } from "@/integrations/supabase/client";
import { NATIVE_URL_SCHEME } from "@/lib/authRedirect";

/**
 * Turns an `org.deadset.app://…` callback URL into a Supabase session.
 *
 * Two legs of the app arrive here and they must not drift apart:
 *   - NativeAuthCallback.tsx — links opened from OUTSIDE the app (an email
 *     confirmation or password reset tapped in Mail), routed through
 *     AppDelegate → DeepLinkPlugin.
 *   - oauthSignIn.ts — the redirect at the end of a flow the app started
 *     itself, captured by ASWebAuthenticationSession.
 *
 * Both shapes of callback are handled because the two legs can differ: the
 * Supabase client's flow type decides whether the session arrives as `?code=`
 * (PKCE) or as tokens in the fragment (implicit), and a project switched from
 * one to the other would otherwise fail silently.
 */
export type NativeAuthOutcome =
  | { status: "signed-in"; next: string; userId: string | null }
  | { status: "error"; message: string }
  | { status: "ignored" };

export const CALLBACK_FAILED_MESSAGE =
  "That sign-in link didn't work. Try requesting a new one.";

export async function establishSessionFromCallbackUrl(
  rawUrl: string,
): Promise<NativeAuthOutcome> {
  if (!rawUrl.startsWith(`${NATIVE_URL_SCHEME}://`)) return { status: "ignored" };

  // Custom schemes are not "special" URLs, so read the query and fragment off
  // the raw string rather than trusting URL() to expose them.
  const [beforeHash, hash = ""] = rawUrl.split("#");
  const query = new URLSearchParams(beforeHash.split("?")[1] ?? "");
  const fragment = new URLSearchParams(hash);

  const next = query.get("next") || "/";

  const errorDescription =
    query.get("error_description") || fragment.get("error_description");
  if (errorDescription) return { status: "error", message: errorDescription };

  const code = query.get("code");
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");

  try {
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
      return { status: "signed-in", next, userId: data.session?.user.id ?? null };
    }
    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return { status: "signed-in", next, userId: data.session?.user.id ?? null };
    }
    return { status: "ignored" }; // not an auth callback — nothing to do
  } catch (e) {
    console.warn("[auth] native callback failed", e);
    return { status: "error", message: CALLBACK_FAILED_MESSAGE };
  }
}
