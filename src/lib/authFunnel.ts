import { supabase } from "@/integrations/supabase/client";

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

export const trackAuthEvent = async (
  eventName: AuthFunnelEvent,
  opts: TrackOptions = {},
) => {
  try {
    await supabase.from("auth_events").insert([
      {
        event_name: eventName,
        visitor_id: getVisitorId() ?? undefined,
        user_id: opts.userId ?? undefined,
        provider: opts.provider ?? undefined,
        metadata: (opts.metadata ?? undefined) as never,
      },
    ]);
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
