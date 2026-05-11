# QA: Android PWA Link Capture

Verify that tapping a `dead-set.org/setlist/:id` link from another app
opens the installed Dead Set PWA instead of a browser tab.

## Scope

- **Platform**: Android 12+ with Chrome 96+ (Edge / Samsung Internet behave similarly)
- **iOS**: Not supported by the OS — links from Messages/Mail always open Safari. Skip iOS for this checklist.
- **Manifest fields under test** (`public/manifest.json`):
  - `"scope": "/"`
  - `"id": "/"`
  - `"handle_links": "preferred"`
  - `"capture_links": "existing-client-navigate"`
  - `"launch_handler": { "client_mode": "navigate-existing" }`

## Pre-flight

1. Device is on a **production build** of `https://dead-set.org` (link capture does NOT work on preview/lovableproject.com hosts).
2. Uninstall any prior Dead Set PWA, then **reinstall fresh** — manifest fields are pinned at install time.
3. Open Chrome → `dead-set.org` → menu → **Install app**. Confirm the icon appears on the home screen.
4. Open Android **Settings → Apps → Dead Set → Open by default** and confirm:
   - "Open supported links" is **enabled**
   - `dead-set.org` is listed under supported links
   - If a one-time prompt appears the first time you tap a link, choose **"Dead Set"** (not "Chrome").

## Test matrix

For each row, send/receive a real link to a real setlist (e.g. `https://dead-set.org/setlist/2d1896b5-b405-435b-891e-14037c5c4bf5`), tap it, and record the result.

| # | Source app          | Expected behavior                                              | Pass? |
|---|---------------------|----------------------------------------------------------------|-------|
| 1 | Google Messages SMS | Opens installed PWA, navigates to the setlist                  |       |
| 2 | Gmail               | Opens installed PWA                                            |       |
| 3 | WhatsApp            | Usually opens in WhatsApp's in-app browser — tap "⋮ → Open in external browser" → confirm it then routes to PWA |       |
| 4 | Signal              | Opens installed PWA (Signal respects system default)           |       |
| 5 | Slack (mobile)      | In-app browser by default; "Open in browser" → PWA             |       |
| 6 | Discord (mobile)    | In-app browser by default; "Open in browser" → PWA             |       |
| 7 | Instagram DM        | Always in-app webview — **expected fail**, document only       |       |
| 8 | Facebook Messenger  | Always in-app webview — **expected fail**, document only       |       |
| 9 | Chrome address bar  | Same-origin navigation stays in Chrome (by design)             |       |
| 10| QR code via Camera  | Opens installed PWA                                            |       |

## Behavior verification (when PWA opens)

For each pass above, confirm:

- [ ] App opens in **standalone mode** (no Chrome URL bar visible)
- [ ] URL deep-links correctly to `/setlist/:id` (correct title, poster, songs)
- [ ] Existing PWA window is **reused**, not duplicated (`launch_handler: navigate-existing`)
- [ ] Audio player and auth session are intact after navigation
- [ ] Back gesture returns to the previous in-app screen, not to Chrome

## Negative checks

- [ ] Uninstall the PWA → tapping the same link opens Chrome (default fallback)
- [ ] On a device where the user denied "Open supported links" → opens Chrome
- [ ] On iOS Safari/Messages → opens Safari (documented limitation)

## Reporting

If a row fails unexpectedly, capture:
- Android version + Chrome version
- `chrome://flags` deviations (if any)
- Screen recording of the tap → result
- Output of `adb shell dumpsys package domain-preferred-apps | grep -A2 dead-set`

File issues with the `pwa-link-capture` label.
