# App Store listing — Dead Set: Wake Now Discover

Paste-ready metadata for App Store Connect. Voice per dead-set-field-guide.md
(no "AI", community is the hero, Archive/tapers credit unburied).

## App Information

- **App Store Connect record:** already created — Apple ID `6799269210`,
  iOS App 1.0 at "Prepare for Submission"
- **Name:** Dead Set: Wake Now Discover
- **Subtitle** (30 chars max, currently 29): `Build the Dead show you crave`
- **Category:** Music (primary); Entertainment (secondary)
- **Bundle ID:** org.deadset.app
- **Price:** Free
- **Copyright:** © 2026 Dead Set. Recordings stream from the Internet Archive's Live Music Archive.
- **Support URL:** https://dead-set.org/about
- **Marketing URL:** https://dead-set.org
- **Privacy Policy URL:** https://dead-set.org/privacy

## Promotional Text (170 chars max, editable without review)

Currently 166. The previous draft was 175 and Apple would have rejected the
paste — count this field after any edit.

```
Every setlist is a reconstructed night — the Althea from Boston '93 next to the one from Red Rocks '82. Built by Deadheads, from tapes that never stopped circulating.
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

## Keywords (100 chars max, comma-separated — currently 86)

```
grateful dead,setlist,jerry garcia,live music,tapes,concert,archive,jam,taper,deadhead
```
(86 characters, recounted 2026-09-21 — an earlier "(97 chars)" line here
contradicted the heading; the heading was right.)

## Screenshots (Jay takes on iPhone)

App Store Connect for this app (Apple ID 6799269210) presents a single iPhone
slot: **6.5" Display**, accepting 1242x2688, 2688x1242, 1284x2778 or 2778x1284.
It also states only the first three are used on the install sheet — so three
strong shots matter more than ten. An earlier note here said 6.7"/6.9"; that
was wrong, read off the wrong Apple doc rather than off the actual listing.

Up to 3 app previews and 10 screenshots are accepted.

Suggested order (first three are the ones that count):
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
  app's email signup AND confirmed before submitting. **No longer blocked:**
  native email confirmation has worked since build 21 (`authRedirectTo()` +
  `DeepLinkPlugin.swift`, shipped in PR #35). Give the reviewer email
  credentials even though the app now offers Google and Apple too — a reviewer
  cannot be asked to own either account.
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
- **Third-party processor — PostHog (new with build 22):** `posthog-js` ships
  inside the bundle and `.init()`s in the WKWebView, posting to
  `VITE_PUBLIC_POSTHOG_HOST` rather than through Supabase. `identifyUser()`
  (`src/hooks/useAuth.ts`) sends **email address and display name** to it on
  sign-in, alongside product-interaction events. Answer the questionnaire for
  Email Address, Name, Product Interaction and Device ID as collected and
  **used for Analytics as well as App Functionality**. Still NOT tracking under
  ATT: this is first-party product analytics, not cross-app advertising, and
  session replay, autocapture, heatmaps and surveys are all explicitly disabled
  in `src/lib/posthog.ts`.

> Diagnostics: PrivacyInfo.xcprivacy declares CrashData and PerformanceData
> (unlinked). **This changed with build 22.** PostHog's exception capture is
> deliberately left on (`src/lib/posthog.ts` explains why), so CrashData is no
> longer a declaration for data never collected. PerformanceData still is — no
> performance SDK ships. The open question narrows to whether to drop that one
> entry before submitting.
