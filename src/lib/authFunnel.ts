export type AuthFunnelEvent =
  | "auth_modal_opened"
  | "auth_tab_switched"
  | "signup_email_attempted"
  | "signup_email_succeeded"
  | "signup_email_failed"
  | "signup_email_needs_confirmation"
  | "signin_email_attempted"
  | "signin_email_succeeded"
  | "signin_email_failed"
  | "oauth_redirect_started"
  | "oauth_returned"
  | "email_confirmed";

interface TrackOptions {
  provider?: "email" | "google" | "apple" | string;
  metadata?: Record<string, unknown>;
  userId?: string | null;
}

const getVisitorId = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ds_visitor_id");
};

/**
 * Build the row for an auth event. Exported for testing; the shape has to
 * match the auth_events table exactly.
 */
export const buildAuthEventRow = (
  eventName: AuthFunnelEvent,
  opts: TrackOptions = {},
) => ({
  event_name: eventName,
  visitor_id: getVisitorId() ?? undefined,
  user_id: opts.userId ?? undefined,
  provider: opts.provider ?? undefined,
  metadata: opts.metadata ?? undefined,
});

const AUTH_EVENTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/auth_events`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Posts with `keepalive`, NOT through supabase-js, and the distinction is the
 * whole point.
 *
 * `oauth_redirect_started` fires immediately before `signInWithOAuth` navigates
 * the tab away. A normal fetch is cancelled when the document goes, so that
 * event was being dropped an unknown fraction of the time — the funnel recorded
 * 42 Google redirect starts against 56 returns, which is impossible, and it
 * meant the one number that would size drop-off at the consent screen could not
 * be trusted. `keepalive` hands the request to the browser to finish after the
 * page is gone.
 *
 * RLS allows this without a session: auth_events has
 * `INSERT ... WITH CHECK (true)` for anon, so the publishable key is enough and
 * user_id travels in the body.
 */
export const trackAuthEvent = async (
  eventName: AuthFunnelEvent,
  opts: TrackOptions = {},
) => {
  try {
    await fetch(AUTH_EVENTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify([buildAuthEventRow(eventName, opts)]),
      keepalive: true,
    });
  } catch {
    // Never let analytics break UX
  }
};

const PENDING_OAUTH_KEY = "ds_pending_oauth_provider";

export const markOAuthRedirect = (provider: "google" | "apple") => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_OAUTH_KEY, provider);
  void trackAuthEvent("oauth_redirect_started", { provider });
};

export const consumePendingOAuth = (): string | null => {
  if (typeof window === "undefined") return null;
  const provider = sessionStorage.getItem(PENDING_OAUTH_KEY);
  if (provider) sessionStorage.removeItem(PENDING_OAUTH_KEY);
  return provider;
};
