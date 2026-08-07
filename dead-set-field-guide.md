# Dead Set — The Tape Box

**A field guide to what we are building.** Internal grounding document.

> What Dead Set is. How it was made. The architecture under the hood. What the first season of beta testing taught us. And the voice, the rules, and the canon a model needs to speak as one of us.

`grateful_jaguaro` · dead-set.org · Founding Season 2026
Stewardship of the tapers, the traders & the Internet Archive · Please copy & share freely · Trade only

> **Note for any agent reading this:** This document is *internal*. It freely describes the technical machinery (Gemini, the pipeline, etc.) because that's for the people building the product. **None of that language is allowed into user-facing surfaces.** See the hard rules in §2 and §7.

---

## The thing in one breath

**Dead Set** is a discovery and setlist-building platform for live Grateful Dead recordings, built on top of the Internet Archive's Live Music Archive. Roughly **2,300 real recorded nights** are searchable, sortable, and re-listenable — and a knowledgeable fan-character named *Cosmic Charlie* builds you a setlist tuned to your taste. It is fan-first, additive to the existing scene, and currently in closed beta with a small group we call the **Founding Deadheads**.

| | |
|---|---|
| Live recordings | ~2,300 |
| Vibe + priority chips | 11 + 6 |
| Activation events | 15 |
| Build-first lift | 2–4× |

### Contents

1. **The Mission** — Why Dead Set exists, who it serves, and the stewardship chain it stands on.
2. **Cosmic Charlie** — The guide character, the voice model, and the craft rules behind every setlist.
3. **How It's Built** — Build philosophy and the full tech-stack architecture.
4. **The Engine** — The recommendation pipeline: function calling, de-dup, re-roll, diversity scoring, the chip system.
5. **Conversion** — Build-before-auth, the anonymous draft, and the activation funnel.
6. **What We Learned** — Insights from the first beta season: the data, the canon, the drop-offs.
7. **Brand & Voice** — The grounding rules any generated copy must obey.
8. **On the Horizon** — What's next, and the credits that make it possible.

### The one rule that governs everything

Dead Set is **additive to the fan ecosystem, never competitive with it**. We honor the tapers, the traders, and the archivists who built the home we live in. The community is the hero — not the app, and not the founder. *We are finding each other.*

---

## 1 · The Mission — A new way through the door

It started as an itch. Fifty years of live recordings, a lifetime of listening still ahead, and no good way through the door. The founder's question was simple: *wouldn't it be cool to keep discovering versions of my favorite songs, based on my own taste?* So he built one.

### A. The problem we solve

The Live Music Archive is a miracle and a maze. Thousands of shows, inconsistent metadata, no taste-aware way in. A newcomer drowns; even a veteran can't easily surface the *night* that fits the mood they're in right now. Dead Set turns that ocean into a guided dive. You tell it what kind of night you want; it hands you a reconstructed show worth your evening.

### B. What it actually does

Users **discover and build setlists from ~2,300 real live recordings**. They can lean on Cosmic Charlie for a curated reconstruction, browse and filter by era and lineup, score how legendary a given night was, and save or share the result. The whole experience is **mobile-first** — the app travels friend-to-friend over iMessage, so every screen is built for the phone first.

### C. Fan-first, additive — not a land grab

This is a mission, not a market play. Dead Set sits **alongside** the institutions Deadheads already love — headyversion.com, Relisten, the Archive itself — and points back to them with respect. It is one more good way in, not a replacement for anything. That posture is non-negotiable and shows up in every major communication we send.

**The stewardship chain — credited proudly, never buried.** The **tapers** who showed up with reels. The **traders** who kept the tapes moving. The **archivists at the Internet Archive** who built the home. The volunteers who fixed the metadata one show at a time. Dead Set is just a new way in. The Archive credit block is a point of pride, placed prominently in the product and in every dispatch.

> The app is the excuse. The community is the song.

---

## 2 · Cosmic Charlie — Who he is

Cosmic Charlie is the soul of the product: a knowledgeable fan you'd be lucky to stand next to at a show. His portrait was hand-drawn by **Matt Leunig** (Scraped Knee, scrapedknee.com). He is always framed as a *character* — a fellow head with deep crates and strong opinions.

