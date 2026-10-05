# Pre-promo QA — run on the phone, signed out first

Ordered by what costs you users, not by what is easiest to check.
Everything here is a live item the gate could not observe: the sandbox
reaches neither dead-set.org nor Supabase.

Budget: ~10 minutes. Stop and tell me if any STOP item fails.

---

## 0. Confirm what is serving — 30 seconds
Open `/admin`. The sync badge prints the deployed sha.
Expect `b155499` (or `7770e8d`; the difference is test files only).
If it shows `13bc7a4`, the publish did not land and nothing below is valid.

## 1. STOP ITEM — the fix itself
Signed in, create a **brand new** Shakedown listening guide. Do not reuse an
older one: guides saved before tonight carry no night and will behave the old
way regardless.

Open it, press **Play All**.
- Expect: each night plays **its own tape**, matching the date on its card.
- Expect: a night with no circulating tape reports empty and the queue
  **moves on to the next one**.
- Fail: the same tape under several cards, or the queue stopping dead on
  one row. Either means the fix did not reach you — stop and tell me.

## 2. STOP ITEM — the signed-out front door
In a **private tab**, open `/versions/shakedown-street`.
- The song, the play count and the year span are visible without scrolling
  past the fold on a phone.
- "First time played" and "Last time played" both show a date and venue.
- Press play on one night: **audio starts without signing in.**
- Fail: a sign-in wall before any audio. That kills the funnel at step one.

## 3. The sign-in round trip
From that page press **Keep** (or Share), then sign in with Google.
- Expect: you land back on the song you were reading, not on the home page
  or the builder.
- This path was broken before and was fixed with a stored return target.
  It is the single highest-value thing to confirm, because every new visitor
  this post sends will walk it.

## 4. The shared link
Share the guide, then open the link in a private tab, signed out.
- The guide renders with its nights.
- The Internet Archive credit is visible without hunting for it.

## 5. Layout at phone width
On the picker and the guide: no sideways scroll, nothing clipped, the
hamburger reachable. Check signed in as well as signed out — the signed-in
header is the tighter one.

## 6. What the screenshots must match
Shoot only after 1–5 pass. A screenshot of a broken state is worse than no
post, because it is the first thing a new visitor compares reality against.

---

## Known and accepted before posting
- `/versions/:slug` carries no Archive credit line (landing and Songbook do).
  Slide 5 of the carousel covers it; the page does not.
- The 1991-09-10 Althea pick names a night the band did not play the song.
  It now reports empty instead of playing the wrong show. Nothing yet checks
  a pick against what was actually performed.
- The repo disagrees with itself on Shakedown's play count (163 vs 165).
  Read the number off the screen.
