# Instagram feed carousel: the version picker (Shakedown Street)

**Date drafted:** 2026-10-04
**Sender:** jay (posts by hand tonight; nothing here is sent by the support desk)
**Channel:** Instagram FEED carousel, @grateful_jaguaro. No Stories.
**Worked example:** Shakedown Street, at dead-set.org/versions/shakedown-street
**Success metrics:** saves, bio-link taps, DM conversations. Never follower count.

**Bio link for the next few days:**
`https://dead-set.org/?ref=instagram-bio&utm_source=instagram`
(slug confirmed from `songSlug("Shakedown Street")` in `src/lib/__tests__/songSlug.test.ts`). Please confirm the tag is in the profile settings before posting.

---

## BEFORE YOU POST: fill these from your own screen

Three numbers are deliberately left blank. They come from the app's catalog, I could not reach the database from this session, and a wrong number on a post about honest tapes is the error this project has already banked a correction about.

| Placeholder | Where to read it |
|---|---|
| `[N]` | The "Played ... times" figure at the top of /versions/shakedown-street |
| `[FIRST YEAR]` | The "First played" year, same block |
| `[LAST YEAR]` | The "Last played" year, same block |

Do not copy these from this repo. The repo disagrees with itself on the play count (163 in the Songbook migration and Dispatch 004, 165 in a test fixture). Whatever your screen says today is the number.

---

## PRIMARY caption

```
Hey Now. Pick a song you love and see the night it began, the night it ended, and the nights worth an evening between.

We're starting with Shakedown Street: [N] times played across [FIRST YEAR] to [LAST YEAR]. First time played, last time played, each with its date and venue. Where a tape of that night circulates, it's one tap to hear it, no account needed. Where none does, the screen says so plainly: the date is on record, the music isn't.

In between, a row of nights to choose from, a few of them quiet ones the crowd walked right past. Keep the ones you love as a listening guide: the first time opening it, the last time closing it, every night with its own tape.

None of this exists without the tapers who stood in the crowd with their rigs, the traders who kept the reels moving, and the Internet Archive that gave every tape a home and still keeps the door open. That's where this music lives. We're just one more way in.

The votes behind the ranking are headyversion's, and the long arguments live over there. For whole shows, Relisten. Go say hello.

Link in bio: pick the song you'd walk a mile for.

Wake. Now. Discover. 🌹

— grateful_jaguaro
```

First line, which has to work alone before the "more" cut (118 characters):
`Hey Now. Pick a song you love and see the night it began, the night it ended, and the nights worth an evening between.`

## SHORT alternative caption

```
Hey Now. Pick a song you love and see the night it began, the night it ended, and the nights worth an evening between.

Shakedown Street, first time played to last. Every tape behind it is the work of the tapers, the traders and the Internet Archive.

Link in bio: pick the song you'd walk a mile for. 🌹

Wake. Now. Discover.

— grateful_jaguaro
```

## First comment (hashtags go here, not in the caption)

```
#gratefuldead #deadhead #shakedownstreet #jerrygarcia #livemusicarchive #internetarchive #relisten #tapers
```

If you want a clickable path in the comments, the link goes in the same comment, tagged for the post:
`https://dead-set.org/?ref=instagram-post&utm_source=instagram`

---

## Carousel plan and per-slide alt text

Alt text is written from the page's real labels and layout (`src/pages/VersionPicker.tsx`). I have not seen your screenshots, so anything in `[brackets]` is something to read off the image and fill in, and each slide should be checked against what is actually in frame. Alt text describes what is visible; it does not repeat the caption.

### Slide 1. The Shakedown picker

Capture: top of the page, phone width, cream sheet, before scrolling.

> Phone screenshot of a Dead Set song page on a cream sheet. A small line reads "Every version worth knowing" above the large title "Shakedown Street", with a Share button at the right. Below it, a row of figures: Played [N] times, First played [FIRST YEAR], Last played [LAST YEAR]. Under that, a large round gold play button beside the label "[label as on screen]" and a handwritten-style date in blue, [DATE], with the venue, [VENUE], in smaller type.

Check the label. For a song with a known debut the screen reads "The very first time they played it". The line "Start with the one they all name" only shows when a song has no debut date on record. See flag 2.

### Slide 2. First time played / Last time played

Capture: the line running from the first time to the last time, plus the milestone row if it is on screen.

