# Gapless playback engine

The segue is the product. Scarlet > Fire, China > Rider, Help > Slip > Franklin's —
the transition between tracks is frequently the best part of the show, and the
old player gapped at every boundary by construction (it tore down and remounted
the entire player component per track). This engine replaces that pipeline.

## Architecture

Playback runs on [`gapless`](https://www.npmjs.com/package/gapless) (MIT, by
Daniel Saewitz of the Relisten team — the library powering relisten.net,
hardened against exactly our content: Internet Archive MP3s and their redirect
behavior). HYBRID mode: HTML5 audio for instant start, Web Audio for
sample-accurate scheduled transitions.

```
components ──► useAudioPlayer() ──► AudioPlayerContext (state = source of truth)
                                          │  state→engine sync (re-anchor on user jumps;
                                          │  hands-off during gapless advances)
                                          ▼
                              src/lib/player/gaplessEngine.ts
                              (the ONLY module importing `gapless`)
                                          │
                                          ▼
                              one Queue (HYBRID, preloadNumTracks 2)
```

- **`src/lib/player/gaplessEngine.ts`** — wraps one `Queue`; maps queue indices
  to setlist slot ids; serializes async ops; `desiredTransportState` guard so a
  pause during an in-flight load is never overridden by the load completing.
- **`src/contexts/AudioPlayerContext.tsx`** — unchanged public API
  (`playSingle`, `playSetlist`, `queueSetlist`, `advancePlaylist`, …) plus a
  `transport` surface (`play/pause/togglePlayPause/next/previous/gotoTrack/
  seek/setVolume`, progress ref + ~4Hz subscription). Upcoming setlist slots
  resolve sequentially in the background and append to the live queue.
- **`src/components/GaplessPlayerBar.tsx`** — pure UI shell. The progress fill
  is driven by a rAF loop reading the engine's progress ref; time labels update
  at ~4Hz. `onProgress` (60fps) never causes a React render.
- **Track metadata** (title / Grateful Dead / venue · date / artwork with an
  absolute HTTPS URL) is attached at `addTrack` time; `gapless` feeds it to the
  Media Session API (lock screen, Control Center, Bluetooth, car displays).

## Engine flag / rollback

`src/lib/player/engineFlag.ts`. Default is `gapless`; browsers without Web
Audio auto-fall back to `legacy` (which also keeps jsdom tests on the legacy
path). Rollback for a full release:

```js
localStorage.setItem("player_engine", "legacy");
```

The legacy remount-per-track player (`AudioPlayer.tsx` mounted by
`GlobalAudioPlayer`) is intact and removable in one commit once the segue
tests have held up in production for a week.

## Instrumentation (PostHog, via window.posthog)

- `audio_play_started` — engine, song_title, show_date, identifier
- `audio_track_advanced` — `gapless: true/false` (+ `user_jump` in engine mode,
  `dir` on re-anchor advances). **The wild-signal:** a meaningful share of
  gapped advances in production means the CORS or preload path is degrading
  for real users regardless of local behavior.
- `audio_segue_completed` — a Web Audio scheduled transition completed cleanly
- `audio_error` — message, track_url, playback_method at time of failure
- `audio_autoplay_blocked`

## CORS dependency (why HYBRID works)

Phase 0 spike (repo issue #1, verified from the production origin): archive.org
serves permissive CORS on `/download/` URLs **and** on the node hosts its
redirects resolve to. Note the node fleet has multiple hostname shapes
(`dn######.ca.archive.org`, `ia######.us.archive.org`, …) — never hardcode a
pattern; the engine's HEAD resolution follows whatever it gets. If HYBRID ever
goes silent at the Web Audio handoff, CORS regression on those hosts is the
first suspect (`audio_error` with `playback_method: WEBAUDIO`).

## Acceptance bar — the listening test (manual, headphones)

| Show | Transition |
|---|---|
| Barton Hall, 5/8/77 | Scarlet Begonias > Fire on the Mountain |
| Veneta, 8/27/72 | China Cat Sunflower > I Know You Rider |
| Any '76–'77 | Help on the Way > Slipknot! > Franklin's Tower |
| Any '72–'74 | Dark Star > (anything) |

Pass criteria at each boundary: no audible gap, click/pop, repeated or skipped
audio, no jump back to the start of the outgoing track. Run each under: desktop
+ good connection; mobile Safari over cellular; mobile with the screen locked
mid-transition.

## Known limitations / follow-ups

- **iOS (Capacitor/WKWebView) background audio is unverified** — needs a
  physical-device check of what happens when the app backgrounds mid-track.
  Document observed behavior here; do not attempt to fix in this workstream.
- **Lock-screen metadata needs verification on a physical iPhone** (Phase 2
  acceptance) — title, artist, album, artwork.
- `bun.lockb` still needs a plain `bun install` from a normal dev environment
  to pick up the `gapless` dependency (the remote sandbox couldn't reach the
  private registry mirror the lockfile pins).
- Manual skips re-anchor the queue (intentional: a skip is a seek, not a
  segue) — they are gapped and reported as such.
- Out of scope, tracked as future work: offline downloads/caching, Chromecast/
  AirPlay/Sonos integration beyond the existing cast instructions, CarPlay/
  Android Auto, queue reordering UI, playback-rate controls, Last.fm
  scrobbling.
