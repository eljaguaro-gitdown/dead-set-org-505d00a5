import { registerPlugin } from "@capacitor/core";

/**
 * JS twin of ios/App/App/WebAuthPlugin.swift.
 *
 * Opens an OAuth URL in the system browser (ASWebAuthenticationSession) and
 * resolves with the URL the provider redirected back to. Google rejects OAuth
 * inside the WKWebView, so this is the only route that works on device.
 *
 * Rejections carry a `code`: "cancelled" when the fan dismissed the sheet —
 * which is a normal outcome, not a failure to report — or "failed" /
 * "invalid_url" / "invalid_scheme" otherwise.
 */
export interface WebAuthPlugin {
  signIn(options: { url: string; callbackScheme: string }): Promise<{ url: string }>;
}

export const WebAuth = registerPlugin<WebAuthPlugin>("WebAuth");
