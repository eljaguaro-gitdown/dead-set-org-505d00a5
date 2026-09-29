import { supabase } from "@/integrations/supabase/client";
import { captureEvent } from "@/lib/posthog";

/**
 * Logs a landing-page CTA click into `share_events` so the funnel
 * dashboard can count pre-auth conversion intent.
 *
 * We piggy-back on the existing share_events table (anon insert allowed)
 * with share_type = 'cta_click' to avoid a new table + migration.
 *
 * ⚠️ THESE ROWS ARE NOT SHARES. They have outnumbered real shares roughly
 * 2:1 since this shipped (238 of 372 rows), so ANY query that counts
 * share_events as a share metric MUST exclude share_type = 'cta_click'.
 * Two consumers forgot, and reported inflated share counts for five months:
 * the weekly insights email and the admin "sharers" segment. Both now
 * filter. If you add a reader, filter — or move these rows to their own
 * table and take the migration this shortcut avoided.
 *
 * Also sent to PostHog as `landing_cta_clicked`, so the landing → builder
 * step can be read against `$pageview` and the guest-builder events with the
 * external-traffic filter (share_events has no host or internal flag). The
 * name follows the landing hero, but poster and notification CTAs route
 * through here too — segment by `page` / `cta_id`. Captured before the first
 * await: callers navigate on the same click, and posthog-js queues
 * synchronously, whereas the Supabase insert may not finish.
 */
export const trackCtaClick = async (ctaId: string, destination: string) => {
  try {
    captureEvent("landing_cta_clicked", {
      cta_id: ctaId,
      destination,
      page: window.location.pathname,
    });
  } catch {
    // Analytics must never block UX
  }
  try {
    const visitorId = localStorage.getItem("ds_visitor_id");
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("share_events").insert({
      share_type: "cta_click",
      channel: ctaId,
      visitor_id: visitorId,
      user_id: user?.id ?? null,
      metadata: { destination, page: window.location.pathname },
    });
  } catch {
    // Analytics must never block UX
  }
};