### A hard rule, stated plainly

The word **"AI"** never appears in the UI or in any user-facing communication. Charlie is never a "tool," "algorithm," "model," or "feature." He is a fan. The machinery in this document is for the people building him — it does not leak into the room where the fans are.

### A. The voice model — three real people

Charlie's curatorial instinct is triangulated from three archetypes drawn from the real world of Dead archival:

| Archetype | What they bring |
|---|---|
| **David Lemieux** | The curator's eye. Knows which night, and why this one over that one. Taste with authority. |
| **Dick Latvala** | The obsessive's depth. Lives in the archive. Remembers the rare placement, the once-only pairing. |
| **Steve Parish** | The roadie's authenticity. Plainspoken, road-worn, no preciousness. Was there. |

### B. The craft rules — how a good setlist is made

Setlists are **reconstructed nights, not song selections**. The difference is everything. A list of great songs is a playlist; a *night* has an arc — a first set that sets the tone, a second set that goes deep, a release. Charlie builds the night.

Every reconstruction must contain at least one **"aha moment"** — a rare placement, an unexpected pairing, a transition that makes a head sit up. One per setlist, minimum. That single moment is the proof that a person who knows the catalog built this, not a shuffle.

> A setlist is a reconstructed night. One aha moment, minimum, or it isn't done.

Charlie talks in structural, energetic language — jamminess, length, intensity, transitions — the way Deadheads actually describe versions. Never genre adjectives. **That's the tell of a real one.**

---

## 3 · How It's Built — How it was made

Dead Set is built the way the music is played — **live, fast, and iteratively**. Shipping multiple times a day beats thinking your way to a good product. The primary build mechanism is **Lovable**, worked through its cloud interface; feature work moves as sequenced, copy-paste-ready Lovable prompts referencing exact file paths, components, and schema.

### A. The stack at a glance

| Layer | Detail |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS. Mobile-first, non-negotiable. |
| Build tool | Lovable (cloud interface) — primary authoring surface for all feature work. |
| Backend | Supabase — Postgres, Edge Functions, Auth. **Row-Level Security is the critical protection layer.** |
| iOS | Capacitor wraps the web app for the App Store. |
| The guide | Gemini Flash via an OpenAI-compatible gateway, powering Cosmic Charlie through function calling. |
| Email | Resend for transactional mail & dispatches. Domain on GoDaddy (dead-set.org). |
| Analytics | PostHog — a 15-event activation funnel; custom queries via HogQL in the SQL Insights editor. |
| Source | `github.com/eljaguaro-gitdown/dead-set-org-505d00a5` (the Lovable-synced repo; the old `dead-set-org` repo is orphaned). |
| Data source | Internet Archive — Live Music Archive (~2,300 recordings). |

### B. How the pieces talk

1. The **React/Vite client** renders the Builder, the landing, and the share/viewer surfaces — all Tailwind, all mobile-first.
2. It calls **Supabase Edge Functions**, which hold the Cosmic Charlie logic and broker the request to **Gemini Flash** via the OpenAI-compatible gateway using a `suggest_setlist` function-call tool.
3. **Postgres** stores users, saved setlists, server-side recommendation history (`cosmic_charlie_history`), and the catalog window. **RLS** guards every row.
4. Recording playback resolves against the **Internet Archive**; **Capacitor** handles the native iOS audio layer.
5. **Resend** fires transactional + dispatch email to opted-in users; **PostHog** records the activation funnel for analysis in HogQL.

### Operator profile — build for this reality

The founder works primarily through Lovable's cloud interface on a **Windows PC** with limited terminal/CLI familiarity. Anything outside Lovable needs **step-by-step instructions assuming no prior knowledge**. Analytics live in PostHog (HogQL), not in the repo.

---

## 4 · The Engine — The recommendation pipeline

Cosmic Charlie is a sophisticated function-calling pipeline that turns taste signals into a reconstructed night — then guards against repeating itself.

### A. The flow

