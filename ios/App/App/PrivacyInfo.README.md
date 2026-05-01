# PrivacyInfo.xcprivacy — Dead Set iOS

This file is the App Store **Privacy Manifest** Apple now requires on every submission. It must be added to the Xcode app target so it ships inside the `.app` bundle at the root.

## One-time Xcode setup (do this once after `npx cap add ios`)

1. Open `ios/App/App.xcworkspace` in Xcode.
2. In the Project Navigator, right-click the **App** group → **Add Files to "App"…**
3. Select `ios/App/App/PrivacyInfo.xcprivacy`.
4. ✅ Check **Copy items if needed** is OFF (file is already in place).
5. ✅ Make sure **Target Membership = App** is checked.
6. Confirm it appears under **Build Phases → Copy Bundle Resources**.

Build & archive — Xcode will validate the manifest automatically. If you see "Missing privacy manifest" warnings during App Store upload, it means a third-party SDK you added needs its OWN `PrivacyInfo.xcprivacy`. Update that pod, don't edit ours.

## What this manifest declares

| Category | Linked? | Tracking? | Purpose |
|---|---|---|---|
| Email Address | ✅ | ❌ | Auth, app functionality |
| Name / Handle | ✅ | ❌ | App functionality |
| User ID | ✅ | ❌ | Auth, app functionality |
| Photos (avatars) | ✅ | ❌ | App functionality |
| Other User Content (setlists, chat, DMs) | ✅ | ❌ | App functionality |
| Customer Support (Backstage feedback) | ✅ | ❌ | App functionality |
| Product Interaction (plays, favorites, upvotes) | ✅ | ❌ | App functionality, analytics |
| Crash Data | ❌ | ❌ | App functionality |
| Performance Data | ❌ | ❌ | Analytics |

`NSPrivacyTracking = false` — we do NOT track users across other companies' apps or websites. Google AdSense is **web-only** and is never loaded inside the iOS WebView.

## Required-Reason APIs declared

| API category | Reason code | Why |
|---|---|---|
| UserDefaults | `CA92.1` | Access info accessible only to this app |
| File Timestamp | `C617.1` | Inside-process file access (WKWebView) |
| System Boot Time | `35F9.1` | Measure time between in-app events |
| Disk Space | `E174.1` | Display free space to the user / write-failure handling |

## Keep these THREE in sync

1. This file (`PrivacyInfo.xcprivacy`)
2. The user-facing privacy policy: `src/pages/PrivacyPolicy.tsx`
3. The **App Privacy** questionnaire in App Store Connect

If you add geolocation, push notifications, IDFA / `App Tracking Transparency`, or any third-party analytics SDK, update all three.
