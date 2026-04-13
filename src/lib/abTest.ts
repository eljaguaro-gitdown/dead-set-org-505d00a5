import { supabase } from "@/integrations/supabase/client";

const TEST_NAME = "landing_vs_autostart";
const STORAGE_KEY = "ds_ab_variant";

export type ABVariant = "A" | "B";

/**
 * Deterministically assigns a visitor to variant A or B (50/50).
 * Assignment is persisted in localStorage so it's stable across sessions.
 * Logged to ab_test_assignments for analysis.
 */
export const getVariant = (): ABVariant => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "A" || stored === "B") return stored;

  // New visitor — coin flip
  const variant: ABVariant = Math.random() < 0.5 ? "A" : "B";
  localStorage.setItem(STORAGE_KEY, variant);

  // Log assignment (fire-and-forget)
  const visitorId = localStorage.getItem("ds_visitor_id") || crypto.randomUUID();
  if (!localStorage.getItem("ds_visitor_id")) {
    localStorage.setItem("ds_visitor_id", visitorId);
  }

  supabase
    .from("ab_test_assignments")
    .insert([{
      visitor_id: visitorId,
      test_name: TEST_NAME,
      variant,
    }])
    .then(() => {});

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
