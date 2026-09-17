import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/**
 * JS twin of ios/App/App/DeepLinkPlugin.swift.
 *
 * Delivers custom-scheme URLs (org.deadset.app://…) into the web layer. Today
 * that is only the auth round trip — see src/lib/authRedirect.ts.
 *
 * `consumePendingUrl` exists because a cold start is opened BY the link: iOS
 * hands AppDelegate the URL before the web layer can be listening, so the
 * event would fire into nothing. The Swift side buffers it and this drains it
 * once, on mount. Draining twice is safe — the second call returns null.
 */
export interface DeepLinkPlugin {
  consumePendingUrl(): Promise<{ url: string | null }>;
  addListener(
    eventName: "appUrlOpen",
    listener: (data: { url: string }) => void,
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const DeepLink = registerPlugin<DeepLinkPlugin>("DeepLink");
