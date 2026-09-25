# App Review notes — Dead Set: Wake Now Discover

Paste into App Store Connect → App Review Information → Notes.
The block below is **3014 characters** against that field's 4000 limit
(counted 2026-09-21, not estimated — recount it if you edit the block).
Demo account credentials go in the sign-in fields next to it:
`eljaguaro+appreview@gmail.com`, created 2026-09-21 via the app's email
signup. There is no confirmation step to complete — email confirmation is
off for this project, so the account was confirmed on creation. The password
is deliberately not recorded here; type it straight into App Store Connect.

## The 1.2 claims, verified against build 27 (2026-09-21)

The block below tells Apple the app has a report flow, user blocking, a
moderation queue and in-app account deletion. A reviewer who taps a flag icon
and finds nothing rejects on the spot, so each was checked for a **caller**,
not a definition:

| Claim | Where it actually runs |
|---|---|
| Report a setlist | `src/pages/SetlistPoster.tsx:1052` |
| Report a comment | `src/components/SetlistComments.tsx:260` |
| Report a direct message | `src/pages/Messages.tsx:450` |
| Reports are insertable | RLS `"Users can file reports"` — `INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id)` |
| Block a user | `src/components/SetlistComments.tsx:269`, `src/pages/Messages.tsx:107` |
| Blocking is enforced | RESTRICTIVE policy `"Blocked senders cannot message blockers"` on `direct_messages` — blocked senders are stopped in the database, not just hidden in the UI |
| Moderation queue | `src/pages/Admin.tsx:495`, admin-gated — **the reviewer cannot see this one**, and the notes phrase it as process rather than a feature they can tap |
| Account deletion | `src/pages/Profile.tsx:48` → `delete-account` edge function; Danger Zone UI at `Profile.tsx:234-266` |

`delete-account` was also probed **in production**, because a merged-but-
undeployed edge function is indistinguishable from a working one when read
from the repo — the banked correction in `CLAUDE.md` is that Lovable Publish
does not deploy functions. `net.http_post` from the production database
returns **401 `UNAUTHORIZED_NO_AUTH_HEADER`**, not 404, so the function is
deployed and `verify_jwt` is doing its job.

Not verified: that deletion *succeeds*. Confirming that means destroying a
real account. If the reviewer tests 5.1.1(v) on the demo account, that account
is gone and they cannot sign back in.

---

```
Thank you for reviewing Dead Set.

WHAT THE APP IS
A setlist-building and listening companion for Grateful Dead fans. Users
assemble "dream setlists" from the band's live catalog and stream the
corresponding recordings. The app is free, contains no ads, no purchases,
and no monetization of any kind.

AUDIO CONTENT & RIGHTS (guideline 5.2)
Dead Set is an independent, non-commercial fan project. It is not
affiliated with, endorsed by, or sponsored by the Grateful Dead, Grateful
Dead Productions, Rhino Entertainment, or Warner Music Group. All
trademarks are the property of their respective owners. This is stated in
the app's footer and on https://dead-set.org/about.

All audio streams directly from the Internet Archive's Live Music Archive
(archive.org), the long-standing public repository of Grateful Dead concert
recordings. The Grateful Dead explicitly permitted audience taping and
free trading of their live performances throughout their career, and the
band's non-commercial trading policy is honored: we host no audio
ourselves, we stream from the Archive's public endpoints, we carry no
advertising, and we sell nothing.

The Archive distinguishes audience tapes, which it offers as downloads,
from soundboards, which the band asked it to make available for streaming
only. Dead Set offers no download anywhere in the app, and on items the
Archive marks access-restricted or stream_only it plays the Archive's own
MP3 stream and never requests the restricted original — if such an item
has no streamable derivative, the app skips it rather than reaching for
the file. The band's posted policy is reproduced verbatim in-app at
https://dead-set.org/about.

Precedent: this is the same content source and rights model as Relisten
(App Store ID 715886886), which has been available on the App Store since
2014, as well as other Live Music Archive players.

USER-GENERATED CONTENT (guideline 1.2)
Users can publish setlists and comments. The app includes: a report flow
on shared content — tap the flag on any setlist (setlist page), comment,
or direct message; user blocking — the block icon beside any other
person's comment; a moderation queue reviewed by the team; and in-app
account deletion (Profile → Danger Zone). Terms of Service and Privacy
Policy are linked at signup and in-app.

ACCOUNT & DEMO
Sign in with Apple, Google, or an email address and password. Sign in with
Apple is offered alongside Google on the same screen, so the requirement in
guideline 4.8 is met. The demo account in the review credentials is an
email/password account and needs no Google or Apple ID to use. Core browsing
and listening work without an account; the account unlocks building,
favorites, and comments.

BACKGROUND AUDIO
The app declares the audio background mode and plays music with lock-screen
transport via the system player — the core use case is listening to full
concert sets while the phone is pocketed or locked.

Questions welcome — happy to clarify anything about the content model.
```
