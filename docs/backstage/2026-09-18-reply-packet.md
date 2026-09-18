# Backstage reply packet — 2026-09-18

Drafts only. Jay enters/sends everything below — nothing here is live. Built on
[`2026-09-18-submission-triage.md`](2026-09-18-submission-triage.md) and the
verified facts as given; no re-derivation, no new claims.

**Correction folded in (v2):** the first pass of this packet said "the broadcast
channel is dark" and treated `/updates` (`changelog_entries`) as the only way to
reach the community. That was wrong — Jay has been broadcasting the whole time
through the `announcements` table (Admin → Broadcast Announcement →
`AdminAnnouncementsPanel.tsx`, surfaced via the bell in `AnnouncementsBell.tsx`).
Seven announcements, steady cadence, published, going back to April 20. What's
actually dark is `/updates` alone — it's the archive, not the megaphone. This
version leads with an announcement draft instead, reframes the changelog rows
as the durable record rather than the delivery mechanism, and adds a section on
a real problem the corrected data surfaced: reach.

Voice check run against [`dead-set-field-guide.md`](../../dead-set-field-guide.md)
§7 and [`docs/community-steward-playbook.md`](../community-steward-playbook.md):
no "AI" / "algorithm" / "generate" / "engine" / "model" anywhere below; Charlie
stays a fan, never a tool; Archive/tapers/traders framing preserved where it's
load-bearing; "Hey Now" used where a salutation fits; nobody is named (both
fixed bugs came in anonymous). Announcement copy below is additionally checked
against Jay's own established register (the Aug 14 "Firsts & Lasts" post) —
lowercase "Hey now," short declarative opener, the news, a named thank-you
when it's earned, a concrete "go do this" line, a sign-off tag. Matched, not
reinvented.

---

## (A) Announcement draft — the channel that actually reaches people

Table: `announcements`. Fields: `title`, `body`, `cta_label`, `cta_url`,
`published`. Post via Admin → Broadcast Announcement.

> **title:** Old business, cleared
>
> **body:**
> Hey now. We've been catching up on old business.
>
> Two fixes and one long-overdue delivery. If a setlist ever handed you a
> completely different song than the one you picked — that's fixed. If we
> can't find your song on the tape, we'll tell you now instead of guessing
> wrong and playing something else in its place. If the tape ever went dead
> silent on your first tap — you'll get "Tap to start the tape" now instead of
> nothing. The fix for the tap itself is still in the shop; we're not calling
> that one done till it's actually done. And the Songbook is live: pick a
> song, watch it change shape across the eras — that one's straight off a
> Backstage wish list from back in April.
>
> Both bugs above came from notes filed in Backstage the same day, back in
> April. Filed anonymous, so we can't call you out by name the way we did for
> Philly Bob — but you know who you are, and the thanks is owed either way.
> This is what happens when heads talk to us, even when it takes us five
> months to listen back.
>
> Open any song page for the Songbook, or just hit play on a setlist and trust
> the tape again.
>
> **cta_label:** See the Songbook
> **cta_url:** /songbook
>
> The tape kept rolling.

Notes on the draft:
- Leads with the two April bug fixers because they're the ones actually owed
  something, per the task — the Songbook mention rides along rather than
  headlining, since crediting the fix nobody asked to wait five months for
  comes first.
- "even when it takes us five months to listen back" is the one place this
  draft is more self-critical than the Aug 14 precedent, which had nothing to
  apologize for. Deliberate — the debt here is real and Jay knows it; softer
  phrasing would read as spin to two people who watched the clock the whole
  time.
- Does **not** promise the first-tap fix or back-to-back versions — neither is
  built. Same reasoning as the next_week_teaser cut below.

---

## (B) Reach — the real obstacle, not the absence of a channel

The corrected numbers change what "closing the loop" means. `announcement_reads`
per announcement:

| Announcement | Date | Reads |
|---|---|---|
| Backstage is open — end-to-end test | Apr 20 | 15 |
| This is why I built Dead-Set | Apr 23 | 14 |
| Start the weekend shakin' it down | Apr 24 | 14 |
| Era selection working (finally!) | May 1 | 11 |
| Firsts & Lasts is on the mic | Aug 14 | 2 |
| The Merriweather Shakedown is out | Aug 21 | 2 |
| Arrivals and Departures! | Sep 15 | 1 |

