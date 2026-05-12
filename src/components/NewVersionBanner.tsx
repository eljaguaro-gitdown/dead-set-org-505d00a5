import { useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Detects new deploys by polling /index.html and comparing the hashed
// /assets/index-*.js bundle filename. When it changes, prompts logged-in
// users to refresh. Silently noops in dev (no hashed bundles).
const POLL_INTERVAL_MS = 60_000;
const DISMISS_KEY = "ds_new_version_dismissed_for";

const extractBundleId = (html: string): string | null => {
  // Match the first hashed JS asset reference (Vite output).
  const m = html.match(/\/assets\/[A-Za-z0-9._-]+\.js/);
  return m ? m[0] : null;
};

const NewVersionBanner = () => {
  const { user } = useAuth();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialBundleRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    // Skip in dev — Vite serves unhashed module URLs.
    if (import.meta.env.DEV) return;

    let cancelled = false;
    let timer: number | undefined;

    const check = async () => {
      try {
        const res = await fetch(`/index.html?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const html = await res.text();
        const bundle = extractBundleId(html);
        if (!bundle) return;

        if (initialBundleRef.current === null) {
          initialBundleRef.current = bundle;
          return;
        }
        if (bundle !== initialBundleRef.current && !cancelled) {
          // Respect a dismissal for this specific build.
          try {
            if (localStorage.getItem(DISMISS_KEY) === bundle) return;
          } catch {
            // ignore
          }
          setUpdateAvailable(true);
        }
      } catch {
        // network blip — try again next tick
      }
    };

    // First call seeds the baseline; subsequent calls compare.
    check();
    timer = window.setInterval(check, POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user]);

  if (!updateAvailable) return null;

  const handleRefresh = () => {
    // Hard reload to drop the old bundle and any stale module cache.
    window.location.reload();
  };

  const handleDismiss = () => {
    try {
      if (initialBundleRef.current) {
        // Remember the new bundle id so we don't re-prompt for the same build.
        // We compare against the *new* bundle, not the original baseline.
        // Re-fetch once to capture it.
        fetch(`/index.html?t=${Date.now()}`, { cache: "no-store" })
          .then((r) => r.text())
          .then((html) => {
            const bundle = extractBundleId(html);
            if (bundle) localStorage.setItem(DISMISS_KEY, bundle);
          })
          .catch(() => {});
      }
    } catch {
      // ignore
    }
    setUpdateAvailable(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] max-w-[calc(100vw-2rem)] sm:max-w-md"
    >
      <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-card/95 backdrop-blur-md px-4 py-3 shadow-[0_0_32px_rgba(201,168,76,0.15)]">
        <div className="font-mono text-[10px] tracking-[0.25em] text-primary uppercase shrink-0">
          New build
        </div>
        <p className="font-body text-sm text-foreground flex-1 min-w-0">
          A fresh version of Dead-Set is live. Refresh to grab the latest.
        </p>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-primary px-3 py-1.5 font-mono text-[11px] tracking-[0.2em] uppercase text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default NewVersionBanner;
