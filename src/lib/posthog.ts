import posthog from "posthog-js";

const projectToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

export const isPostHogConfigured = Boolean(projectToken && apiHost);
export const posthogClient = posthog;

export const initializePostHog = () => {
  if (!projectToken) {
    if (import.meta.env.DEV) {
      // Warn, do not throw. This runs before render, so throwing takes the
      // whole app down for anyone without VITE_PUBLIC_POSTHOG_PROJECT_TOKEN
      // set — a new contributor, or a preview build where the variable was
      // never added. Analytics must never be the reason the app will not start.
      console.warn(
        "VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is not configured — PostHog events will not be sent.",
      );
    }
    return;
  }

  if (!apiHost) {
    if (import.meta.env.DEV) {
      // Warn, do not throw. This runs before render, so throwing takes the
      // whole app down for anyone without VITE_PUBLIC_POSTHOG_HOST
      // set — a new contributor, or a preview build where the variable was
      // never added. Analytics must never be the reason the app will not start.
      console.warn(
        "VITE_PUBLIC_POSTHOG_HOST is not configured — PostHog events will not be sent.",
      );
    }
    return;
  }

  posthog.init(projectToken, {
    api_host: apiHost,
    defaults: "2026-01-30",
    capture_pageview: "history_change",
    // Both of these are ON in the "2026-01-30" defaults bundle, and neither is
    // covered by what the privacy policy tells people. It says "Analytics
    // cookies: help us understand how visitors use our site" — recording a
    // fan's screen is a materially bigger claim than that sentence supports,
    // and Capacitor ships these same assets inside the iOS app, where
    // PrivacyInfo.xcprivacy does not declare ProductInteraction either.
    //
    // Set explicitly rather than left to the bundle: a dated defaults string
    // can start enabling something new without this file changing.
    disable_session_recording: true,
    autocapture: false,
    // Also on by default, and also not "events the code explicitly captures":
    // dead-click and heatmap capture read the DOM around a click, and surveys
    // can render PostHog's own UI to fans — uncontrolled copy on a product with
    // a fixed voice.
    capture_dead_clicks: false,
    capture_heatmaps: false,
    disable_surveys: true,
    // Exception capture is deliberately LEFT ON: it reports errors, not
    // behaviour, it is what the active Error tracking signal source watches,
    // and PrivacyInfo.xcprivacy already declares CrashData. Flip it off here if
    // that trade stops being worth it.
  });

  Object.assign(window, { posthog });
};

export const captureEvent = (event: string, properties?: Record<string, unknown>) => {
  if (isPostHogConfigured) posthog.capture(event, properties);
};

export const captureException = (error: unknown, properties?: Record<string, unknown>) => {
  if (isPostHogConfigured) posthog.captureException(error, properties);
};

export const identifyUser = (
  userId: string,
  properties?: Record<string, string | null | undefined>,
) => {
  if (isPostHogConfigured) posthog.identify(userId, properties);
};

export const resetPostHog = () => {
  if (isPostHogConfigured) posthog.reset();
};

export const getPostHogCorrelationHeaders = (): Record<string, string> => {
  if (!isPostHogConfigured) return {};

  const sessionId = posthog.get_session_id();
  return {
    "X-POSTHOG-DISTINCT-ID": posthog.get_distinct_id(),
    ...(sessionId ? { "X-POSTHOG-SESSION-ID": sessionId } : {}),
  };
};
