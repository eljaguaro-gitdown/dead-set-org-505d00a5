import { isNativeApp } from "@/lib/nativeApp";

/**
 * Detects in-app browsers (Instagram, Facebook, Messages, Gmail, etc.)
 * where third-party cookies don't persist — breaking OAuth state verification.
 */
export function detectInAppBrowser(): { isInApp: boolean; appName: string | null } {
  if (typeof navigator === "undefined") return { isInApp: false, appName: null };
  // The Capacitor shell is a WKWebView too (iPhone UA, no "Safari" token),
  // but it's our own app, not a hostile embed — never flag it.
  if (isNativeApp()) return { isInApp: false, appName: null };
  const ua = navigator.userAgent || "";

  const matchers: Array<[RegExp, string]> = [
    [/FBA[NV]/i, "Facebook"],
    [/Instagram/i, "Instagram"],
    [/Messenger/i, "Messenger"],
    [/Line\//i, "LINE"],
    [/Twitter/i, "X (Twitter)"],
    [/TikTok/i, "TikTok"],
    [/Snapchat/i, "Snapchat"],
    [/LinkedInApp/i, "LinkedIn"],
    [/GSA\//i, "Google App"],
    [/GmailApp/i, "Gmail"],
    [/Pinterest/i, "Pinterest"],
    [/WhatsApp/i, "WhatsApp"],
    [/Slack/i, "Slack"],
    [/Discord/i, "Discord"],
    // Generic iOS in-app webview: WebKit + Mobile but no Safari/CriOS/FxiOS
    [/iPhone|iPod|iPad/i, "iOS in-app browser"],
  ];

  for (const [regex, name] of matchers) {
    if (regex.test(ua)) {
      // Special case: iOS generic check — only flag if Safari is missing
      if (name === "iOS in-app browser") {
        const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
        if (isSafari) continue;
        // Also skip if it's clearly Chrome/Firefox/Edge for iOS (those handle OAuth fine)
        if (/CriOS|FxiOS|EdgiOS/i.test(ua)) continue;
        return { isInApp: true, appName: name };
      }
      return { isInApp: true, appName: name };
    }
  }

  return { isInApp: false, appName: null };
}