Roster grew the whole time — 51 profiles, 36 joined before May, only 2 since
August. So the trend line isn't "fewer people to reach," it's fewer people
opening the bell: an announcement today lands in front of roughly one or two
people out of 51. A reply nobody reads isn't a reply. `markAllRead` and the
bell component haven't changed in the repo's history, so this doesn't read as
broken plumbing — it reads as the April cohort going quiet, which is a
community-health question, not a bug. **Flagging, not asserting a cause:**
worth Jay looking directly at who those 36 April joiners are and whether
they've drifted from the product entirely or just stopped opening
announcements specifically — those need different responses, and that
judgment needs a person, not this pass.

**What I'd recommend, since asked:** the bell is pull-only — signed-in users,
in-app, no push, no email tie-in (`useAnnouncements.ts` requires a `user` and
fires nothing outside the Supabase realtime channel). For news this overdue,
that's a thin net. Dead Set already has a proper email leg — Resend, the
`dispatch_sends` pipeline, the Set I / Set II / Encore structure the field
guide specifies for dispatches. I'd pair *this specific* announcement with a
short Set I / Set II / Encore dispatch email to the Founding Deadheads list
rather than relying on the bell alone — it reaches someone whether or not they
remember to open the app this week. That's a second draft I haven't written
(out of scope for this pass — flagging the recommendation, not building it);
say the word and I'll turn the announcement above into a dispatch.

---

## (C) Week 3 changelog edition — `/updates`, the durable record

**Reframed purpose:** this does not reach the two April reporters — nothing on
`/updates` does; it's opt-in and has no notification of its own. It's the
archive that makes the announcement's claims checkable later and gives new
Founding Deadheads a place to read the history. Treat it as bookkeeping that
should exist, not as the reply itself — the reply is (A).

### The numbering call

**Keep it Week 3 — but let the `week_label` and the encore say what actually
happened.** Renumbering into a "Volume 2" or a soft relaunch would be spin: it
implies the record was reset, when the honest fact is simpler — this is the
next edition we've published, five months late, and the copy should own that
directly rather than paper over it with a fresh label. Week 3's `week_label`
spans the whole gap instead of one week, which is itself the tell that
something was different about this edition.

### Edition-level fields (shared by all three rows)

| Field | Value |
|---|---|
| `week_number` | `3` |
| `week_label` | `Apr 21 – Sep 18, 2026` |
| `edition_title` | `The Tape Kept Rolling` |
| `encore_note` | `Five months of quiet on this page wasn't five months of nothing — we were heads-down and let the build notes go dark. That's on us, not on you. We're back, and we're not planning on disappearing again.` |
| `next_week_teaser` | `We're not caught up yet — more from the backlog next time.` |

`next_week_teaser` revised from the first pass, which promised a finished
first-tap fix and back-to-back version playback — neither is built, and a
teaser is a promise. This version commits to nothing that isn't already true.

### The three rows

| # | `tag` | `set_number` | `title` | `detail` | `credit` |
|---|---|---|---|---|---|
| 1 | `fix` | `1` | That tape didn't have your song — so we stopped pretending it did | If a listed song wasn't actually on the tape, the player used to just start playing from the top of the recording anyway — wrong song, no warning. Now it either says so straight or moves on to the next song in the set. No more mystery tracks. | From a Backstage bug report filed in April. You were right, and we're sorry it took this long to say so. |
| 2 | `improved` | `2` | The first tap, still chasing it | Hit play and got dead silence before? That dead end is gone — you'll see "Tap to start the tape" instead of nothing. The deeper fix, so it plays clean on the very first tap every time, is still in the shop. We see it. We're not done. | From a separate Backstage bug report filed the same day in April. Still working the rest. |
| 3 | `new` | `2` | The Songbook: watch a song change shape across the years | Pick a song and follow it across the eras — how it breathes different in '72 than it does in '77, how it stretches or tightens or turns into something else entirely over the years. Live now on every song page. Coverage is still filling in, so some songs will show more of the story than others for a while yet — that part's ongoing. | This one's straight off the Backstage wish list from April. We heard it. It just took a minute. |

Row 2's credit line dropped "Two for two" from the first pass — both April
bugs came in anonymous, so nothing here can claim they're the same filer. Two
separate anonymous reports, filed the same day, is what's actually known.

Rationale for row 3's honesty caveat: coverage really is thin (26 of 233 songs
carry any curated version, per the triage doc) — better to say so plainly than
let someone click a bare song page and think the feature's broken.

---

## (D) DM to Jyllywylly — not fixed, own it

Unchanged from the first pass — the corrected reach picture doesn't touch this
one, since a DM to a specific `user_id` reaches them directly regardless of bell
engagement.

