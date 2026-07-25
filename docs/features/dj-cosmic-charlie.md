# DJ Cosmic Charlie & Cherise — Design Doc

*Status: DRAFT — pending review*
*Owner: Jay + design collab*
*Related: `.lovable/plan.md` (Charlie variety), `docs/community-steward-playbook.md` (voice), `src/lib/charlie/tasteLexicon.ts` (vocabulary)*

---

## 1. Vision

Put an actual voice — two voices, actually — to the copy of Charlie's liner notes. Before a setlist starts playing, listeners hear a **radio-show intro** in the tradition of Steve Parrish, David Lemieux, and Darkstar Dan: two hosts on the mic, casually setting up the show, dropping the tasty bits, and passing you into the music.

The two hosts:

- **Cosmic Charlie** — male, older. Bill Walton and Andy Cohen energy: iconoclast Deadhead, wearing his fandom as a badge of honor, big warm personality, evangelist for the music, the people, the culture, the community.
- **Cherise** — female, millennial. Second-generation Deadhead. Parents took her mother to shows while pregnant with her; she danced in the belly, then the sling, then on shoulders. The music has always been there. Her lens is *inheritance* — what it's like to receive this and pass it forward.

What makes it work isn't either voice alone — it's the **cross-generational interplay**. Charlie was there. Cherise was born into it. Each is fascinated by the other's angle on the same music. Fun banter, mutual respect, occasional gentle disagreement, one shared love.

And a second, quieter feature travels alongside: while any song plays, an optional **text overlay** distills what makes THIS version of THIS song matter — date, venue, era, jam-vehicle context, a Charlie-voiced sentence of color. Text-only. Toggleable.

## 2. Principles (non-negotiable)

Drawn directly from the community-steward playbook. These bind every user-facing surface of this feature:

- **No mechanism talk, ever.** The words *AI, algorithm, generate, model, TTS, synthesized, speech* never appear in copy the user reads or in words the user hears. Users experience "Cosmic Charlie and Cherise on the mic." The plumbing is between us and the code.
- **Emotional truth first, mechanism second.** In every UI moment — loading state, skip button, offline fallback — we lead with the story ("Charlie's warming up the tape") not the machine.
- **Community-centric.** "We are finding each other," never "we made this for you."
- **Archive-credit-front.** Where relevant, Charlie or Cherise mention that the recording exists because the tapers, traders, and Internet Archive kept it alive.
- **Signoff is sacred.** "Wake. Now. Discover." — the exact three-beat choreography (§4) — every intro, no exceptions.
- **Toggleable.** Both features (audio intro, text overlay) can be turned off per-user. Some heads want pure music. Respect that.

## 3. Character bibles

These are what we hand the LLM every time we ask it to write a script. They're also what we hand the eventual voice-cloning provider (ElevenLabs) as reference material when we upgrade past POC.

### Cosmic Charlie

- **Age lane:** 55-70. Sees himself as ageless. Talks to Cherise like an adored younger sister who happens to be his musical peer.
- **References for voice acting:** Bill Walton on ESPN talking Dead. Andy Cohen when he lets the Deadhead flag fly. Cameron Crowe as an interview subject. The uncle at Thanksgiving who's been to more shows than everyone else combined and cannot wait to tell you about one.
- **Speech patterns:**
  - Openers: *"Hey now."* / *"Alright heads."* / *"Ohhh boy, do we have one for you."*
  - Excitement markers: *"Are you kidding me."* / *"Come ON."* / *"This one — this one right here."*
  - Reverence markers: *"You gotta hear it."* / *"Sit with it."* / *"It's a moment."*
  - Curatorial: *"Tapers got this in stereo, thank god."* / *"Betty was on the boards."*
