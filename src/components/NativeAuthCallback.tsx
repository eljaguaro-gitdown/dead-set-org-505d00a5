import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isNativeApp } from "@/lib/nativeApp";
import { DeepLink } from "@/lib/deepLink";
import { establishSessionFromCallbackUrl } from "@/lib/nativeAuthSession";
import { toast } from "sonner";

/**
 * Completes an auth round trip that came back through the app's custom URL
 * scheme from OUTSIDE the app — an email confirmation or password-reset link
 * tapped in Mail. Mount once inside the router; it is inert on the web.
 *
 * iOS hands the URL to AppDelegate, which forwards it to DeepLinkPlugin
 * (ios/App/App/DeepLinkPlugin.swift) — a small app-embedded plugin rather than
 * @capacitor/app, so this needs no new npm dependency and no lockfile change.
 *
 * OAuth does NOT arrive here. ASWebAuthenticationSession intercepts the
 * redirect for flows the app itself started, before iOS can route it to
 * AppDelegate, so that leg returns through src/lib/oauthSignIn.ts instead.
 * Both legs share one parser — src/lib/nativeAuthSession.ts — so the two
 * cannot drift apart on what a callback URL means.
 */
const NativeAuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;
    let disposed = false;
    let remove: (() => void) | undefined;

    const handleUrl = async (rawUrl: string) => {
      const outcome = await establishSessionFromCallbackUrl(rawUrl);
      if (disposed) return;

      if (outcome.status === "ignored") return;
      if (outcome.status === "error") {
        toast.error(outcome.message);
        navigate("/auth");
        return;
      }
      navigate(outcome.next);
    };

    void (async () => {
      const listener = await DeepLink.addListener("appUrlOpen", ({ url }) => {
        void handleUrl(url);
      });
      if (disposed) {
        void listener.remove();
        return;
      }
      remove = () => void listener.remove();

      // Cold start: the app was launched BY the link, so the event already
      // fired before this listener existed. Swift buffered it; drain it now.
      try {
        const pending = await DeepLink.consumePendingUrl();
        if (!disposed && pending?.url) void handleUrl(pending.url);
      } catch (e) {
        console.warn("[auth] no pending deep link", e);
      }
    })();

    return () => {
      disposed = true;
      remove?.();
    };
  }, [navigate]);

  return null;
};

export default NativeAuthCallback;
