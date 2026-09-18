# Backstage submission triage — 2026-09-18

All six submissions in `insider_bugs` / `insider_wishlist` / `insider_shares`, read
against the code at `9069009` (`main`). Each one: what was reported, what the code
actually does, what it would take, and what it costs.

## The six, at a glance

| # | Kind | From | Date | Verdict |
|---|------|------|------|---------|
| 1 | Bug | Jyllywylly (account) | Apr 20 | **Real, still broken.** iOS Chrome cannot Add to Home Screen; we tell them to anyway. ~2h |
| 2 | Bug | anon | Apr 10 | **Already fixed** (wrong-song guard, 2026-08-07). Residual: dead end instead of wrong audio. |
| 3 | Bug | anon | Apr 10 | **Real, partly mitigated.** iOS first-tap unlock races the gesture window. ~3h |
| 4 | Wish | Seth Bregman (account) | May 11 | **Buildable on existing parts.** Back-to-back versions run. 1–2 days |
| 5 | Wish | anon | Apr 10 | **Already shipped** (Songbook era ladder, 2026-08-21) — but starved of data. |
| 6 | Share | anon | Apr 10 | Testimonial, no action. |

Two submitters are signed-in accounts and can be replied to: **Jyllywylly**
(`2bba96d4…`, joined Apr 20 — submitted within 12 hours of signing up) and
**Seth Bregman** (`0fcd8f56…`).

**Provenance caveat:** submissions 2, 5 and 6 landed anonymously within 90 seconds
of each other (Apr 10, 17:48–17:50 UTC) and read like seeded demo rows. Submission 3
is 70 minutes later and carries specifics a seed would not invent. Treat 2/5/6 as
low-confidence signal; 1, 3 and 4 are unambiguously real.

---

## 1 · "Add to Home Screen" — iOS Chrome (Jyllywylly, landing, iPhone, repeats)

> Was trying to add to my home page. When I press the box "share with friends" CTA
> from the drop down nothing happened. Same with the share with friends box.
> iOS /chrome doesn't have an option to add to Home Screen.

### What's actually happening — three separate faults stacked

**(a) We give iOS Chrome an instruction it cannot follow.** Both install surfaces
branch on `/iPhone|iPad|iPod/`, which is true for Chrome on iOS, and then print
Safari's flow:

- [`SiteHeader.tsx:304`](../../src/components/SiteHeader.tsx) —
  `alert('Tap the Share button (square with arrow) then "Add to Home Screen"')`
- [`PwaInstallBanner.tsx`](../../src/components/PwaInstallBanner.tsx) — same copy in the iOS branch

Only Safari on iOS can install a web app. Chrome/Firefox/Edge on iOS have no such
menu item. The reporter did exactly what we told them and found nothing, which is
what they wrote down.

We already have the detection primitive: [`inAppBrowser.ts:38`](../../src/lib/inAppBrowser.ts)
tests `/CriOS|FxiOS|EdgiOS|OPiOS/`. It just isn't consulted here.

**(b) Two different "Share" buttons, one instruction.** The mobile sheet renders
"Install App" and "Share with a Friend" adjacent
([`SiteHeader.tsx:314–319`](../../src/components/SiteHeader.tsx)), and the alert says
"Tap the Share button". The reporter tapped ours. The landing page has a third
([`Index.tsx:478`](../../src/pages/Index.tsx)) — "Same with the share with friends box."

**(c) When ours failed, it failed silently.** `handleNativeShare` in
[`ShareAppButton.tsx`](../../src/components/ShareAppButton.tsx) catches *every*
rejection as `// user cancelled`. A `NotAllowedError` (lost transient activation —
plausible here, since the button sits inside a `SheetClose` that closes the sheet on
the same tap) is indistinguishable from a real cancel. No toast, no fallback menu.
"Nothing happened" is the literal, correct description.

### What it takes
- Detect iOS-non-Safari; on that branch swap the copy to "Open in Safari to add to
  your Home Screen", with a tap-to-copy link. ~1h.
- Distinguish a genuine `AbortError` from every other rejection in
  `handleNativeShare`; on non-abort, open the existing popover menu instead of
  dying. ~30m.
- Rename the install-sheet copy so "the Share button" unambiguously means the
  browser's. ~15m.