> Close view of one line across the page. At the left, the label "First time played" over a large handwritten-style blue date, [DATE]. At the right, the label "Last time played" over [DATE]. Beneath, a thin horizontal rail with a tall gold tick at each end, decade marks reading [DECADES], and a scatter of small round dots, one for each night on the page.
>
> [If a milestone row is in frame: A dashed-outline card with a chip reading "[First time played / Last time played]", the date [DATE], and the venue [VENUE · CITY]. Either a gold play button sits at its right, or the card carries an italic line reading "No tape of this night circulates — the date is on record, the music isn't."]

### Slide 3. The nights to choose from

Capture: two or three night cards from the list, ideally one with a chip.

> Three stacked cards, each a night to choose from. Each shows a large handwritten-style blue date, [DATE], the venue and city beneath it in typewriter type, and a round gold play button at the right. Under the date, a thin bar and a vote count, [VOTES] votes. Small tags along the bottom read [TAGS AS ON SCREEN, for example the era name, "Era benchmark", "Sleeper"]. The card for [DATE] is marked "[Sleeper / Quiet gem]".

Read the chip off the screenshot. On Shakedown it will say Sleeper, not Quiet gem. See flag 1.

### Slide 4. The kept listening guide

Capture: the saved guide page for a Shakedown guide you saved, top of the page.

> A saved listening guide titled "Shakedown Street — Listening Guide". It lists nights in reading order, each with a short note. The first entry is marked "First time played" with its date and venue, [DATE · VENUE], and the last entry is marked "Last time played", [DATE · VENUE]. [Note whether any entry carries the line "No tape of this night circulates — the date is on record, the music isn't."] The nights between are each listed with their own date and venue.

Check against the screenshot. I did not view how the saved guide renders, only how its notes are written.

### Slide 5. The Archive and taper credit card

This is a designed card, not a screenshot. Suggested text, reusing the landing page's own credit wording (`HeroSection.tsx`) so the two match:

```
A love letter to
the tapers, the traders, and the Internet Archive.

Without their fifty years of devotion, none of this would exist.
The music lives at archive.org, and the tradition lives in the sharing.

Wake. Now. Discover.
```

> A card with the small line "A love letter to", then in large type "the tapers, the traders, and the Internet Archive". Below, smaller: "Without their fifty years of devotion, none of this would exist. The music lives at archive.org, and the tradition lives in the sharing." The tagline "Wake. Now. Discover." sits at the bottom. [Add one line on colour and typeface once the card is designed.]

---

## Hashtag set: eight, and why

`#gratefuldead #deadhead #shakedownstreet #jerrygarcia #livemusicarchive #internetarchive #relisten #tapers`

- **#gratefuldead, #deadhead**: the broad rooms where the people we want already are. Maya finds the post here. Check that #deadhead is not drowning in gardening posts (deadheading plants) before you keep it.
- **#shakedownstreet**: the song itself. This is the tag that finds someone mid-thought about this exact song, which is the whole premise of the post.
- **#jerrygarcia**: the name most listeners search when they are looking for a night.
- **#livemusicarchive, #internetarchive**: the Archive's own names. They put the credit in the tag layer as well as the caption, and they reach the tapers and traders (Russ).
- **#relisten**: the app most of Dave's circle already listens in. It points back to the neighbours and keeps us additive.
- **#tapers**: the community's own word for the people the post is thanking.

Left out on purpose: #deadandcompany (a different era and a different crowd than 1978-95 tapes), and generic reach tags such as #music, #rock, #vinyl, #fyp. Those are genre words and noise.

**What I could not do:** this session has no Instagram or web access, so none of these were checked against live post counts or what the tags currently surface. They come from the community's known vocabulary and this project's own house language. Spend two minutes searching each in the app tonight and drop any that surface off-topic content.

---

## Voice check (run on both captions, the alt text and the card)

- Banned vocabulary: swept the primary, the short caption, all alt text and the card text for every word on the list in the brief. Nothing present, and nothing denied either.
- Cosmic Charlie: not mentioned.
- Music described by structure (the first time, the last time, nights in between), no genre adjectives.
- Tapes "circulate" or are "on tape"; the word "available" does not appear.
- Archive, tapers and traders are credited in the caption body above the sign-off, in the short caption, and on slide 5.
- Additive: headyversion and Relisten named with thanks, nothing comparative.
- Tagline "Wake. Now. Discover." (W-A-K-E). Salutation "Hey Now". Handle grateful_jaguaro, lowercase. Two emoji total (one rose per caption).
- No debut date, retirement date or play count stated anywhere.

