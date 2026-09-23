# Build Notes — Week 3 catch-up draft

**Sender / channel:** jay — publish via /admin/changelog (dead-set.org/updates)
**Status:** draft for Jay's review. Paste field-by-field into the Build Notes Editor. Nothing here has been sent or published.

---

## Flag before publishing — items I was not fully sure are user-visible or live

Please cut or confirm these before you paste anything in:

1. **"Notification click counts show real names now"** — I found the commit ("Name the people behind the notification click counts") but the only surface I could find it touching is `AdminNotificationClicks.tsx`, which looks admin-only. **Left out of the draft below** — flag if it actually reached a fan-facing screen.
2. **The homepage footer no longer claims "Updated 2 times this week"** — this is a fix, but it's a correction to an internal-facing counter overstating itself, not something fans would have noticed as broken. I left it out; happy to add a line if you want full transparency about it.
3. **GitHub sync badge "telling drift apart"** — confirmed admin-only (`/admin`), not included.
4. **Reviewer-notes / App Store submission language corrections** — these are Apple-facing documents, not fan-facing. Not included.
5. **PostHog instrumentation work** (the whole "wizard," "guest funnel events," "stop counting CTA clicks as shares" thread) — this is measurement plumbing so we can see what fans do; it changes nothing fans see or touch. Not included, per the rule that internal machinery stays internal.
6. **iOS app entry (Set II, tagged Beta)** — confirmed TestFlight only. The App Store listing is still in Apple's review queue. Draft below says "in testing with our beta circle" and does **not** say "download it" or name the App Store. Please double check this is still accurate the day this goes out — if the App Store listing has cleared review by then, this whole entry needs a rewrite (and probably its own edition).
7. **"Stream-only Archive items honored" / "say plainly we aren't the band"** — I've folded the disclaimer half into a stewardship Encore note rather than a numbered entry, since it's a legal/attribution statement rather than a feature. Confirm the framing is okay rather than something that should go to you as sensitive.
8. **Lock screen work (Aug 7–8: artwork, date + venue on the artist line)** — this shipped before Week 2 closed out (Apr 14–20) chronologically... actually no, it's dated August, well within this gap; keeping it in, but it's old enough that some Founding Deadheads may have already noticed it without an announcement. Low risk, keeping it in Set II.

---

## Corrections made after drafting (2026-09-23)

- Stats: "updates shipped" said 13 while counting the entries below; there are 15.
- Entry 1 said Google/Apple sign-in was "back" / "live again" on the phone. It
  was never there before build 24, so it is new, not restored.
- The Songbook: two issues are live (Issue 002 is Crazy Fingers), not one.
- The teaser announced the Crazy Fingers issue as coming; it is already out.

## Week header

- **week_number:** 3
- **week_label:** Apr 21 – Sep 23, 2026
- **edition_title:** The Long Strange Gap

## Week stats

- **updates shipped: 15** — counted as the number of distinct entries below (the fan-visible changes), not the ~55 raw commits in the history. A dozen small copy/error-string fixes and a stack of measurement-only commits are folded into the entries or left out per the flags above.
- **from your feedback: 4** — the entries pulled straight from things Founding Deadheads flagged: the "Play the sleepers" button doing nothing, the broken sign-in, share-link posters being hard to read, and the notes typed into Cosmic Charlie vanishing before they reached the poster. (If your own backstage log disagrees with this count, trust yours — I'm going on the commit messages, which don't always say who reported it.)
- **bugs squashed: 6** — sign-in on iOS, the sleepers button, the tape-less version offering, the frozen listen clock, the poster caption contrast, and the vanishing version note. Everything else is New or Improved rather than a fix.

## Encore note (from the lab)

> Hey Now — it's been quiet on this page since April, and that's on us, not on what shipped. The Songbook launched, Cosmic Charlie got a lot sharper about *when* a version happened, sign-in finally works right on the phone, and we owe the Internet Archive another line of thanks: every recording you hear here is still standing on a taper's shoulders and a trader's patience. We're back on a real cadence from here. Thank you for sticking around for the gap.

## Next week teaser

> [JAY: the previous teaser announced the Crazy Fingers issue, which is already live, so it is not a teaser. Replace with what is actually next, or leave blank.]

---

## SET I — Fixes

1. **tag:** fix
   **title:** Sign in with Google and Apple on the iPhone build
   **detail:** If you tried signing in on the iOS build and it didn't work, it does now — Google and Apple sign-in work right in the app.
   **credit:** built for our TestFlight circle
   **set_number:** 1

