import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/nativeApp";
import { NATIVE_URL_SCHEME } from "@/lib/authRedirect";
import { DeepLink } from "@/lib/deepLink";
import { toast } from "sonner";

/**
 * Completes an auth round trip that came back through the app's custom URL
 * scheme. Mount once inside the router; it is inert on the web.
 *
 * iOS hands the URL to AppDelegate, which forwards it to DeepLinkPlugin
 * (ios/App/App/DeepLinkPlugin.swift) — a small app-embedded plugin rather than
 * @capacitor/app, so this needs no new npm dependency and no lockfile change.
 *
 * The Supabase client runs the default PKCE flow, so a confirmation or reset
 * link arrives as ?code=… and is exchanged for a session here. The implicit
 * shape (tokens in the fragment) is handled too, because a project switched
 * to implicit would otherwise fail silently.
 */
const NativeAuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;
    let disposed = false;
    let remove: (() => void) | undefined;

    const handleUrl = async (rawUrl: string) => {
      if (!rawUrl.startsWith(`${NATIVE_URL_SCHEME}://`)) return;

      // Custom schemes are not "special" URLs, so read the query and fragment
      // off the raw string rather than trusting URL() to expose them.
      const [beforeHash, hash = ""] = rawUrl.split("#");
      const query = new URLSearchParams(beforeHash.split("?")[1] ?? "");
      const fragment = new URLSearchParams(hash);

      const next = query.get("next") || "/";
      const errorDescription = query.get("error_description") || fragment.get("error_description");
      if (errorDescription) {
        toast.error(errorDescription);
        navigate("/auth");
        return;
      }

      const code = query.get("code");
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          return; // not an auth callback — nothing to do
        }
      } catch (e) {
        console.warn("[auth] native callback failed", e);
        toast.error("That sign-in link didn't work. Try requesting a new one.");
        navigate("/auth");
        return;
      }

      if (disposed) return;
      navigate(next);
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
