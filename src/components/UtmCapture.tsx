import { useEffect } from "react";
import { useLocation, useParams, matchPath } from "react-router-dom";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const STORAGE_KEY = "ds_utm_session";

/**
 * Captures UTM params on first page load (and on any subsequent navigation
 * that arrives with utm_* in the query) and registers them as PostHog
 * super-properties so every event in the session is attributable.
 *
 * Also fires a one-shot `dispatch_link_landed` event when an inbound link
 * carries utm_source=dispatch (or any utm_* params from email).
 *
 * Pure tracking — no UI, no URL rewriting.
 */
export default function UtmCapture() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(location.search);
    const incoming: Record<string, string> = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) incoming[k] = v;
    }

    // Restore any prior session UTMs so super-properties survive SPA nav.
    let session: Record<string, string> = {};
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) session = JSON.parse(raw) || {};
    } catch {
      /* ignore */
    }

    const hasIncoming = Object.keys(incoming).length > 0;
    if (hasIncoming) {
      session = { ...session, ...incoming };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } catch {
        /* ignore */
      }
    }

    const ph = (window as any).posthog;
    if (ph && Object.keys(session).length > 0) {
      try {
        ph.register?.(session);
      } catch {
        /* ignore */
      }
    }

    // Fire dispatch_link_landed exactly once per session per landing.
    if (hasIncoming && ph) {
      const landedKey = "ds_dispatch_landed_fired";
      const alreadyFired = (() => {
        try {
          return sessionStorage.getItem(landedKey) === "1";
        } catch {
          return false;
        }
      })();

      if (!alreadyFired) {
        const setlistMatch = matchPath(
          { path: "/setlist/:id" },
          location.pathname,
        );
        const setlistId = setlistMatch?.params?.id;

        try {
          ph.capture?.("dispatch_link_landed", {
            utm_source: incoming.utm_source ?? null,
            utm_medium: incoming.utm_medium ?? null,
            utm_campaign: incoming.utm_campaign ?? null,
            utm_content: incoming.utm_content ?? null,
            utm_term: incoming.utm_term ?? null,
            landing_path: location.pathname,
            ...(setlistId ? { setlist_id: setlistId } : {}),
          });
          sessionStorage.setItem(landedKey, "1");
        } catch {
          /* ignore */
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  return null;
}