2. **tag:** fix
   **title:** Signup errors that actually tell you what to do
   **detail:** A rejected password or an email already on the list used to hand you a raw, unfriendly error. Now it says plainly what happened and what to try next.
   **credit:**
   **set_number:** 1

3. **tag:** fix
   **title:** "Play the sleepers" now plays the sleepers
   **detail:** The button on a song's version ladder that promises to queue up its under-heard versions was filtering the list but not actually playing anything. Now it queues them up, oldest first, and plays.
   **credit:** built from a Founding Deadhead report
   **set_number:** 1

4. **tag:** fix
   **title:** No more offering a version that isn't actually on the tape
   **detail:** Cosmic Charlie could occasionally point you to a version of a song that the recording didn't actually contain. He won't offer those anymore.
   **credit:**
   **set_number:** 1

5. **tag:** fix
   **title:** The listen clock stopped freezing when you switched tabs
   **detail:** Stepping away from the tab and coming back used to leave the play timer stuck. Fixed, along with a related glitch where you'd briefly look "gone" from a shared session when you hadn't left.
   **credit:**
   **set_number:** 1

6. **tag:** fix
   **title:** Share-card posters are easier to read
   **detail:** The caption on a shared setlist poster had contrast issues in some lighting. Cleaned up.
   **credit:** built from a Founding Deadhead report
   **set_number:** 1

7. **tag:** fix
   **title:** Charlie's version notes now make it all the way to the poster
   **detail:** When Charlie explained why he picked a particular version, that note used to get dropped if you saved as a guest. It now carries all the way through — into the set and onto the shared poster.
   **credit:** built from a Founding Deadhead report
   **set_number:** 1

---

## SET II — New & Improved

8. **tag:** new
   **title:** The Songbook
   **detail:** A new weekly feature at dead-set.org/songbook — one song, followed across every era it lived through, first time played to last, with the versions in between worth your evening. Two issues are up now.
   **credit:**
   **set_number:** 2

9. **tag:** improved
   **title:** The three "strain" chips have new names
   **detail:** What used to be Indica, Sativa, and Hybrid on the "what kind of night?" chips are now Late Night, Daytime Show, and Day Into Night — a truer name for the real distinction between a show that starts in daylight and one that doesn't.
   **credit:**
   **set_number:** 2

10. **tag:** new
    **title:** A "Firsts & Lasts" chip for Cosmic Charlie
    **detail:** Tell Charlie you want first-time-played and last-time-played songs in the mix, and he'll go hunting for them.
    **credit:**
    **set_number:** 2

11. **tag:** improved
    **title:** Charlie judges a version against its own era
    **detail:** Cosmic Charlie's liner notes on a version now weigh it against the window of time it came from, not against fifty years of everything — so a good '77 isn't measured by '72 standards.
    **credit:**
    **set_number:** 2

12. **tag:** new
    **title:** Dig deeper by year range on any song's version ladder
    **detail:** Browsing a song's full history now lets you narrow the ladder to a specific stretch of years instead of scrolling the whole thing.
    **credit:**
    **set_number:** 2

13. **tag:** improved
    **title:** A built setlist starts playing the moment it's done
    **detail:** No more extra tap to start listening — once your set is built, it starts. We also cut the intro pre-roll before playback so you land straight in the music.
    **credit:**
    **set_number:** 2

14. **tag:** improved
    **title:** Tap a friend's name in a message thread to see their sets
    **detail:** In Messages, tapping a friend's name or avatar now opens their public setlists directly.
    **credit:**
    **set_number:** 2

15. **tag:** beta
    **title:** Dead Set is in testing on iPhone
    **detail:** We're running a native iOS build through TestFlight with our beta circle now — sign in with Google or Apple, build, and listen right from your phone's lock screen, with the venue and date on the artist line. Not on the App Store yet; that's still in Apple's hands. If you want in on the TestFlight group, tell your steward.
    **credit:**
    **set_number:** 2

---

## Notes for Jay on grouping / tone

- Kept the "Firsts & Lasts" dispatch email itself out of this list — that's an email that already went out, not a product feature; the *chip* (#10) is the durable, in-app thing worth telling fans about.
- Left analytics/instrumentation and admin-only tooling out entirely — none of it is something a fan can see or touch, per the field guide's rule that internal machinery stays internal.
- The Archive/tapers/traders credit is carried in the Encore note per house style rather than as its own numbered entry — didn't want to make stewardship read like a changelog item.
- All copy checked against the banned-word list (AI, algorithm, model, generate) and internal names (PostHog, Supabase, Lovable, Capacitor, edge function, OAuth) — none appear. "Sign in with Google/Apple" used instead of "OAuth."