Channel: Admin → Reply → `/messages?to=<user_id>` (their account carries a
`user_id`, so this reaches them directly — the only one of the three bugs where
that's true). Text below is ready to paste as-is.

> Hey Now —
>
> Going back through old Backstage reports and found yours from your very first
> day here, about Add to Home Screen and the share buttons doing nothing. You
> were right on both counts, and it sat unanswered for five months. That's on
> us.
>
> Here's exactly what's wrong. iOS only lets Safari add a site to your Home
> Screen — Chrome on iPhone has no such option, full stop. We were telling
> everyone the Safari steps no matter which browser they were actually in, so
> you followed our instructions and landed nowhere, which is exactly what you
> described. Separately, our own share button was failing quietly on top of
> that — it caught its own errors and said nothing, so "nothing happened" was
> the literal truth twice over.
>
> Both are diagnosed now and the fix is queued — it's small, and it's next up
> in the build. When it ships we'll tell you here first, since you're the one
> who caught it.
>
> Thank you for sticking around and for finding us in your first twelve hours.
> That's the kind of ear we built this for.
>
> — Jay

---

## (E) Seth Bregman — recommend now, not wait

Unchanged. Reply now, briefly, over the same `/messages?to=<user_id>` DM
channel: he's a signed-in Founding Deadhead who opened his request with "I
should cruise around more before making requests," which is an engaged fan
second-guessing himself — the cheap, right move is to tell him today that the
dig-deep song browser already gets him partway there and that back-to-back
same-song playback is being built (1–2 days per the triage estimate), rather
than let him sit in the same five-months-of-silence hole Jyllywylly just came
out of.

---

## (F) URGENT — brand rule broken, live right now on `/updates`

Unchanged. Flagging per guardrail: this is a published `changelog_entries` row,
not a code change, so Jay needs to update it directly (Admin →
`changelog_entries`, or a one-off `UPDATE` on that row) — outside what a
drafting pass can touch, and outside `src/`/`supabase/` where I'm not permitted
to write regardless.

**Live now:**
> title: "Cosmic Charlie — AI setlist generator"
> detail: "Describe a vibe, pick an era, set the length. Cosmic Charlie builds
> your dream setlist from real Grateful Dead song data. Surprise Me mode for
> the adventurous."

This breaks the one hard rule in the field guide twice in nine words ("AI,"
"generator") and flattens Charlie from a fan character into a feature
description. It's also been live and visible the entire five-month gap.

**Proposed replacement — drop-in, same fields:**
> title: "Cosmic Charlie: tell him the vibe, he'll build the night"
> detail: "Say what kind of night you're after — moody, jammy, a screamer —
> pick an era, set the length, and Cosmic Charlie reconstructs a real setlist
> from actual Grateful Dead shows, aha moment included. Feeling reckless? Hit
> Surprise Me."

Checked against §7: no "AI" / "algorithm" / "generate" / "engine" / "model,"
Charlie stays a fan with an ear ("reconstructs," not "builds from data"), and
"aha moment" pulls the one-per-setlist promise from §2 into the pitch itself
instead of leaving it implicit.

---

## Judgment calls made

1. **The announcement (A) is the actual reply; the changelog (C) is the
   archive.** First pass had this backwards. Corrected throughout.
2. **Week 3, not a relaunch label** — argued above; the alternative (new
   numbering) reads as spin under the field guide's own rules.
3. **Named the coverage gap in row 3's detail** rather than let the Songbook
   ship silently thin — accuracy over polish, per the playbook's "warmth
   first, accuracy second, speed third," in that order but neither skipped.
4. Row 2's tag is `improved`, not `fix` — deliberately, since the first-tap
   problem is real and open per the verified facts; nothing in this packet
   claims it's fixed. Its credit no longer implies one filer for both bugs.
5. **Seth gets a reply now, not a wait** — argued in (E); his own words ("I
   should cruise around more") are the tell that silence would read as
   dismissal, not patience.
6. **The brand-rule flag is separated out and marked urgent** rather than
   folded into the changelog section, since it's a live-now problem on an
   unrelated row, not part of the reply packet proper, and needs Jay's hands
   directly (DB row, not a file this pass can write).
7. **Reach recommendation (B) stops at "pair with a dispatch email"** rather
   than drafting that email outright — the ask was for a section on the
   problem and a recommendation, not a fourth deliverable; said so explicitly
   so it's a one-message follow-up if Jay wants it, not a silent scope-creep.
