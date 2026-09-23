# Response to Guideline 2.1 — Information Needed (Submission f8593d8a)

Rejected 2026-09-22 17:02 PT on build **1.0 (27)**. Not a defect and not a
policy finding: the standard questionnaire Apple sends a developer account with
limited review history. **No new build is required** — reply, update the Notes
field, and resubmit the same build 27.

Apple asks for the information in BOTH places. The reply below is uncapped; the
Notes field is capped at 4000 characters, so the block in the second half is a
rewrite of `reviewer-notes.md` that folds the new answers in and still fits.

---

## Part 1 — Reply to App Review

```
Thank you for the review and for the specific questions. Answers below, in
your numbering. A screen recording is attached.

1. SCREEN RECORDING
Attached. Captured on a physical iPhone running the current iOS release,
beginning at app launch. It shows the typical flow — browsing community
setlists, opening a setlist, pressing play and hearing a recording stream,
and building a setlist — plus each item you listed: account registration,
sign-in, and account deletion; user-generated content with the content
reporting and user blocking mechanisms exercised on screen. The app has no
paid content or features of any kind, so there is nothing to show for that
item.

The deletion shown in the recording is performed on a throwaway account
created for that purpose, so that the demo credentials in App Review
Information remain usable for your testing.

2. PURPOSE AND TARGET AUDIENCE
Dead Set is for Grateful Dead fans. The band played about 2,300 concerts
between 1965 and 1995 and permitted their audiences to record and freely
trade those shows, so tens of thousands of concert recordings exist in the
public Internet Archive.

The problem: that archive is enormous and organised by date, so it is very
hard to find a particular performance of a particular song, and nearly
impossible to compare performances across years.

Dead Set lets a fan assemble a "dream setlist" — choosing a specific night's
performance of each song, arranged as a real concert with Set I, Set II and
an Encore — then play it back end to end, and share it with other fans. The
audience is adult music fans; the app is free, has no advertising, no
purchases, and no monetisation of any kind.

3. SETUP AND ACCESS
No setup is required. Browsing and listening work with no account. An
account unlocks building setlists, favourites, and commenting.

Demo credentials are in the App Review Information section. That account
signs in with email and password and needs no Google or Apple ID. Sign in
with Apple and Google are also offered on the same screen.

To reach the main features: the home screen shows community setlists — tap
one, then press play to stream. "Build with Cosmic Charlie" or the Browse
tab starts a new setlist; add songs, choose the specific performance of each
from the version browser, and save. Profile → Danger Zone contains account
deletion. Reporting is the flag icon on any setlist, comment or direct
message; blocking is the icon beside another person's comment.

4. EXTERNAL SERVICES USED
- Internet Archive (archive.org) — the source of all audio. Recordings are
  streamed from the Archive's public endpoints. We host no audio ourselves
  and the app offers no download. See item 6.
- Relisten (api.relisten.net) — a public Grateful Dead concert database,
  used to look up the song order of a given night.
- Supabase, provisioned through Lovable Cloud — accounts and authentication,
  database, file storage for profile photos, and our server-side functions.
- Lovable AI Gateway (ai.gateway.lovable.dev) — the large language model
  behind our in-app setlist assistant, which suggests songs and performances
  when a user asks for help building a set. It receives the user's typed
  request and setlist contents. It is not used for moderation decisions.
- PostHog — first-party product analytics (which screens are used, which
  setlists are played). No advertising, no cross-app tracking; App Tracking
  Transparency does not apply and we request no tracking permission.
- Resend (api.resend.com) — transactional and opt-in newsletter email.

There are no payment processors, because nothing is sold.

5. REGIONAL DIFFERENCES
There are none. The app functions identically in every region. There is no
geographic gating, no region-specific content, and no region-specific
pricing — the app is free everywhere. Content availability depends only on
what the Internet Archive serves, which is not region-restricted.

6. PROTECTED THIRD-PARTY MATERIAL
Dead Set is an independent, non-commercial fan project. It is not
affiliated with, endorsed by, or sponsored by the Grateful Dead, Grateful
Dead Productions, Rhino Entertainment, or Warner Music Group. All
trademarks are the property of their respective owners. This is stated in
the app's footer and at https://dead-set.org/about.

The basis for the audio is the band's own long-standing policy. The
Grateful Dead explicitly permitted audience taping and free, non-commercial
trading of their live performances throughout their career; that permission
is why the Internet Archive's Live Music Archive hosts these recordings
publicly. We honour the non-commercial terms of that policy: we host no
audio, we stream from the Archive's public endpoints, we carry no
advertising, and we sell nothing.

The Archive distinguishes audience tapes, which it offers as downloads,
from soundboard recordings, which the band asked it to make available for
streaming only. Dead Set offers no download anywhere in the app, and on
items the Archive marks access-restricted or stream-only it plays the
Archive's own streaming derivative and never requests the restricted
original — if such an item has no streamable derivative, the app skips it
rather than reaching for the file. The band's posted policy is reproduced
verbatim in-app at https://dead-set.org/about.

For precedent, this is the same content source and rights model as Relisten
(App Store ID 715886886), on the App Store since 2014, and other Live Music
Archive players.

We are not in a regulated industry.

Happy to provide anything further.
```

