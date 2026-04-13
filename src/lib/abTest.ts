import { supabase } from "@/integrations/supabase/client";

const TEST_NAME = "landing_vs_autostart";
const STORAGE_KEY = "ds_ab_variant";
const SESSION_KEY = "ds_ab_session_variant";

export type ABVariant = "A" | "B";

/**
 * Assigns a visitor to variant A or B (50/50).
 * Sticky per *browser session* (sessionStorage) so in-tab navigation
 * is consistent, but each new tab / window gets a fresh coin-flip.
 * The first-ever assignment is also logged to the database for analytics.
 */
export const getVariant = (): ABVariant => {
  // If we already picked for this session, keep it stable
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session === "A" || session === "B") return session;

  // New session — coin flip
  const variant: ABVariant = Math.random() < 0.5 ? "A" : "B";
  sessionStorage.setItem(SESSION_KEY, variant);

  // Log to DB only once per visitor (first ever visit)
  const alreadyLogged = localStorage.getItem(STORAGE_KEY);
  if (!alreadyLogged) {
    localStorage.setItem(STORAGE_KEY, variant);

    const visitorId = localStorage.getItem("ds_visitor_id") || crypto.randomUUID();
    if (!localStorage.getItem("ds_visitor_id")) {
      localStorage.setItem("ds_visitor_id", visitorId);
    }

    supabase
      .from("ab_test_assignments")
      .insert([{ visitor_id: visitorId, test_name: TEST_NAME, variant }])
      .then(() => {});
  }

  return variant;
};

/** Mark the current visitor as converted (signed up) */
export const markConversion = async () => {
  const visitorId = localStorage.getItem("ds_visitor_id");
  if (!visitorId) return;

  try {
    await supabase
      .from("ab_test_assignments")
      .update({ converted: true, user_id: (await supabase.auth.getUser()).data.user?.id })
      .eq("visitor_id", visitorId)
      .eq("test_name", TEST_NAME);
  } catch {
    // Silent fail
  }
};
