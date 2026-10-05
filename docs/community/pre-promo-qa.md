# Pre-promo QA — run on the phone

Rewritten 2026-10-05 after the night's releases. Live build is `6b2b9ce`.

Everything here is a **live** item. The sandbox cannot reach dead-set.org
(403 CONNECT) or Supabase, so none of it can be checked from the repo — but
all of it has been verified in CI, in a browser against a mocked build, or
by curl against the Archive. What is left is the part only a real phone on
real data can answer.

Budget ~12 minutes. Stop and report if a **STOP** item fails.

---

## 0 · What is serving — 20 seconds
`/admin` → the sync badge should read **`6b2b9ce`**.
Anything older and nothing below is valid; hard-refresh and look again.

---

## 1 · STOP — a fresh listening guide plays
Build a **new** guide (Ripple or Shakedown). Not an old one: guides saved
before tonight still carry invented tape links in their rows, and though the
player now heals them at play time, you would be testing the wrong thing.

Open it and press **Play All**.

- Rows do **not** say "no tape". If they do, the badge is still overruling
  the player and I want to know immediately.
- The tap is acknowledged — Charlie and a turning reel appear **below** the
  header, and the header itself does **not** move or grow.
- Press Play All again while it is cueing: nothing should restart. The
  second tap used to throw away the work in flight.
- Each night plays **its own tape**. Row 1 plays Ripple, not Dark Star.
- A night with genuinely no tape skips or shows the banner — **never**
  another song.

With `?debug=audio` on the URL you should see `hasDirect:true` and **no**
`findTrackInRecording` line. That is the fix working.

## 2 · STOP — a stranger can hear something
**Private tab, signed out**, open `/versions/shakedown-street`.

- The song, play count and year span are visible without scrolling.
- Press play on a night: **audio starts with no sign-in wall.**
- A sign-in wall here kills the funnel at step one.

## 3 · The sign-in sheet
From that page press **Keep**, and look at the sheet before signing in.

- The **close X is visible** (it was invisible until tonight — 1.13:1).
- The copy is readable; nothing is cream-on-cream.
- Sign in with Google → you land back **on the song you were reading**,
  not the home page or the builder.

Every visitor this post brings walks this path.

## 4 · The shared link
Share the guide, open it in a private tab signed out.
- It renders with its nights.
- The Internet Archive credit is visible without hunting.

## 5 · The Songbook
`/songbook`
- Masthead reads clearly (Sancreek now, not blackletter).
- Issues show **Vol. 1 / Vol. 2** with their dates.
- Back issues carry headline, dek and the first/last/times-played rule.

## 6 · Layout at phone width
Picker, guide and Songbook: no sideways scroll, nothing clipped, hamburger
reachable. Check signed in as well — that header is the tighter one.

## 7 · The link you will actually post
Tap the bio link itself and confirm it survives the redirect with its tags:
`https://dead-set.org/?ref=instagram-bio&utm_source=instagram&utm_medium=social&utm_content=link_in_bio`

---

## Verified already — do not re-check
- Header height identical idle vs cueing at 320/375/390/414/430, guest and
  owner; Share stays on screen; focus stays on the button through a cue.
- Close X 1.13:1 → 5.22:1; sign-in sheet's 15 text nodes all ≥ 4.62:1.
- Songbook card contrast: Vol chip 5.32:1, date 7.17:1, dek 4.91:1,
  headline 4.87:1, masthead 11.54:1.
- Ripple is on both gd70-08-18 and gd71-04-29 (curl against the Archive).

## Known and accepted before posting
- `/versions/:slug` carries no Archive credit line; the landing page and
  Songbook do. Slide 5 of the carousel covers it — do not imply the page
  does.
- A night that genuinely has no tape now looks playable until you press it,
  then reports honestly. The badge lost that true negative on purpose; the
  real fix is teaching the precompute job to resolve by night.
- `version_picker_viewed` fires 10–13s in, so fast bouncers miss the
  denominator. Count `/versions/*` pageviews instead when reading the 18th.
- The legacy rollback player still has the wrong-song mode on a single tap.
- Shakedown's play count differs between two places in the repo — read `[N]`
  off the screen.
