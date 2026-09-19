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