---

## FLAGS for Jay

1. **Shakedown will not show a Quiet gem chip.** This is the one that matters. In `VersionPicker.tsx` the quiet-gem lookup runs only when a song has no fan-vote data (`if (!song || hasVoteData(versions) ...) return`). Shakedown Street has fifteen ranked nights with votes from headyversion (migration `20260821120000_songbook.sql`), so its cards carry "Era benchmark" and "Sleeper" tags instead. A sleeper is a night that polls under 30% of the leader on fan votes; a quiet gem is a tape held high and pulled least. They are different claims. I wrote the caption and slide 3 so both are true ("quiet ones the crowd walked right past") and left the chip as a read-it-off-the-screen placeholder. Your options: (a) keep Shakedown and let slide 3 show Sleeper, which is what is honest; (b) show a Quiet gem on slide 3 using a different song that has no poll, which breaks the single worked example. I recommend (a). This is read from the repo as it stands; I cannot see which sha is serving dead-set.org, so check `/admin` (GitHubSyncBadge) if you want it confirmed.
2. **"Start with the one they all name" will probably not be on your slide 1.** That label renders only when a song has no first-played date. Songs with one lead with "The very first time they played it". The Merriweather night leads the votes, but the page does not name it as the consensus pick on this song. I kept that label out of the caption. If you want it in the post, it needs a screenshot that really shows it.
3. **No-tape wording.** The line that sits on the page is "No tape of this night circulates — the date is on record, the music isn't." The phrasings "No tape of this night circulates yet" and "No tape of the debut circulates — starting with the next best thing" are brief toasts that appear on tap and vanish. The caption paraphrases the persistent line. If you want the debut toast on a slide, it has to be caught mid-screen. Whether a debut tape circulates for Shakedown, I do not know.
4. **Numbers.** `[N]`, `[FIRST YEAR]` and `[LAST YEAR]` are yours to read off the screen. The repo carries 163 and 165 for the play count in different places.
5. **The /versions/ page carries no Archive credit.** The caption body and slide 5 supply it. Nothing in the post says the page credits the Archive, so the post does not overstate the page. Worth a ticket for a credit line on the page itself; I do not touch `src/`.
6. **headyversion is named in the caption.** For Shakedown the ranking is sourced from headyversion votes per the migration. On the page that source is visible only inside the collapsed "the arithmetic" disclosure. Confirm you are happy naming them, and consider letting them know. This is a courtesy, not a legal question. Nothing in this post touches the Archive relationship beyond credit, so I have not escalated anything.
7. **Alt text is unverified against images.** Slides 1 to 4 are described from the page's code and labels, not from your captures. Instagram's own alt-text length limit is something I could not confirm; each block is kept short (about 60 words) in case.
8. **Experiment window — DESTINATION CHANGED, and this note is why.** The front door has a review date of 2026-10-18 (`docs/releases/2026-10-04-song-first-front-door.md`). An earlier version of this brief sent traffic straight to `/versions/shakedown-street`, which would have lifted "reached the picker" without the landing page having done any of the work — measuring past the very thing under test. **Jay's call, adopted: the link goes to the front page**, `https://dead-set.org/?ref=instagram-bio&utm_source=instagram`. The landing search field already reads "Dark Star, Shakedown Street…", so a reader arriving from a Shakedown post is met with Shakedown suggested in the box and message match survives. Expect a lower absolute count at the picker than a deep link would have produced — that gap IS the front-door measurement, not a loss. The `ref=instagram-bio` and `ref=instagram-post` tags are what let the growth review separate this cohort. Please keep them on.
9. **Hashtags** are not checked against live counts (see above).
10. **File location.** You asked for `docs/community/`; my usual home for briefs is `community/briefs/`. Move it if you want it alongside the others.

## What to watch after posting

- Saves on slide 5 and slide 1. Slide 5 is the credit card; if it is the most-saved slide, the stewardship framing is landing.
- Bio-link taps in the 48 hours after, split by `ref=instagram-bio`.
- DMs that name a song. Each one is a conversation for the human steward, and the song names go to the Friday priority list.
- Any words Deadheads use in comments for the quiet nights ("buried", "overlooked", "sleeper"). Send those to the lexicon proposal pile.