- **Voice check:** this copy is user-facing and lives in an `alert()`. Per the field
  guide it should not read like a tech support macro. Worth a pass from the steward.

### Pros / cons
- **Pro:** first report from a brand-new account, on the very first thing they tried.
  This is the cheapest retention fix on the list.
- **Pro:** a silent-failure share button is costing shares everywhere it renders,
  not just here; the fix is global.
- **Con:** the honest answer ("switch browsers") is a worse experience than the one
  they wanted. Partly offset by the native iOS app, once it ships — which is the
  real fix and is already in flight.
- **Con:** `alert()` is the wrong surface for all of this regardless. Doing it
  properly means a small sheet, which is more than the 2h estimate.

### Also noticed
`PwaInstallBanner` comments "Check if dismissed recently (7 days)" over a
`24 * 60 * 60 * 1000` comparison. It re-pitches daily. One-character class of fix;
decide which number is intended.

---

## 2 · Wrong song plays (anon, builder, iPhone, minor, repeats)

> User pressed play on setlist, song being played is Irvine, 1985, "why don't we do
> it in the road" and it should be playing what is listed "The Golden Road"

### Diagnosis: already fixed, and it was not a bad fuzzy match

Running the shipping matcher against the reported pair:

```
   0  track="Why Don't We Do It In The Road"  song="The Golden Road"
  90  track="The Golden Road (To Unlimited Devotion)"  song="The Golden Road"
  85  track="d1t01 - Golden Road"  song="The Golden Road"
```

`matchScore` scores the reported pair **0**, so the wrong track never won a match —
it was played by a *no-match fallback*. `findArchiveRecording` ends with "Fallback:
return first (era-filtered) result without direct track"
([`archiveOrg.ts`](../../src/lib/archiveOrg.ts)), handing the player a show URL and
`directTrackUrl: null`, and the legacy player then played that recording from
track 0.

Both engines now refuse to do that:

- Legacy — [`AudioPlayer.tsx:241`](../../src/components/AudioPlayer.tsx),
  `let bestIdx = -1;   // no match yet — do NOT default to 0`, gated at score ≥ 60,
  with a comment citing this exact failure class ("Row Jimmy" under a "New Minglewood
  Blues" label).
- Gapless — [`AudioPlayerContext.tsx:455`](../../src/contexts/AudioPlayerContext.tsx)
  treats a resolved-but-trackless slot as a determinate failure: skip with
  "Skipping {song} — not on this tape", or `setPlaybackError("That song isn't on this tape.")`.

Guard introduced 2026-08-07, four months after the report.

### Residual
The bug became a dead end rather than wrong audio. That is the right trade
("silent-wrong-audio is worse than no-audio-with-explanation" — the code says so)
but the coverage gap underneath is untouched:

- `songs` = 233, `notable_versions` = 48, songs with **any** curated version = **26**.
  89% of the catalog has no curated version, so playback falls to a live
  Archive.org phrase search — the path that produced this bug.
- `setlist_slot_playability` covers **188 of 2670** slots (7%); 164 playable,
  16 unresolved, 8 error.

"The Golden Road" *does* have a curated version (1967-03-18, Carousel Ballroom,
`gd1967-03-18.156086.sbd.Flegel.flac1648`) — so the slot the reporter hit had no
`notable_version_id` attached and fell through to search anyway.

### What it takes
Nothing to fix the reported symptom. To close the gap: widen the playability
precompute past 7% of slots, and seed curated versions for the long tail. Days of
data work, not hours of code.

### Pros / cons
- **Pro:** widening precompute removes a live network round-trip from most plays —
  it fixes reliability *and* latency, and reduces the surface of submission 3.
- **Con:** it's ongoing curation, not a shippable change. Budget it as a standing
  chore, not a ticket.
- **Verification gap:** archive.org is unreachable from this session's network policy,
  so the claim about *which* recording that search returns is from code reading, not a
  live probe. The scoring numbers above were run against the real `matchScore`.

---

## 3 · "Songs sometimes don't play on first tap" (anon, builder, iPhone, annoying, repeats)

### Diagnosis: the unlock loses the user gesture

`playSetlist` does the right thing in intent —
`if (engineMode === "gapless") getEngine().unlock();` inside the tap handler, with
the comment "Inside the user's tap — unlock audio before async track resolution
starts."

But `unlock()` does not run inside the tap:

```ts
unlock(): void {
  this.enqueueOp(async () => {
    if (!this.queue) this.queue = await this.createQueue();
    await this.queue.resumeAudioContext().catch(() => undefined);
  });
}

private enqueueOp(fn) { this.op = this.op.then(fn).catch(...); }
```

`enqueueOp` chains onto a promise, so the body runs in a microtask *at best* — and on
the first tap of a session there is no queue yet, so it `await`s `createQueue()`
before reaching `resumeAudioContext()`. WebKit requires `AudioContext.resume()` to be
called synchronously within the activation window; by then it is gone. That is a
precise account of "**sometimes** doesn't play on first tap": it's the first tap,
before a queue exists.

### Already mitigated, not fixed
`onPlayBlocked` → `autoplayBlocked` → the "Tap to start the tape" affordance
([`GaplessPlayerBar.tsx:165`](../../src/components/GaplessPlayerBar.tsx)) shipped in
`5f4d91e` ("Give the iOS player a way to fail, and a way back in"). The user is no
longer stranded — they just have to tap twice, which is what was reported.

### What it takes
Hoist the synchronous part out of the op queue: construct the `AudioContext` eagerly
at engine construction and call `resume()` directly in `unlock()`, before any
`await`, leaving only queue creation on the chain. ~3h including a regression test
that the first tap resumes synchronously. Needs verification on a real iPhone —
jsdom will not catch this, and `resolvePlayerEngine()` downgrades to legacy without
`AudioContext`, so the gapless path is untested in the suite by construction.

### Pros / cons
- **Pro:** first-tap play is the core interaction. A double-tap tax on every cold
  start is a silent conversion leak on the surface we most want to feel effortless.
- **Pro:** the fix is contained to one method in `gaplessEngine.ts`.
- **Con:** touching audio unlock on iOS is where regressions hide, and the existing
  "Tap to start" net means the current state is survivable. This should go through
  `/pre-release` with device verification, not ride along with something else.
- **Con:** precompute coverage (see #2) shortens the resolution window and would
  mask, not fix, this. Don't let that be the answer.

---

## 4 · Back-to-back versions of the same song (Seth Bregman, May 11)

> one thing i'd like to hear are back to back versions of the same song — from the
> same tour or different tours

### Assessment: the best idea in the box, and most of it is already built

This is the "aha moment" mechanic from §4 of the field guide pointed at a single
song instead of a night. It also happens to be composable from parts that landed
in the last month:

- `findManyArchiveRecordings(title, max, yearStart, yearEnd)` already returns up to
  50 rated recordings narrowed to a year window — the "same tour vs. different
  tours" axis is a parameter we already pass
  ([`d412ed2`, "Add year-range dig-deep to the song version browser"](../../src/components/SongVersionBrowser.tsx)).
- `playSetlist(slots)` takes an arbitrary `PlayableSlot[]`. Slot ids need not be real
  UUIDs — `lookupPrecomputedPlayability` returns null for synthetic ids and falls
  through to live resolution, and `Song.tsx` already builds synthetic slots
  (`share-${song.id}-${version.id}`).
- `SongEraLadder` and `SongVersionBrowser` both already list versions; today each
  play button fires one version at a time.

So the work is a mapper (`LadderVersion[] | ArchiveVersion[] → PlayableSlot[]`, via
`SYNTHETIC_VERSION_DEFAULTS` per the repo's own correction) plus a "play these N"
entry point and a small selection UI.

### What it takes
**1–2 days** for a first cut:
- Multi-select (or "play the top 5") on the era ladder and the dig-deep list.
- Map to `PlayableSlot[]`, hand to `playSetlist`.
- Player bar labelling that distinguishes versions of one song — date and venue must
  lead, since the title is identical down the whole queue. The lock-screen work
  (`0b693af`, `a7e784b`) already put date + venue on the artist line, so this is
  mostly reuse.

### Pros / cons
- **Pro:** directly on-mission. The field guide's whole thesis is structural/energetic
  listening — jamminess, length, era, lineup — and an A/B of the same song across
  two tours *is* that argument, made by the music instead of by copy.
- **Pro:** no new dependency (`bun install` is unusable outside Lovable's registry per
  CLAUDE.md), no schema change, no edge function.
- **Pro:** it is additive to the ecosystem in exactly the way the guide asks — this is
  what headyversion arguments sound like when you can actually hear them.
- **Con:** it rides the weakest path we have. Each version resolves live against
  archive.org, and every score-0 track gets skipped with "not on this tape". A
  5-version run is 5 round trips and a real chance of holes. It will feel worse than
  setlist playback does until precompute coverage (#2) improves.
- **Con:** curated data can't carry it — only 26 songs have any `notable_versions`, so
  most runs come from live search, where the "same tour" filter is an
  archive.org date range, not a tour we actually model. Calling it "same tour" would
  be a claim we can't back. "Same year" / "same run" is honest.
- **Con:** queue semantics need a decision — does a versions run replace the setlist
  queue or sit beside it? Cheapest correct answer is: it replaces, same as
  `playSetlist` does today.
- **Reply-worthy:** Seth opened with "i should cruise around more before making
  requests." He should be told the dig-deep browser already gets him partway, and
  that this is being built.

---

## 5 · Setlist timeline of how songs evolved over eras (anon, Apr 10)

> Top request: A setlist timeline showing how songs evolved over eras
> What works: The poster design is beautiful
> Bigger picture: The go-to hub for the Dead community

### Assessment: shipped, but nearly empty

[`SongEraLadder`](../../src/components/SongEraLadder.tsx) — "every ranked version of
one song, grouped by the era it belongs to, so a listener can hear the song change
shape across the band" — shipped 2026-08-21 in `480b66f` (The Songbook). Desktop gets
a proportional 1965–1995 timeline; mobile gets a vertical spine with eras hanging off
it. It's live at `/song/:songId` and `/songbook/:slug`.

That is the request, answered, four months later, with nobody told.

**The problem is the data, not the feature:**

| | |
|---|---|
| songs | 233 |
| songs with any `notable_versions` | **26** (11%) |
| total `notable_versions` | 48 |
| versions with an `archive_org_url` | 35 |
| versions missing `era_id` | 2 |
| eras | 7 |

Average of under two versions per covered song. A ladder needs several versions
across several eras before it shows evolution at all; today most songs render an
empty or one-rung ladder.

### What it takes
Nothing structural. Curation: get to ~8–10 versions spread across eras for the top
~40 songs (≈350 rows). The `vote_source` / `votes` columns suggest headyversion-style
ranking was the intended import path — worth confirming before hand-entry, and worth
crediting prominently if we do lean on it.

### Pros / cons
- **Pro:** highest leverage per hour on the list. The engine is built; every row added
  makes an already-shipped feature work.
- **Pro:** the same rows fix submission 2's fallback problem and de-risk submission 4.
  One data push, three payoffs.
- **Con:** it's slow manual work with no ship moment.
- **Con:** if it's sourced from another community's rankings, the stewardship posture
  matters — point back with respect, don't quietly absorb.

---

## 6 · Barton Hall 5/8/77 (anon, Apr 10)

> Favorite show: Barton Hall 5/8/77 · Songs: Scarlet Begonias, Fire on the
> Mountain, Dark Star · "It helps me rediscover the magic of live Dead"

No action. Testimonial, and "rediscover the magic of live Dead" is usable language
if it's genuine — but given the 90-second cluster with #5 and #2, confirm provenance
before quoting it anywhere.

---

## Recommended order

1. **#1, iOS Chrome install** — ~2h, real user, first impression, fix is known.
2. **#5/#2 data push** — start it now and let it run; it unblocks three items.
3. **#3, first-tap unlock** — ~3h + device verification through `/pre-release`.
4. **#4, versions run** — 1–2 days, best idea here, but land it after the data push
   so it debuts on a path that holds.
5. **Replies** — Jyllywylly and Seth are signed-in and reachable. #5's submitter is
   anonymous; the shipped era ladder is worth a Backstage/dispatch note regardless.

## Process gap worth naming

Five months of submissions, two of them answered by shipped work, and no submitter
was ever told. There is no state on these rows — no status, no replied-at, no
linked commit. A `status` column and an admin view would cost an afternoon and would
have caught this. Worth deciding before the next intake.