---

## Part 2 — The screen recording

Shoot on a physical iPhone, current iOS, starting from the home screen and
tapping the app icon. Apple rejects recordings that start mid-app.

**Do the deletion on a throwaway account.** If it is recorded on
`eljaguaro+appreview@gmail.com`, that account no longer exists and the reviewer
cannot sign in — which is a second rejection, on 2.1 "Accessing the app".
Create a second account on camera, use it for the whole recording, and delete
that one at the end.

Shot list, in order:

1. Tap the icon from the home screen. Let the launch screen play through.
2. Home: scroll the community setlists.
3. Open a setlist. **Press play and let audio run for 10–15 seconds** — this
   is the core function and the thing that most needs to be seen working.
4. Build: start a setlist, add two or three songs, open the version browser
   and pick a specific night for one of them. Save.
5. Sign up: create the throwaway account with email and password on camera.
6. UGC: leave a comment on a setlist.
7. **Reporting:** tap the flag on a setlist, a comment, and a direct message.
   Apple named reporting explicitly — show all three surfaces, not one.
8. **Blocking:** tap the block icon beside another person's comment.
9. **Account deletion:** Profile → Danger Zone → delete. Show it completing
   and returning to a signed-out state.

Nothing to record for paid content — say so in the reply rather than leaving
the item unanswered, which is what the draft above does.

### Before you press record

- **Confirm the installed build is 27.** TestFlight shows the build number on
  the app's page. Recording an older build risks showing the consent alert
  saying "App" instead of "Dead Set", which is the thing build 27 fixed.
- **Create the throwaway account's address first** so you are not inventing one
  on camera. A `+` alias on your own inbox is fine.
- **Turn on a Focus mode.** A notification banner sliding over the setlist is
  the kind of thing that makes a reviewer re-request.
- **Leave the phone ON silent, and verify audio actually records.** The
  Ring/Silent switch does not mute media playback on iOS — it silences ringers
  and alerts only — so silent mode kills the notification sounds that would
  otherwise intrude on a take while a streaming setlist still plays and still
  records. (An earlier version of this file said to take the phone off silent.
  That was wrong and backwards.) Verify regardless: shoot fifteen seconds of a
  setlist playing, play it back, confirm you hear it. The reviewer needs to
  hear that streaming works — it is the core function and the one Apple's item
  1 calls "the typical user flow".
- **Add Screen Recording to Control Centre** if it is not there: Settings →
  Control Centre → Screen Recording. The microphone toggle (long-press the
  record button) stays OFF; no narration is wanted.

### After

- Recordings land in Photos. **Trim the start and end** so it opens on the home
  screen and does not close on the Control Centre fumble.
- Keep it short — two to three minutes covers every item on the list. A long
  file is more likely to run into the attachment limit on the App Review reply.
- If the file is too large to attach, put a link in the reply text instead
  (unlisted cloud link). Apple accepts a URL, but an attachment is simpler.
- Watch it back once against the nine shots before attaching. The expensive
  failure is discovering afterwards that the flag tap did not register on one
  of the three surfaces.

---

## Part 3 — The Notes field

Apple asks for this information in the Notes field as well as the reply, "for
reference on future submissions". That field is capped at 4000 characters and
the existing block is 3014, so it cannot simply be appended to.

The replacement is [`reviewer-notes-v2.txt`](reviewer-notes-v2.txt), **3952
characters, counted not estimated** (48 spare — deliberate headroom, because a
field counted to exactly its limit fails on any paste quirk). Paste it over the
current Notes contents entirely.

It keeps every claim from the old block — all four of which were verified
against build 27 and are recorded in `reviewer-notes.md` — and adds the answers
to Apple's items 2, 3, 4 and 5: purpose and audience, setup and access, the
external services list, and the regional-consistency statement.

Two deliberate choices in it:

- **It names the language model, PostHog and Resend.** `CLAUDE.md` forbids "AI"
  and internal machinery names in user-facing surfaces, and that rule stands —
  but App Review correspondence is a compliance document to Apple, not a fan
  surface, and Apple's item 4 asks for "AI services" by name. Under-disclosing
  here buys another rejection round.
- **No em-dashes or typographic quotes.** Plain ASCII throughout, so the
  character count App Store Connect sees matches the one counted here.

## Resubmitting

No new build. Build 27 is unchanged and still correct: reply, replace the
Notes, attach the recording, then **Resubmit to App Review** on the submission
page.
