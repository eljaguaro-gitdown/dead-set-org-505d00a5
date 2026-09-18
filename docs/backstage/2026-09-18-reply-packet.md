# Backstage reply packet — 2026-09-18

Drafts only. Jay enters/sends everything below — nothing here is live. Built on
[`2026-09-18-submission-triage.md`](2026-09-18-submission-triage.md) and the
verified facts as given; no re-derivation, no new claims.

Voice check run against [`dead-set-field-guide.md`](../../dead-set-field-guide.md)
§7 and [`docs/community-steward-playbook.md`](../community-steward-playbook.md):
no "AI" / "algorithm" / "generate" / "engine" / "model" anywhere below; Charlie
stays a fan, never a tool; Archive/tapers/traders framing preserved where it's
load-bearing; "Hey Now" used where a salutation fits; nobody is named (both
fixed bugs came in anonymous).

---

## (A) Week 3 changelog edition — `/updates`

This is the only channel that reaches the two anonymous reporters. Reply
mechanism: Admin → changelog_entries, insert the rows below as `published = true`.

### The numbering call

**Keep it Week 3 — but let the `week_label` and the encore say what actually
happened.** Renumbering into a "Volume 2" or a soft relaunch would be spin: it
implies the record was reset, when the honest fact is simpler — this is the next
edition we've published, five months late, and the copy should own that directly
rather than paper over it with a fresh label. Week 3's `week_label` spans the
whole gap instead of one week, which is itself the tell that something was
different about this edition — nobody has to read the fine print to notice.

### Edition-level fields (shared by all three rows)

| Field | Value |
|---|---|
| `week_number` | `3` |
| `week_label` | `Apr 21 – Sep 18, 2026` |
| `edition_title` | `The Tape Kept Rolling` |
| `encore_note` | `Five months of quiet on this page wasn't five months of nothing — we were heads-down and let the build notes go dark. That's on us, not on you. We're back, and we're not planning on disappearing again.` |
| `next_week_teaser` | `Hearing two versions of the same song back to back, and a first-tap fix worth bragging about.` |

### The three rows

| # | `tag` | `set_number` | `title` | `detail` | `credit` |
|---|---|---|---|---|---|
| 1 | `fix` | `1` | That tape didn't have your song — so we stopped pretending it did | If a listed song wasn't actually on the tape, the player used to just start playing from the top of the recording anyway — wrong song, no warning. Now it either says so straight or moves on to the next song in the set. No more mystery tracks. | From a Backstage bug report filed in April. You were right, and we're sorry it took this long to say so. |
| 2 | `improved` | `2` | The first tap, still chasing it | Hit play and got dead silence before? That dead end is gone — you'll see "Tap to start the tape" instead of nothing. The deeper fix, so it plays clean on the very first tap every time, is still in the shop. We see it. We're not done. | From a Backstage bug report filed the same week as the one above. Two for two — still working the rest. |
| 3 | `new` | `2` | The Songbook: watch a song change shape across the years | Pick a song and follow it across the eras — how it breathes different in '72 than it does in '77, how it stretches or tightens or turns into something else entirely over the years. Live now on every song page. Coverage is still filling in, so some songs will show more of the story than others for a while yet — that part's ongoing. | This one's straight off the Backstage wish list from April. We heard it. It just took a minute. |

Rationale for row 3's honesty caveat: coverage really is thin (26 of 233 songs
carry any curated version, per the triage doc) — better to say so plainly than
let someone click a bare song page and think the feature's broken.

---

## (B) DM to Jyllywylly — not fixed, own it

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

## (C) Seth Bregman — recommend now, not wait

Reply now, briefly, over the same `/messages?to=<user_id>` DM channel: he's a
signed-in Founding Deadhead who opened his request with "I should cruise around
more before making requests," which is an engaged fan second-guessing himself —
the cheap, right move is to tell him today that the dig-deep song browser
already gets him partway there and that back-to-back same-song playback is
being built (1–2 days per the triage estimate), rather than let him sit in the
same five-months-of-silence hole Jyllywylly just came out of.

---

## (D) URGENT — brand rule broken, live right now on `/updates`

Flagging per guardrail: this is a published `changelog_entries` row, not a code
change, so Jay needs to update it directly (Admin → changelog_entries, or a
one-off `UPDATE` on that row) — outside what a drafting pass can touch, and
outside `src/`/`supabase/` where I'm not permitted to write regardless.

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

1. **Week 3, not a relaunch label** — argued above; the alternative (new
   numbering) reads as spin under the field guide's own rules.
2. **Named the coverage gap in row 3's detail** rather than let the Songbook
   ship silently thin — accuracy over polish, per the playbook's "warmth
   first, accuracy second, speed third," in that order but neither skipped.
2b. Row 2's tag is `improved`, not `fix` — deliberately, since the first-tap
    problem is real and open per the verified facts; nothing in this packet
    claims it's fixed.
3. **Seth gets a reply now, not a wait** — argued in (C); his own words ("I
   should cruise around more") are the tell that silence would read as
   dismissal, not patience.
4. **The brand-rule flag is separated out and marked urgent** rather than
   folded into the changelog section, since it's a live-now problem on an
   unrelated row, not part of the reply packet proper, and needs Jay's hands
   directly (DB row, not a file this pass can write).