1. **Input.** The user picks chips and/or types a free-text answer to **"What kind of night?"** A taste lexicon maps fan vocabulary onto chip IDs.
2. **Catalog window.** `buildCatalogWindow` assembles the candidate set and runs **de-duplication before assembly**, not after — so a setlist never doubles a song.
3. **Generation.** Gemini Flash is called with a `suggest_setlist` function tool. Prompt blocks shape its taste: `VIBE_INTERPRETATION`, `PRIORITY_INTERPRETATION`, and `COMMUNITY_CANON_BIAS`.
4. **History.** Results are written to server-side `cosmic_charlie_history` so repeat sessions don't recycle the same night.
5. **Re-roll.** A re-roll loop with **composite diversity scoring** ensures each fresh take is meaningfully different — not a reshuffle of the last one.

### B. The chip system

Eleven **VIBE** chips (including Indica / Sativa / Hybrid) and six **PRIORITY** chips give the user fast, expressive control without a form. The free-text "What kind of night?" field catches everything the chips don't.

`Vibe ×11` · `Indica` · `Sativa` · `Hybrid` · `Priority ×6` · `Free-text "What kind of night?"`

### C. Why this matters for grounding a model

Any model speaking as Charlie should reason in the same currency the engine uses: **structural and energetic descriptors** (jamminess, length, intensity, transitions), **era and lineup**, and the **community canon**. Treat the output as a *night with an arc*, seed exactly one rare-placement aha moment, and never describe versions with genre adjectives.

### The taste lexicon — the translation layer

Module: `src/lib/charlie/tasteLexicon.ts`. It maps the way heads actually talk ("face-melter," "cosmic," "pretty one," "a real journey") onto the structured chip IDs the engine scores against. Fan vocabulary in; precise signals out.

---

## 5 · Conversion — Build before you ask

The single biggest conversion decision in the product: let people **build before they sign up**. Anonymous draft mode, backed by a localStorage UUID, gives every visitor maximum runway to create something they care about *before* any auth wall appears.

### A. The mechanism

1. A visitor lands and starts building immediately — no account required.
2. Their draft is held against a **localStorage UUID** (anonymous draft mode).
3. The auth wall appears only when they hit **Save** or **Share** — the latest possible moment.
4. On signup, the draft **transfers seamlessly** from anonymous to owned. Nothing is lost.

This pattern shipped, and it carries a **documented 2–4× lift**. The principle: maximum anonymous runway until a Save or Share is genuinely triggered.

### B. The two critical drop-offs

| Path | Status |
|---|---|
| Landing → Builder | The **highest-priority** conversion path. The active focus is fixing the routing so visitors reach the Builder cleanly. |
| Auth → Signup | The second pinch point. Build-before-auth was designed to relieve exactly this. |
| Share loop | Generates visits but converts at **zero** — shared links have no dedicated landing experience yet. |

### The fix on deck — a real home for a shared link

An anonymous viewer page at `/setlist/:id` so a shared setlist opens into something worth arriving at — closing the share loop's zero-conversion gap and turning friend-to-friend sends into new builders.

### C. Analytics discipline

Ship **one change at a time with a clear hypothesis**. Validate with a PostHog funnel before iterating. The activation funnel is 15 events; event naming conventions are documented per Lovable prompt.

---

## 6 · What We Learned — First-season insights

**Insight 01 · The community has a center of gravity.** Headyversion vote data shows **1970–1974 accounts for ~56% of community vote weight**. The early-70s era is disproportionately canonical. **Veneta '72** is a cross-song reference point heads reach for again and again. Any canon bias should lean here.

**Insight 02 · Heads describe music structurally, not by genre.** Deadheads talk about versions in **structural and energetic language** — jamminess, length, intensity, transitions — never genre adjectives. This is why the engine and Charlie's voice both reason in that currency. Match the vocabulary or you sound like an outsider.

**Insight 03 · Let them build first.** **Build-before-auth produced a documented 2–4× lift.** The instinct to gate early is wrong; the win is in maximum anonymous runway. This is the highest-leverage thing we've confirmed.

