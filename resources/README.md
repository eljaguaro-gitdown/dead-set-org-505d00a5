# App Icon & Splash Resources

This folder is the source of truth for the Dead Set iOS/Android app icon and splash screen.

## Files

- `icon.png` — **1024×1024** master app icon (Apple App Store requirement). Edge-to-edge, no transparency, no rounded corners (Apple/Android apply masks automatically).
- `splash.png` — **1920×1920** master splash. Skull centered with generous negative space so it survives any aspect-ratio crop.

## Regenerating the full Capacitor asset set

After editing `icon.png` or `splash.png`, run this from your Mac (where the native iOS/Android projects live):

```bash
# one-time install
npm i -D @capacitor/assets

# regenerate every icon + splash for ios/android
npx capacitor-assets generate --iconBackgroundColor '#08080c' \
                              --iconBackgroundColorDark '#08080c' \
                              --splashBackgroundColor '#08080c' \
                              --splashBackgroundColorDark '#08080c'

# sync into the native projects
npx cap sync
```

This will populate:
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/` (all required sizes incl. 1024)
- `ios/App/App/Assets.xcassets/Splash.imageset/`
- `android/app/src/main/res/mipmap-*/` (all densities)
- `android/app/src/main/res/drawable*/splash.png`

## PWA / web icons

These live in `public/` and are checked in:
- `public/icons/icon-192.png`, `icon-512.png` — referenced by `manifest.json`
- `public/apple-touch-icon.png` — 180×180, used by iOS Safari home screen
- `public/favicon-32.png`, `public/favicon-16.png` — browser favicons

Regenerate them from the master with:

```bash
npm run icons:web
```
