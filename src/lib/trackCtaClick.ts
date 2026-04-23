import { supabase } from "@/integrations/supabase/client";

/**
 * Logs a landing-page CTA click into `share_events` so the funnel
 * dashboard can count pre-auth conversion intent.
 *
 * We piggy-back on the existing share_events table (anon insert allowed)
 * with share_type = 'cta_click' to avoid a new table + migration.
 */
export const trackCtaClick = async (ctaId: string, destination: string) => {
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