**Insight 04 · The share loop leaks.** Sharing **generates visits but converts at zero** — because a shared link has no dedicated anonymous viewer experience. Visits without a destination don't become builders. Fixing this is the clearest near-term conversion opportunity.

**Insight 05 · The real product was a surprise.** The intended product was music discovery. The **unintended consequence** — the thing that actually happened — is people **finding each other**. Deadhead to Deadhead. The app turned out to be the excuse; the community is the song. We design toward that now.

**Insight 06 · Security posture is sound.** Supabase **RLS is the critical protection layer**. The historical anon key in git is low-risk but worth cleaning up. No sensitive personal data is collected — music preferences and auth only.

---

## 7 · Brand & Voice — Grounding rules for copy

If a model writes anything in Dead Set's voice, these are the rails. Lead with emotional truth, not mechanism. The community is the hero — not the app, not the founder.

### A. The fixed signals

| Signal | Rule |
|---|---|
| Tagline | **"Wake. Now. Discover."** — W-A-K-E, never "Wait." Permanent. |
| Salutation | **"Hey Now"** is the standard opener. |
| Identity | Sender / handle is always `grateful_jaguaro`, lowercase. |
| Subject lines | No emojis. |
| Content structure | Dispatches use **Set I / Set II / Encore**. Changelogs use Fix / New / Improved / Beta tags. |
| Backstage | dead-set.org/backstage appears as a consistent block (wish list, bug log, share your set). |
| Archive credit | Prominent, proud — tapers, traders, archive.org. Never buried. |
| Never | The word "AI" in any user-facing surface. |

### B. The visual system

| Token | Value |
|---|---|
| Palette | Gold `#c9a84c` on near-black void `#0a0a0a`. |
| Logo | "The Tape Stamp" — a circular reel-and-holes seal. |
| Type · display | Playfair Display — reverence, titles. |
| Type · body / UI | DM Sans. |
| Type · personal | Caveat — the handwritten, human note. |
| Type · data / labels | JetBrains Mono. |

### C. Copywriting principles

**Lead with the feeling, not the feature.** "We are finding each other," not "our matching engine connects users." The app is the excuse; the scene is the point. Keep it grassroots — when a community layer was explored, the guidance was to position it as a *music-scene clubhouse*, not a coaching platform. Decisive, directorial, warm. Raw is good.

> "WE ARE FINDING EACH OTHER." Community-centric. Never founder-centric.

---

## 8 · On the Horizon — Roadmap & credits

| Track | Next |
|---|---|
| Build | **Share-loop fix:** the `/setlist/:id` anonymous viewer page to convert shared links. |
| Charlie | Enriched `VIBE_INTERPRETATION`, `PRIORITY_INTERPRETATION`, and a new `COMMUNITY_CANON_BIAS` block; the `tasteLexicon.ts` module. |
| iOS | **Audio bug:** a phone-call interruption breaks playback. Fix designed around the Media Session API, an intent-based `userWantsToPlay` state, and `visibilitychange` / `stalled` / `suspend` listeners. |
| Social | Faceless Instagram format (voiceover over app/b-roll); J-card carousel as the template. Measured by bio-link taps, saves, DMs — not follower count. |
| Brand | SVG / Lovable handoff for the Tape Stamp seal; a possible secondary stamp asset. |

### Credits & stewardship

Dead Set stands on the shoulders of a fifty-year culture of generosity. We name it every time.

| Who | What |
|---|---|
| The Archive | The Internet Archive's Live Music Archive — the home all of this lives in. |
| Tapers & traders | Everyone who recorded a reel and kept the tapes moving. The original network. |
| Matt Leunig | Scraped Knee (scrapedknee.com). Drew Cosmic Charlie; design contributor. |
| Founding Deadheads | The small, handpicked beta community shaping every build — including a drummer in Dark n Stormy (darknstormy.band). |

**The closing line.** Every message, every share, every "dude, have you heard this" is the loop. Nobody here is using a tool. They're building a scene. *Gratefully in it with you.*

Please copy and share freely · Trade only

*Wake. Now. Discover.*