- **Vocabulary — pull from `tasteLexicon.ts`:** windmill, brain-melt, silky smooth, long strange, sandwich (segue), bustout, sleeper, deep cut, stretched, marathon, cosmic, spacey, ripping.
- **What Charlie DOES:** enthusiasm without cynicism, teaches without lecturing, name-drops shows and dates casually (never proudly), gives full credit to tapers/traders/Archive, teases Cherise about being born after the good stuff and immediately corrects himself ("there's no bad stuff, kid, only stuff you weren't there for yet").
- **What Charlie NEVER does:** hipster gatekeeping, "you had to be there" superiority, sneering at any era (yes, including '95), calling anyone a poser, using the word "AI" or "algorithm," referring to song matching or the app's mechanics.

### Cherise

- **Age lane:** 32-38. Born into it. Parents were Deadheads; she was conceived at a show (family lore), danced in mom's belly through '91–'92 tours, got carried in the sling for early tribute tours, took her first solo trip to Dead & Company at 25.
- **References for voice acting:** the smartest millennial music writer you know. Warm, curious, playful, slightly sardonic when it earns a laugh. NOT breathy or performative — grounded.
- **Speech patterns:**
  - Openers: *"Hey now, Charlie."* / *"Okay so —"* / *"Alright, I have to tell you about this."*
  - Reflection markers: *"That's what gets me about this one."* / *"There's something in the way she..."* — she leans into feel-language.
  - Bridge markers (she brings in the modern lens): *"...which honestly is what Phish tried to do fifteen years later, but the Dead were already there."*
  - Deference to Charlie: *"You saw this one live, right?"* — she opens the door for his memories, not by asking but by cueing.
- **Vocabulary:** same lexicon as Charlie plus contemporary music-writing register — "there's a moment," "the room lifted," "you can hear the crowd catch up." She's not slangy-millennial; she's articulate-millennial.
- **What Cherise DOES:** connects Dead songs to modern acts she loves (Phish, Goose, Billy Strings, Tyler Childers — anyone in the Dead-adjacent orbit) WITHOUT diminishing the Dead, brings the second-gen perspective ("my mom always said..."), asks Charlie for stories she knows he'll tell, laughs at his jokes, keeps him honest ("okay, but that was the fourth time you played that show in a week, Charlie").
- **What Cherise NEVER does:** apologize for being younger, defer as decoration, play the "just a girl who likes the Dead" card. She's a peer. Full stop.

### The dynamic between them

- They finish each other's sentences occasionally, not constantly.
- Charlie brings the memory ("I was at that Springfield '77 show..."); Cherise brings the pattern ("...and you can hear it — three shows earlier they'd cracked the arrangement open, but this is the night they landed it.").
- Gentle disagreements are welcome. Never nasty. ("Oh come on, Charlie, that '89 Wharf Rat is better than the '77." "Cherise. Cherise. You know I love you but no.")
- Warmth carries every exchange. No one is performing wit at the expense of the other.

## 4. The Signoff

**Every intro ends with this exact three-beat exchange. No variation.**

```
Charlie:   Wake.
Cherise:   Now.
Both:      Discover.
```

That's the fingerprint. Three words, three beats, three voices (his, hers, both). It's the site's tagline (Wake. Now. Discover.) rendered in sound — every listener eventually mouths along. That's how a brand becomes lore.

The moment right before the signoff — the ~2 seconds of setup — is where we punch the vibe home. Something like:

> **Charlie:** Alright, get in there.
> **Cherise:** *[laughs]* You heard the man.
> **Charlie:** Wake.
> **Cherise:** Now.
> **Both:** Discover.

Or, when the setlist is emotionally heavy:

> **Cherise:** ...one for the ones we lost.
> **Charlie:** Every one. Alright, on we go.
> **Charlie:** Wake.
> **Cherise:** Now.
> **Both:** Discover.

The lead-in flexes with the setlist. The three-beat signoff never does.

## 5. User flow

### 5.1 First time a signed-in user hits Play Setlist on a public setlist
1. User clicks Play Setlist.
2. UI transitions to a "warming up the tape" state (see §11 UI states). No spinner. It reads: **"Charlie's cueing up the show..."** with a small waveform animation.
3. Behind the scenes, we check `setlist_intros` table for an existing intro for this `setlist_id`. If cached → skip to step 5. If not → step 4.
4. Edge function `generate-dj-intro` runs: writes the duet script (LLM), synthesizes each line (TTS), stitches into a single MP3, uploads to `dj-intros/` storage bucket, inserts a row into `setlist_intros`. Takes 8-20 seconds on cold generation. UI stays on "warming up."
5. Intro MP3 loads and plays. UI shows an "on air" state (§11). Skip button visible from the first second.
6. Intro ends. ~500ms of silence. First song of Set 1 begins.
7. If §6 (text overlay) is enabled: overlay fades in when the first song starts.

### 5.2 Guest user (not signed in)
Same flow. Intro is generated and cached the same way — the audio isn't private. Guest experience is identical to authed for this feature.

### 5.3 Replay (same user, same setlist)
Steps 1 → 3 → 5 → 6. Cache hit on `setlist_intros`, plays instantly. This is the common case after first play.

### 5.4 User has "DJ intro" toggled off in profile
Steps 1 → 6 directly. No intro, no "warming up" state. Song plays immediately, same as today.

### 5.5 Setlist gets edited after intro was cached
The intro was written from a specific version of the setlist. When the setlist changes (song added/removed, title changed, description regenerated), the cached intro becomes stale.

- **Rule:** on save-with-changes, mark `setlist_intros.stale = true`. Next Play regenerates.
- **Exception:** trivial edits (typo in title, notes-only) shouldn't invalidate. We hash the "intro-relevant fields" (title, era_id, description, ordered song IDs, ordered segues) into `intro_source_hash`. Only regenerate when hash changes.

### 5.6 Setlist has too few songs / no description / no era
Intro is skipped. Songs play immediately. We do not force a canned intro on a setlist that isn't ready for one. Minimum bar: ≥3 songs AND (has description OR has an era). If not, skip the intro path entirely.

## 6. Feature B — In-song text overlay

Text-only. Simpler. Independent from the audio intro.

**What it shows** (per song, while playing):
- Song title
- Show date + venue (from `notable_versions` or setlist_slot notes)
- Era pill (small, colored)
- One curated sentence — "why this version" — in Charlie's voice
- Segue arrow when the next song is a → segue

**Where it lives:** persistent card at the bottom of the viewport (above the audio controls), collapsible via a chevron. On mobile, it collapses to a single line (title + date) that expands on tap.

**Toggle:** profile setting `show_song_overlay` (default: on). Also a one-tap dismiss (X) that disables it for the current session.

**Content source:** for launch, the "why this version" sentence is:
- If the setlist_slot has `notes` from a real historical show reconstruction → use those directly.
- If notable_version has a `description` → use that.
- Otherwise → skip the sentence line; show only the objective metadata.

We do NOT generate new sentences per song at launch. That's a v2 investment. The overlay ships with existing metadata only.

## 7. Content generation — the duet script

The LLM has to write a 2-3 minute casual-banter duet between Charlie and Cherise, using their voices, about a specific setlist.

### 7.1 Input to the LLM

```jsonc
{
  "setlist": {
    "title": "Fresh Air",
    "era": "The '77 Sound",
    "description": "Charlie's already-generated liner notes here — this is the source material.",
    "songs": [
      { "title": "Bertha", "set": 1, "position": 0, "segueToNext": false,
        "show_date": "1977-05-08", "venue": "Barton Hall" },
      // ...
    ]
  },
  "characters": { /* the two character bibles from §3, verbatim */ },
  "vocabulary": [ /* the tasteLexicon phrases */ ],
  "signoff": "Wake. Now. Discover.",
  "constraints": {
    "targetDurationSeconds": 150,
    "maxDurationSeconds": 180,
    "structure": "casual banter — no rigid pass-the-mic. Interruptions welcome. Warm.",
    "mustEndWith": "the exact three-beat signoff, Charlie first, Cherise second, both together on 'Discover.'"
  }
}
```

### 7.2 Output format

Structured JSON so we can split into per-voice TTS calls:

```jsonc
{
  "script": [
    { "speaker": "charlie", "text": "Hey now. Charlie here." },
    { "speaker": "cherise", "text": "And I'm Cherise." },
    { "speaker": "charlie", "text": "Ohhh boy, do we have one for you tonight — Fresh Air, straight out of Barton Hall '77." },
    { "speaker": "cherise", "text": "The Barton Hall show, Charlie. You KNOW what this is." },
    // ... 30-50 exchanges depending on density
    { "speaker": "charlie", "text": "Alright, get in there." },
    { "speaker": "cherise", "text": "You heard the man." },
    // Signoff — LLM MUST emit these three lines exactly
    { "speaker": "charlie", "text": "Wake." },
    { "speaker": "cherise", "text": "Now." },
    { "speaker": "both", "text": "Discover." }
  ]
}
```

The "both" line at the end is special-cased by the TTS pipeline (§8) — either played as two overlaid clips OR pre-recorded once and reused as a fixed asset. See §8.4.

### 7.3 Prompt engineering — the top-line brief

The system prompt to the LLM includes:

- **The character bibles from §3 in full.**
- **The vocabulary list from `tasteLexicon.ts`** — the model is told to draw from this pool for adjectives.
- **Explicit forbidden words:** "AI," "algorithm," "generate," "model," "prompt," "asked to," "created for," "as an AI." If the model outputs these it's a bug we reject.
- **Length target:** 2-3 minutes of natural speech. Roughly 350-450 words total across both speakers.
- **Concrete positive examples** (2-3 short sample exchanges written by hand, in-voice) — few-shot the tone.
- **A hard rule about the signoff:** the last three lines of the script are always Charlie:"Wake." / Cherise:"Now." / both:"Discover." — no variation.

### 7.4 Safety valve

If the LLM output violates the fourth-wall rule (contains "AI"/etc.), we retry once with a stricter system prompt. If it fails twice, we fall back to a **hand-written generic intro** ("Hey now. It's Charlie. This one's a beauty. Cherise, take it away." — a short, generic, hand-written script that works for any setlist) rather than serving something that breaks the character.

## 8. TTS pipeline

### 8.1 POC provider — OpenAI TTS

**Why OpenAI first:**
- Cheap: $0.015 per 1,000 characters. A 400-word script (~2,400 chars) costs ~$0.04.
- Fast: ~1-2 seconds per API call.
- Two clean voices: **onyx** (Charlie — deep, warm, resonant) and **nova** (Cherise — bright, friendly, present).
- No voice-cloning bureaucracy to prove the concept.

**Trade-off:** neither voice sounds *quite* like the reference personalities (Walton, Cohen, etc.). It'll sound like "a decent radio duo," not "Cosmic Charlie and Cherise." That's fine for POC — we're testing the format, timing, and audience response, not the voice fidelity.

### 8.2 Polish provider — ElevenLabs

Once POC is validated (users engage, don't skip, retention holds), upgrade to ElevenLabs:
- Voice cloning from short samples (30-60 seconds of reference audio per character).
- Dramatically more character in the voice — pauses, laughs, emphasis, warmth.
- ~10× the cost: $0.30/1K chars → ~$0.72 per intro.
- Manageable at even 10,000 intros/month → $7,200/mo, which is only justified if the feature is proven.

Voice sourcing at upgrade time (open question): do we license voice actors, clone from public-domain audio, or record real people? See §Open Questions.

### 8.3 Line-by-line vs. concatenated request

TTS providers vary in support for multi-speaker single-request generation. OpenAI is single-voice-per-call. Approach:

- For each line in the script, call TTS with the appropriate voice.
- Receive MP3 bytes back per line.
- Stitch into one final MP3 (see §8.4).
- Upload the final MP3 to Supabase Storage.

For a 40-line script this is 40 TTS calls. All parallelizable. Total wall-clock: 5-10 seconds if we fan out.

### 8.4 Stitching approach

**POC (client-side sequential playback):**
- Edge function returns an array of `{speaker, url, durationMs}` objects.
- Browser plays them in order via a small state machine in `AudioPlayerContext`.
- Zero server-side audio processing. Simple. Ships in a week.
- Cost: choppier gaps between lines than a real DJ show. Acceptable for POC because we're validating the vibe, not the polish.

**Polish (server-side stitching):**
- Edge function receives all TTS responses.
- Uses `ffmpeg` (compiled for Deno) or a raw MP3-frame concatenator to produce one seamless MP3.
- Handles the "both" line by mixing the two individual clips with a small overlap so it sounds unified.
- Uploads single file. Client plays a single audio element. Zero gaps.
- Do this AFTER we know users like the feature.

### 8.5 The "both" line

Three options for the closing "Discover" spoken by both:

1. **Overlay two clips** — generate "Discover" once with each voice, play simultaneously in browser. Sounds slightly off due to phase differences, but honestly might sound charming in a DIY-radio way.
2. **Pre-record once, hardcode** — record a real human duet of "Wake. / Now. / Discover." once, ship it as a static asset. Every intro uses this same clip for the final three beats. **The right answer.** It's a signature moment; it deserves to be fixed and perfect.

   **POC seeding strategy** (decided): the fixed asset is a real file at `public/audio/signoff.mp3`, and for POC/beta we seed it with a TTS-generated version. Jay uses that TTS clip as a *reference* — the rhythm, pacing, and word emphasis to hand to real humans (Charlie + Cherise) when scripting the human recording session. When the human recording is ready, we replace the file at the same path. No code change, no re-architecture. This lets us build the full end-to-end flow without blocking on the human recording, while preserving the "human voice on the signoff" endgame.
3. **Skip the "both" — just Charlie or just Cherise closes** — loses the signature. Not doing this.

**Recommendation: option 2 for launch.** The signoff is a fixed asset in `public/audio/signoff.mp3`. The generated intro ends when Cherise/Charlie finish their setup lines, then the fixed asset plays. This also means the signoff is EXACTLY the same every time — which is the whole point of a signature.

## 9. Storage & caching

### 9.1 New Supabase Storage bucket: `dj-intros`

- Path convention: `dj-intros/<setlist_id>/<intro_source_hash>.mp3`
- Public read (intros are not sensitive).
- Bucket policy: only edge functions can write (service-role key).
- Lifecycle: keep 30 days; on regenerate, previous file is orphaned (Storage cron cleans).

### 9.2 New table: `setlist_intros`

```sql
CREATE TABLE public.setlist_intros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setlist_id uuid NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  intro_source_hash text NOT NULL,  -- see §5.5
  audio_path text NOT NULL,          -- storage path
  script_json jsonb NOT NULL,        -- the raw duet, for audit/debug and future overlay use
  duration_ms int NOT NULL,
  voice_provider text NOT NULL,      -- 'openai' | 'elevenlabs'
  created_at timestamptz DEFAULT now(),
  UNIQUE (setlist_id, intro_source_hash)
);
CREATE INDEX ON setlist_intros(setlist_id);
```

RLS: SELECT open to authenticated + anon (intros are public). INSERT/UPDATE only from service role.

### 9.3 New table: `user_playback_preferences` (or extend `profiles`)

Two toggles:

```sql
ALTER TABLE public.profiles
  ADD COLUMN dj_intro_enabled boolean DEFAULT true,
  ADD COLUMN song_overlay_enabled boolean DEFAULT true;
```

Simpler than a new table for two booleans. Extend profiles.

## 10. Player integration

`AudioPlayerContext` gets a new concept: a **pre-roll segment** that plays before the setlist's first song.

### 10.1 State additions

```ts
type PlayerState = {
  // existing fields...
  preRoll: null | {
    type: 'dj-intro';
    setlistId: string;
    lines: Array<{ speaker: 'charlie'|'cherise'|'both'; url: string }>;
    currentLineIndex: number;
    signoffUrl: string;  // fixed asset
  };
};
```

### 10.2 `playSetlist(slots, setlistId)` flow

```
if (user prefers no DJ intro) → play first song directly (current behavior)
else:
  const intro = await fetchOrGenerateIntro(setlistId);
  if (intro === null) → play first song directly (bad-input fallback)
  else:
    setState({ preRoll: { ...intro, currentLineIndex: 0 } });
    playPreRollLine(0);
    // when preRoll finishes, transition to first song
```

### 10.3 Skip

Skip button always visible during pre-roll. Skips the entire remaining intro (not just current line) and starts Set 1. Skip is a preference-adjacent signal — if a user skips 3 intros in a row, we prompt: "Want to skip the intro next time too? Turn it off in Profile." One-time nudge.

## 11. UI states

### 11.1 "Warming up the tape" (loading, before intro is ready)

Full-viewport takeover (or bottom sheet on mobile) with:
- Charlie/Cherise silhouettes (SVG, brand-colored)
- Text: **"Charlie's cueing up the show..."** (never "generating," never "loading")
- Sub-text: **"Cherise is grabbing her coffee."** (rotating flavor text — makes the wait feel intentional)
- A single subtle waveform pulse animation
- Skip button appears after 3 seconds if the intro still isn't ready

### 11.2 "On the air" (intro playing)

- Compact overlay at top or bottom of viewport
- Shows both silhouettes with a small "who's talking" indicator (the active speaker's silhouette pulses)
- Setlist title + "Charlie & Cherise on the mic"
- Big Skip button
- Waveform showing intro progress + estimated time to Set 1

### 11.3 "Setlist starting" (transition)

- 500ms of clean silence between intro and first song
- Overlay morphs into the standard now-playing bar as the first song fades in
- The whole thing should feel like a real radio show handoff, not a UI mode change

### 11.4 Text overlay (Feature B, during song playback)

- Bottom card, ~80px tall on mobile, ~100px on desktop
- Left: song title (large, serif), show date + venue (small, mono)
- Right: era pill + segue arrow (→) if segue-to-next
- Middle: the "why this version" sentence when we have one
- Collapse chevron top-right; X (session-dismiss) also top-right
- Slides up when a new song starts, sits static until next song

## 12. Cost model

### 12.1 POC (OpenAI TTS)

- Per intro: 400-word script × ~5 chars/word = 2,000 chars = **$0.030**
- Assume 50 intros generated per day in beta (many will be cache hits after first play)
- Monthly generation: 50 × 30 = 1,500 intros = **$45/mo**
- Storage: negligible (few MB per intro, tens of GB max)

### 12.2 Polish (ElevenLabs)

- Per intro: 2,000 chars × $0.30/1K = **$0.60**
- Same volume: 1,500/mo = **$900/mo**
- ONLY move to this after POC proves engagement warrants the spend

### 12.3 Text overlay (Feature B)

- No new API calls. Uses existing setlist_slots.notes and notable_versions.description.
- Cost: $0 incremental.

### 12.4 Hard budget cap

Add a monthly TTS spend cap ($100 during POC). Edge function checks a `tts_monthly_spend` counter in a config table before generating. If over budget, falls back to no-intro (song plays directly). Ops-safe.

## 13. Rollout plan

### 13.1 Phase 0 — Design review (this doc)
Land this doc. Jay signs off on character bibles, script direction, signoff choreography.

### 13.2 Phase 1 — Signoff asset seeding
Generate a TTS version of "Wake. / Now. / Discover." (Charlie voice, Cherise voice, both together on "Discover") and drop it at `public/audio/signoff.mp3`. This is the POC/beta signoff — a reference clip Jay uses to script and rehearse the eventual human recording session with real Charlie + Cherise voices. When the human recording is complete, swap the file at the same path (no code change).

### 13.3 Phase 2 — Backend
- Add `setlist_intros` table + migration
- Create `dj-intros` storage bucket
- Build `generate-dj-intro` edge function (LLM script → OpenAI TTS per line → return line array + signoff URL)
- Add `intro_source_hash` computation to `useSetlist` save path (invalidate on real changes)

### 13.4 Phase 3 — Player + UI
- Extend `AudioPlayerContext` with pre-roll state
- Build "warming up" and "on air" UI states
- Wire skip → start Set 1
- Ship behind a feature flag `enable_dj_intro`, default OFF

### 13.5 Phase 4 — Internal alpha
- Turn `enable_dj_intro` ON for Jay + the ~5 Founding Deadhead admins
- One week of listening — collect subjective read on whether the voices sound like Charlie/Cherise, whether the banter lands, whether the timing works
- Iterate on the script prompt

### 13.6 Phase 5 — Founding Deadhead beta
- Turn flag on for all 40 Founding Deadheads
- Feedback via `/steward` weekly rhythm
- Watch skip rate: if >70% skip within 10s, the feature isn't ready
- Watch retention: does having heard one intro make a user more likely to play another setlist? (this is the whole point)

### 13.7 Phase 6 — Public + polish decision
- Enable for all authed users. Watch metrics for 2 weeks.
- If skip rate < 30% AND per-user setlist plays increase → **upgrade to ElevenLabs** for voice polish.
- If skip rate 30-70% → iterate on script and character bibles before spending on ElevenLabs.
- If skip rate > 70% → the format isn't working. Roll back, learn what went wrong.

### 13.8 Text overlay (Feature B) — parallel micro-rollout
- Ship behind `enable_song_overlay` flag, default ON.
- Watch for complaints (some heads will want pure audio). If dismissal rate is high, default to OFF and let users opt in.

## 14. Feature flags

Two flags added to a `feature_flags` table (or extend existing pattern if there is one — TBD during build):

- `enable_dj_intro` (bool, default false during rollout)
- `enable_song_overlay` (bool, default true — safer to opt-out than opt-in)

Both checked in `AudioPlayerContext` at Play Setlist time.

## 15. Metrics to track

- **dj_intro_generated** (event, per setlist_id, first generation)
- **dj_intro_played_full** (event, per user, when full intro plays without skip)
- **dj_intro_skipped** (event, per user, with `secondsPlayed` metadata)
- **dj_intro_regenerated** (event, when intro_source_hash change forces regen)
- **song_overlay_dismissed** (event, when user X's the overlay)
- **song_overlay_toggled_off** (event, when user disables in profile)
- **setlist_plays_per_active_user_per_week** — the outcome metric; if intros work, this goes up.

## 16. Open questions (decide during build)

1. **Signoff pronunciation.** Charlie says "Wake" — with what tone? Reverent, declarative, warm? Record 3 takes, pick.
2. **Voice actor sourcing for polish phase.** Real people (paid), voice-cloning from public samples (legally fraught), or ElevenLabs' library voices? Have a call before Phase 6.
3. **Do we let the same intro play for two different users of the same setlist?** Yes — same intro_source_hash → same MP3. Not personalizing per user.
4. **Language of the "warming up" text.** Draft library of 10-15 flavor lines. Cherise-and-Charlie-flavored, never mechanical.
5. **Mobile data cost concern.** Each intro is ~1-2 MB. If a user is on cellular, do we auto-skip and only play on wifi? Or trust their setting? — Recommend: no auto-skip, but add a data-saver preference toggle later.
6. **What about setlists built by Cherise-referenced acts (Phish, Goose, Billy Strings covers) — should Cherise get a bigger role in those intros?** Probably yes. Script prompt can weight speaker balance based on era / description content. v2 problem.
7. **Should we ever let the intro reference the user's history?** ("Charlie, check it out — this user's built three '77 shows this week.") Powerful but breaks intro caching (would need per-user regen). Post-v1.

## 17. Explicitly not doing (scope discipline)

- No live streaming / no real-time interaction with Charlie or Cherise. Recorded audio only.
- No user-submitted script edits. The AI writes; we ship.
- No character multiplayer (a third voice). Two hosts. Period.
- No between-song DJ chatter in v1. Intro only. (This is an obvious v2 idea — Charlie transitions between Set 1 and Set 2, Cherise closes the show — but scope creep here would kill the launch.)
- No AI-voiced text overlay narration. Text-only per §6.

## 18. Next actions

- [ ] Jay reviews this doc, signs off on §3 character bibles and §4 signoff choreography.
- [ ] I generate the TTS signoff seed clip (§13.2) — Jay uses it as a reference to script the eventual human recording with friends.
- [ ] I write the migration + edge function stubs (Phase 2) once §3/§4 are locked.
- [ ] I sketch the "warming up" and "on air" UI states as static components before wiring them to real state.
- [ ] We decide on the "warming up" flavor text library together (10-15 lines).
- [ ] (Later, no timeline pressure) Jay records the human Charlie + Cherise signoff and replaces `public/audio/signoff.mp3`.

---

*Last updated: initial draft. Iterate here before we cut a line of implementation code.*
