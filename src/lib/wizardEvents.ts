import { supabase } from "@/integrations/supabase/client";

export type WizardEventName =
  | "wizard_opened"
  | "priority_selected"
  | "generate_clicked";

export type WizardMode = "build" | "improve" | "explore";

interface TrackWizardEventOptions {
  mode?: WizardMode | null;
  priorityId?: string;
  vibeIds?: string[];
  metadata?: Record<string, unknown>;
}

const getVisitorId = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ds_visitor_id");
};

/**
 * Fire-and-forget Cosmic Charlie wizard telemetry.
 * Writes to wizard_events (see migration 20260814020000). Silent-fail so a
 * dropped beacon never blocks the UI. Mirrors trackAuthEvent / trackShare.
 */
export const trackWizardEvent = async (
  eventName: WizardEventName,
  opts: TrackWizardEventOptions = {},
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("wizard_events").insert([{
      event_name: eventName,
      mode: opts.mode ?? null,
      priority_id: opts.priorityId ?? null,
      vibe_ids: opts.vibeIds ?? null,
      visitor_id: getVisitorId(),
      user_id: user?.id ?? null,
      metadata: (opts.metadata ?? null) as never,
    }]);
  } catch {
    // Never let analytics break UX
  }
};
