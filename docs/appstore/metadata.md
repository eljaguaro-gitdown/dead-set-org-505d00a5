# App Store listing — Dead Set: Wake Now Discover

Paste-ready metadata for App Store Connect. Voice per dead-set-field-guide.md
(no "AI", community is the hero, Archive/tapers credit unburied).

## App Information

- **Name:** Dead Set: Wake Now Discover
- **Subtitle** (30 chars max): `Build the Dead show you crave`
- **Category:** Music (primary); Entertainment (secondary)
- **Bundle ID:** org.deadset.app
- **Price:** Free
- **Copyright:** © 2026 Dead Set. Recordings stream from the Internet Archive's Live Music Archive.
- **Support URL:** https://dead-set.org/about
- **Marketing URL:** https://dead-set.org
- **Privacy Policy URL:** https://dead-set.org/privacy

## Promotional Text (170 chars, editable without review)

```
Every setlist is a reconstructed night — the Althea from Boston '93 next to the one from Red Rocks '82. Built by Deadheads, streamed from tapes that never stopped circulating.
```

## Description

```
Every Deadhead knows the feeling. That song. That night. That version you'll
never forget — and the next one waiting to be found.

Dead Set is a setlist workshop for Grateful Dead fans. Build the show you
always wished you'd seen: pull the Scarlet from one night, the Fire from
another, and press play — every track streams from live recordings that
circulate on the Internet Archive's Live Music Archive, kept alive for
decades by tapers and tape traders.

WHAT YOU CAN DO
• Build setlists song by song — Set I, Set II, Encore, with segues
• Choose the exact night: browse versions by date, venue, and era
• Press play and let the whole set roll — through your pocket, your commute,
  your lock screen
• Wander setlists other Deadheads built, and leave your take
• Keep your favorites — songs, versions, whole nights

THE FINE PRINT WE'RE PROUD OF
Dead Set is free, carries no ads, and sells nothing. The Grateful Dead
allowed taping and trading of their live shows for decades, and those
recordings circulate on the Internet Archive — we simply give you a new way
to listen and to find each other through the music. Deep respect to the
tapers, the traders, and the Archive itself.

The music never stopped. Come dig with us.

Wake. Now. Discover.

Dead Set is an independent fan project. It is not affiliated with, endorsed
by, or sponsored by the Grateful Dead, Grateful Dead Productions, Rhino
Entertainment, or Warner Music Group. All trademarks are the property of
their respective owners.
```

## Keywords (100 chars max, comma-separated)

```
grateful dead,setlist,jerry garcia,live music,tapes,concert,archive,jam,taper,deadhead
```
(97 chars)

## Screenshots (Jay takes on iPhone — 6.7"/6.9" set required, 3–6 shots)

Suggested order:
1. A setlist poster page mid-scroll (Althea Gems — parchment, versions visible)
2. Lock screen with the player: title + "Grateful Dead · date · venue · Dead-Set.Org" + Charlie artwork
3. The Builder with a set in progress
4. Browse/community setlists
5. A song page showing multiple versions by night

No text overlays needed for v1 — the app's own surfaces carry the aesthetic.

## Age rating questionnaire — decision needed (Jay)

Answer honestly. The one flag: vibe labels using cannabis strain names
(Indica/Sativa) count as "drug references" → likely 12+/17+. Options:
(a) accept the rating; (b) rename the labels before submission and answer
"none". Everything else is None/No (no violence, gambling, etc.). UGC:
answer YES to user-generated content — we have report/block + moderation,
which is what Apple checks for.

## App Review Information

- **Contact:** Jay Cohen · eljaguaro@gmail.com · phone TBD
- **Demo account:** eljaguaro+appreview@gmail.com — must be created through the
  app's email signup AND confirmed before submitting. Blocked until the native
  redirect fix ships; email confirmation does not currently complete on device.
- **Notes:** paste `docs/appstore/reviewer-notes.md`.

## App Privacy (data collection questionnaire)

- **Contact info → Email address:** collected, linked to identity (account)
- **User content:** setlists/comments, linked to identity
- **Identifiers → User ID:** yes (account id)
- **Usage data → Product interaction:** collected, LINKED to identity, not used
  for tracking. (This says linked because signed-in play/share/page events carry
  a user_id. It must match PrivacyInfo.xcprivacy, which declares it linked — a
  manifest that disagrees with this questionnaire is a known rejection trigger.)
- **Identifiers → Device ID:** collected, linked to identity, not used for
  tracking. This is `ds_visitor_id`, a random UUID kept in localStorage and sent
  as the x-visitor-id header. Not an IDFA or IDFV, but persistent, and joined to
  a user_id in visitor_attribution once someone signs up.
- **Tracking (ATT):** NO — no cross-app tracking, no ads

> Diagnostics: PrivacyInfo.xcprivacy currently declares CrashData and
> PerformanceData (unlinked). No crash or performance SDK actually ships — there
> is no Sentry, Bugsnag, Crashlytics or Datadog anywhere in the project. Over-
> declaring is not a rejection risk, but it does put "Diagnostics" on the public
> privacy label for data the app never collects. Decide whether to drop those two
> entries before submitting.
