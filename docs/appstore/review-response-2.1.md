# Response to Guideline 2.1 — Information Needed (Submission f8593d8a)

Rejected 2026-09-22 17:02 PT on build **1.0 (27)**. Not a defect and not a
policy finding: the standard questionnaire Apple sends a developer account with
limited review history. **No new build is required** — reply, update the Notes
field, and resubmit the same build 27.

Apple asks for the information in BOTH places, and **both fields are capped at
4000 characters** — the reply as well as the Notes. The first draft of the reply
ran to 5548 and App Store Connect refused it at -1548, which is how the cap was
discovered. The reply now lives in [`review-reply-2.1.txt`](review-reply-2.1.txt)
at **3988 characters**, and the Notes replacement in
[`reviewer-notes-v2.txt`](reviewer-notes-v2.txt) at **3952**.

That -1548 is also a useful measurement: 4000 + 1548 = 5548, exactly the
character count of the draft as counted here with LF newlines. So App Store
Connect counts a newline as one character and does not inflate to CRLF. A field
counted locally can be trusted to the character.

---

## Part 1 — Reply to App Review

Paste [`review-reply-2.1.txt`](review-reply-2.1.txt) — 3988 characters against
the 4000 cap. It answers all six items; the fuller rights and services detail
lives in the Notes block, which Apple also asked for, so the reply does not
repeat it at length.


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
