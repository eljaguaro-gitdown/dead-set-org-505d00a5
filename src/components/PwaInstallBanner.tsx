import { useState, useEffect, useCallback } from "react";
import { X, Share, Plus, MoreVertical, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const PwaInstallBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    // Only show on mobile, not in standalone mode, not in iframe
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isStandalone || isInIframe || !isMobile) return;

    // Check if dismissed recently (7 days)
    const dismissed = localStorage.getItem("pwa-banner-dismissed");
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    // Detect platform
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      setPlatform("ios");
    } else if (/Android/i.test(navigator.userAgent)) {
      setPlatform("android");
    }

    // Listen for Chrome/Edge install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Show banner after a short delay so it doesn't flash immediately
    const timer = setTimeout(() => setShowBanner(true), 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    localStorage.setItem("pwa-banner-dismissed", String(Date.now()));
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-500 safe-area-bottom">
      <div className="mx-3 mb-3 rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <img
              src="/icons/icon-192.png"
              alt="Dead Set icon"
              width={44}
              height={44}
              className="rounded-xl"
            />
            <div>
              <h3 className="font-bold text-foreground text-sm leading-tight">
                Add Dead Set to Home Screen
              </h3>
              <p className="text-muted-foreground text-xs mt-0.5">
                Quick access, app-like experience
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-full hover:bg-muted/60 text-muted-foreground transition-colors"
            aria-label="Dismiss install banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions or Install button */}
        <div className="px-4 pb-4 pt-1">
          {deferredPrompt ? (
            /* Chrome/Edge — native prompt available */
            <button
              onClick={handleInstall}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              Install App
            </button>
          ) : platform === "ios" ? (
            /* Safari on iOS */
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                Tap <Share className="w-3.5 h-3.5 text-accent inline" />
              </span>
              <span className="text-border">→</span>
              <span className="flex items-center gap-1">
                then <span className="font-medium text-foreground">"Add to Home Screen"</span>
                <Plus className="w-3.5 h-3.5 text-accent inline" />
              </span>
            </div>
          ) : (
            /* Android Chrome fallback (no beforeinstallprompt fired) */
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                Tap <MoreVertical className="w-3.5 h-3.5 text-accent inline" />
              </span>
              <span className="text-border">→</span>
              <span className="flex items-center gap-1">
                <span className="font-medium text-foreground">"Add to Home Screen"</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PwaInstallBanner;
