// Client-side helpers for the DJ Cosmic Charlie & Cherise intro feature.
// See docs/features/dj-cosmic-charlie.md and
// supabase/functions/generate-dj-intro/index.ts.

import { supabase } from "@/integrations/supabase/client";

export type DjSpeaker = "charlie" | "cherise" | "both";

export interface DjIntroLine {
  speaker: DjSpeaker;
  url: string;
  path: string;
  duration_ms: number;
}

export interface DjIntro {
  lines: DjIntroLine[];
  signoffUrl: string;
  durationMs: number;
  cached: boolean;
}

/**
 * Fetch (or generate on-demand) the DJ intro for a setlist. Returns null
 * whenever the intro is unavailable — edge function down, setlist not
 * ready (fewer than 3 songs or no description/era), OPENAI_API_KEY not
 * configured, transient error, anything. Caller's contract: on null,
 * play the setlist directly without an intro. Never surfaces an error
 * to the user; the feature is always additive and always optional.
 */
export async function fetchDjIntro(setlistId: string): Promise<DjIntro | null> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-dj-intro", {
      body: { setlistId },
    });
    if (error) {
      console.warn("[djIntro] edge function error:", error.message);
      return null;
    }
    // The edge function returns { intro: null, reason: "..." } when the
    // setlist is not ready for an intro. Treat as "no intro" silently.
    if (!data || !data.intro) return null;
    const intro = data.intro as DjIntro;
    if (!Array.isArray(intro.lines) || intro.lines.length === 0) return null;
    return intro;
  } catch (err) {
    console.warn("[djIntro] fetch failed:", err);
    return null;
  }
}

/**
 * Feature flag for the DJ intro. Currently gated on the URL query param
 * `?djintro=1` (also accepts `on` and `true`). Default off during Phase 3
 * rollout so no user experiences the intro until we're ready. When we
 * open it up more broadly, we'll gate on a user preference in profiles.
 */
export function isDjIntroEnabled(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const val = params.get("djintro");
  return val === "1" || val === "on" || val === "true";
}
