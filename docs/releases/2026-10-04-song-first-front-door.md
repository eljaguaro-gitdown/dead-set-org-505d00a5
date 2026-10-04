# The song-first front door — a two-week experiment

**Shipped:** 2026-10-04 · **Review:** 2026-10-18 · **Owner:** Jay

This is not a feature note. It is a bet with a date on it, written down before
the result is known so the review cannot be graded against a story invented
afterwards.

---

## What changed

Dead Set's front door was *build a setlist*. It is now **pick a song you love**.

A visitor lands, names a song, and arrives at `/versions/:slug` — the first
time the Dead ever played it, the last time, the nights in between worth an
evening, and a play button that needs no account. Saving or sharing asks them
to sign in; listening never does.

Shipped alongside it:

- **The Songbook fills itself.** The first listening guide anyone builds for a
  song becomes that song's community entry, credited to them. The editorial
  series stays a separate tier.
- **Quiet gems.** For the 232 of 234 songs no fan poll covers, archive.org's
  rating read against its download count surfaces tapes held high and rarely
  pulled.
- **An Instagram asset** drawn per song, and share text that names what is
  being passed on.

## Why

Two numbers set this up.

**2 of 234 songs** have fan-vote data. Both are hand-written Songbook issues of
~144 lines of SQL each. At one issue a week against a repertoire of ~523 songs,
the series alone is a decade of Sundays. The catalog was never going to fill
from the top.

**The old front door asked for work before it gave anything.** "Build a
setlist" is a project. "Pick a song you love" is a thought someone already had
on the way in.

## The bet

> A visitor who hears something in the first thirty seconds comes back.
> A visitor asked to build something first does not.

If that is right, play rate per landing visitor goes up and the share and
sign-in that follow go up with it. If it is wrong, we will see traffic reach
the picker and stop there — looked, did not listen — and the answer is the
page, not the premise.

## What to measure

Read these in **PostHog**, never `page_visits` — that table has no hostname and
counts every Lovable preview reload as a fan. Use the shared filter in
[`supabase/functions/_shared/posthogQuery.ts`](../../supabase/functions/_shared/posthogQuery.ts).

**Primary — does the front door work?**

| | event |
|---|---|
| Reached the picker | `version_picker_viewed` |
| …and pressed play | `version_picker_played_debut` |

The ratio between those two is the experiment. Everything else is detail.

**Secondary — does hearing it make them act?**

- `version_picker_shared` · `version_picker_instagram` — did it move them enough to pass on
- `version_picker_guide_saved` — did they keep it
- `songbook_entry_contributed` — did the catalog grow *by itself*, which is the
  long game
- `songbook_community_opened` — does anyone read what other people mapped

**Guardrail — what might this have cost?**

- Builder starts and setlists created. The builder is still the deeper product;
  if the new door starves it, that is a finding, not a win.
- Sign-ins. The share gate is softer than before — a plain link now needs no
  account — so sign-ups could fall even while sharing rises. That trade was
  deliberate: a public URL is two taps out of the address bar, so the old wall
  was a toll booth beside an open gate.

## Baseline, taken 2026-10-03

Record it here so the review is not argued from memory:

- 780 play events all-time, 219 in the trailing 30 days
- 140 distinct songs ever played
- 242 public setlists · 45 distinct creators
- 55 favorited songs
- 2 Songbook issues · 0 community entries
- 2 of 234 songs carrying fan-vote data

## How to read it on 2026-10-18

Run `/growth-weekly` and ask for this file by name.

Three honest outcomes:

1. **Play rate up, builder flat or up** → the door works. Fill the catalog next:
   the setlist.fm backfill and more Songbook issues.
2. **Picker views up, play rate flat** → they came and did not listen. The
   problem is the page, not the premise — look at where the scroll dies.
3. **Everything flat** → the front door was not the constraint. Two weeks is
   enough to say so, and cheap compared to a quarter spent assuming otherwise.

A fourth, worth naming because it is the easiest to miss: **play rate up,
sign-ins down.** That is the softened share gate doing exactly what it was
designed to do. Whether it is a win depends on whether the shares bring anyone
back — look at new visitors arriving on a `/versions/` URL.

## Known gaps on launch day

Stated plainly so the review does not mistake them for results:

- **Link previews are generic.** Every shared Dead Set URL unfurls as "Every
  Deadhead knows the feeling" with the Cosmic Charlie artwork, whatever page it
  points at — the app is a single page and a crawler gets `index.html`'s static
  meta. Shares will under-convert until per-route meta exists.
- **`ai-deadhead` needs a separate deploy.** Charlie returned 2 picks for a song
  played 382 times; the fix is merged but a Lovable Publish ships the frontend
  only. Until the function deploys, songs with no catalog entries look thin.
- **The Songbook community tier needs its migration applied.** Without it,
  contributions fail silently — by design, so a saved guide never reads as
  failed, but the shelf will not fill.
