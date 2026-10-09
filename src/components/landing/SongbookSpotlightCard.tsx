import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { findRecordingForDate, type ArchiveResult } from "@/lib/archiveOrg";
import { trackCtaClick } from "@/lib/trackCtaClick";
import { captureEvent } from "@/lib/posthog";
import { unlockAudioInGesture } from "@/lib/player/gestureUnlock";
import {
  preferredEnd,
  spotlightSlot,
  spotlightSlotId,
  type End,
  type SongbookSpotlight,
} from "@/lib/songbookSpotlight";

/**
 * This week's Songbook song, on the home page.
 *
 * The card it replaces was a play button, a date and a venue. It told you a
 * song was there, and not why you would want it. This one is the issue
 * compressed to what a passing reader needs, top to bottom:
 *
 *   the song      title, and the issue's own headline
 *   its life      first night, last night, the count between them
 *   one night     a tear-off stub that plays the first or the last time they
 *                 played it. Its end of the line is lit up so you can see
 *                 where in the song's life you are about to drop the needle.
 *   what's inside the sleeper count (or the nights a fan mapped), and the way in
 *
 * Mount it with `key={spotlight.slug}`. The night it offers is chosen once per
 * song and may move to the other end after an Archive check (see below). A new
 * song is a new card.
 *
 * Styles are scoped and read the hero's custom properties (`--bg-deep` for the
 * stub's notches). The card lives inside `.ds-hero`, and the app's card tokens
 * are built for a different surface.
 */

const NoteIcon = ({ playing }: { playing: boolean }) =>
  playing ? (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72c0 .79.87 1.27 1.54.85l10.79-6.86a1 1 0 0 0 0-1.7L9.54 4.29A1 1 0 0 0 8 5.14z" />
    </svg>
  );

const CARD_STYLES = `
  .sb-spot {
    --sb-paper: #f4ecd6;
    --sb-stub: #ebe0c3;
    --sb-ink: #2a2118;          /* 13.4:1 on paper */
    --sb-ink-soft: #5e584d;     /* 5.98:1 on paper, 5.37:1 on the stub */
    --sb-maroon: #4a0404;       /* 13.6:1 */
    --sb-clay: #a03a26;         /* 5.70:1 on paper, 5.11:1 on the stub */
    --sb-gold-ink: #7a5f33;     /* 5.07:1 on paper */
    --sb-blue: #3b689b;         /* --dead-blue, 4.90:1 on paper */
    --sb-perf: rgba(122, 95, 51, 0.45);

    position: relative;
    width: 100%;
    max-width: 440px;
    margin: 32px auto 0;
    padding: 16px 18px 0;
    text-align: left;
    color: var(--sb-ink);
    border: 1px solid #d8c89e;
    border-radius: 8px;
    overflow: hidden;
    background:
      url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.36  0 0 0 0 0.27  0 0 0 0 0.14  0 0 0 0.07 0'/></filter><rect width='100%25' height='100%25' filter='url(%23g)'/></svg>"),
      var(--sb-paper);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
  }
  @media (min-width: 640px) {
    .sb-spot { padding: 20px 24px 0; }
  }

  .sb-spot__eyebrow {
    display: flex; justify-content: space-between; align-items: center; gap: 12px;
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--sb-gold-ink);
  }
  .sb-spot__series { display: inline-flex; align-items: center; gap: 7px; color: var(--sb-clay); }
  .sb-spot__dot {
    width: 6px; height: 6px; border-radius: 999px;
    background: #d2593f;
    box-shadow: 0 0 8px rgba(194, 74, 51, 0.7);
    animation: sb-pulse 2s ease-in-out infinite;
  }

  .sb-spot__title {
    font-family: 'Sancreek', 'Playfair Display', Georgia, serif;
    font-weight: 400;
    font-size: clamp(30px, 8.6vw, 40px);
    line-height: 1.02;
    color: var(--sb-maroon);
    margin: 12px 0 0;
  }
  .sb-spot__hook {
    font-family: 'Caveat', cursive;
    font-size: 22px;
    line-height: 1.15;
    color: var(--sb-blue);
    margin: 8px 0 0;
  }
  @media (min-width: 640px) { .sb-spot__hook { font-size: 24px; } }

  /* ── the song's life: first night, the run between, last night ──
     Drawn like a dimension on a plan: labels and the count on the top row,
     the years joined by the rail underneath. The count used to sit ON the
     rail, and at 320px the rail ran out of room and the last pin landed on
     the "1" of its own year. */
  .sb-life {
    display: grid;
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      "fl count ll"
      "fy rail ly";
    align-items: end;
    column-gap: 10px;
    row-gap: 2px;
    margin-top: 18px;
  }
  .sb-life__label {
    font-family: 'Special Elite', 'Courier Prime', monospace;
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--sb-gold-ink);
  }
  .sb-life__label.is-cued { color: var(--sb-clay); }
  .sb-life__label--last, .sb-life__year--last { text-align: right; }
  .sb-life__year {
    font-family: 'Caveat', cursive;
    font-size: 30px;
    line-height: 0.9;
    color: var(--sb-ink);
  }
  .sb-life__rail {
    grid-area: rail;
    display: flex; align-items: center; gap: 4px;
    height: 27px;
    min-width: 0;
  }
  .sb-life__dash {
    flex: 1;
    height: 2px;
    background: repeating-linear-gradient(90deg, var(--sb-clay) 0 6px, transparent 6px 11px);
    opacity: 0.6;
  }
  .sb-life__pin {
    flex-shrink: 0;
    width: 12px; height: 12px;
    border-radius: 999px;
    background: var(--sb-paper);
    border: 2px solid var(--sb-clay);
  }
  .sb-life__pin.is-cued {
    border-color: #b8860b;
    background: linear-gradient(135deg, #d4af37, #f3e5ab 45%, #b8860b);
    animation: sb-halo 2.6s ease-in-out infinite;
  }
  .sb-life__count {
    grid-area: count;
    justify-self: center;
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--sb-ink-soft);
    white-space: nowrap;
  }
  .sb-life__count b {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--sb-clay);
  }

  /* ── the stub: one night, torn off the card ── */
  .sb-cue {
    position: relative;
    display: flex; align-items: center; gap: 14px;
    width: calc(100% + 36px);
    margin: 18px -18px 0;
    padding: 14px 18px;
    background: var(--sb-stub);
    border: 0;
    border-top: 2px dashed var(--sb-perf);
    border-bottom: 2px dashed var(--sb-perf);
    text-align: left;
    color: var(--sb-ink);
    cursor: pointer;
    font: inherit;
    transition: background 0.15s ease;
  }
  @media (min-width: 640px) {
    .sb-cue { width: calc(100% + 48px); margin: 20px -24px 0; padding: 16px 24px; }
  }
  /* Ticket notches where the perforation meets the edge. --bg-deep is the
     hero's maroon, so they read as cut out of the card. */
  .sb-cue::before, .sb-cue::after {
    content: "";
    position: absolute; top: -9px;
    width: 16px; height: 16px; border-radius: 999px;
    background: var(--bg-deep, #4a0404);
  }
  .sb-cue::before { left: -9px; }
  .sb-cue::after { right: -9px; }
  .sb-cue:hover { background: #e6d9b8; }
  .sb-cue:active { transform: translateY(1px); }
  .sb-cue:active .sb-cue__disc { transform: scale(0.95); }
  .sb-cue:focus-visible { outline: 2px solid var(--sb-clay); outline-offset: -4px; }

  .sb-cue__disc {
    flex-shrink: 0;
    width: 56px; height: 56px;
    border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #d4af37, #f3e5ab 45%, #b8860b);
    color: #2a1a04;
    box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.22), 0 6px 16px rgba(58, 36, 6, 0.32);
    transition: transform 0.15s ease;
  }
  .sb-cue__disc svg { width: 24px; height: 24px; }
  .sb-cue:not(.is-playing) .sb-cue__disc { animation: sb-breathe 2.6s ease-in-out infinite; }
  @media (min-width: 640px) {
    .sb-cue__disc { width: 62px; height: 62px; }
    .sb-cue__disc svg { width: 26px; height: 26px; }
  }

  .sb-cue__text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .sb-cue__kicker {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--sb-clay);
  }
  @media (max-width: 359px) {
    .sb-cue { gap: 12px; }
    .sb-cue__disc { width: 52px; height: 52px; }
    .sb-cue__kicker { font-size: 11px; letter-spacing: 0.1em; }
  }
  .sb-cue__night {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.35;
    color: var(--sb-ink);
  }
  .sb-cue__note {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 13px;
    font-style: italic;
    line-height: 1.35;
    color: var(--sb-ink-soft);
  }

  /* ── what's inside, and the way in ── */
  .sb-more {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 12px;
    align-items: start;
    margin: 0 -18px;
    padding: 14px 18px 16px;
    color: var(--sb-ink);
    text-decoration: none;
  }
  @media (min-width: 640px) { .sb-more { margin: 0 -24px; padding: 16px 24px 18px; } }
  .sb-more--torn { margin-top: 18px; border-top: 2px dashed var(--sb-perf); }
  .sb-more:hover .sb-more__go { text-decoration: underline; text-underline-offset: 3px; }
  .sb-more:focus-visible { outline: 2px solid var(--sb-clay); outline-offset: -4px; }
  .sb-more__n {
    font-family: 'Sancreek', 'Playfair Display', Georgia, serif;
    font-size: 38px;
    line-height: 0.95;
    color: var(--sb-clay);
  }
  .sb-more__text { display: flex; flex-direction: column; gap: 2px; padding-top: 2px; }
  .sb-more__line {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.25;
    color: var(--sb-ink);
  }
  .sb-more__sub {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 13px;
    line-height: 1.35;
    color: var(--sb-ink-soft);
  }
  .sb-more__go {
    margin-top: 6px;
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--sb-clay);
  }

  .sb-spot--loading { min-height: 372px; }
  .sb-spot__bar {
    height: 12px; border-radius: 3px; margin-top: 12px;
    background: rgba(122, 95, 51, 0.16);
  }

  @keyframes sb-pulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
  @keyframes sb-halo {
    0%, 100% { box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.30); }
    50%      { box-shadow: 0 0 0 7px rgba(212, 175, 55, 0.10); }
  }
  @keyframes sb-breathe {
    0%, 100% { box-shadow: 0 0 0 4px rgba(212,175,55,0.22), 0 6px 16px rgba(58,36,6,0.32); }
    50%      { box-shadow: 0 0 0 9px rgba(212,175,55,0.10), 0 8px 20px rgba(58,36,6,0.38); }
  }
  @media (prefers-reduced-motion: reduce) {
    .sb-spot__dot, .sb-life__pin.is-cued, .sb-cue__disc { animation: none !important; }
  }
`;

/** Holds the card's height while the shelf loads, so the page below does not jump. */
export const SongbookSpotlightSkeleton = () => (
  <>
    <style>{CARD_STYLES}</style>
    <div className="sb-spot sb-spot--loading" aria-busy="true" aria-label="Loading this week's song">
      <div className="sb-spot__eyebrow">
        <span className="sb-spot__series">
          <span className="sb-spot__dot" aria-hidden="true" />
          The Songbook
        </span>
        <span>This week</span>
      </div>
      <div className="sb-spot__bar" style={{ width: "62%", height: 30, marginTop: 14 }} />
      <div className="sb-spot__bar" style={{ width: "88%" }} />
      <div className="sb-spot__bar" style={{ width: "54%" }} />
    </div>
  </>
);

const SongbookSpotlightCard = ({ spotlight: s }: { spotlight: SongbookSpotlight }) => {
  const { playSingle, playingSlot, stopPlayback, transport } = useAudioPlayer();
  const [cue, setCue] = useState<End | null>(() => preferredEnd(s));
  /** A lookup already made for the cued night: url AND track, so the tap needs no network. */
  const [found, setFound] = useState<ArchiveResult | null>(null);
  const tried = useRef(new Set<End>());

  /**
   * Ask the Archive about the cued night before anyone taps, when it has no
   * tape on file.
   *
   * Two reasons. A front-page button that answers "No tape of this one
   * circulates yet" is the worst first tap the site has. Checking first lets
   * the card offer the other end of the song's life instead, or no night at
   * all. And a night already looked up starts with nothing between the tap and
   * the sound.
   *
   * findRecordingForDate THROWS when the Archive cannot be asked, and caches
   * neither answer. A throw is not "no tape". The offer stays up, and the tap
   * asks again and says which failure it was.
   */
  useEffect(() => {
    setFound(null);
    if (!cue) return;
    const end = s[cue];
    if (!end.date || end.archiveUrl) return;
    tried.current.add(cue);
    let cancelled = false;
    findRecordingForDate(s.title, end.date).then(
      (hit) => {
        if (cancelled) return;
        if (hit?.directTrackUrl) {
          setFound(hit);
          return;
        }
        // The Archive answered: no readable tape of that night carries the song.
        const other: End = cue === "first" ? "last" : "first";
        setCue(s[other].date && !tried.current.has(other) ? other : null);
      },
      () => {
        /* could not ask: leave the offer as it is */
      },
    );
    return () => {
      cancelled = true;
    };
  }, [cue, s]);

  const end = cue ? s[cue] : null;
  const slotId = cue ? spotlightSlotId(s, cue) : null;
  /**
   * Ours, and not failed. When the Archive cannot be reached, playSingle sets
   * the error and leaves `playingSlot` in place, so on the slot id alone the
   * stub read "Now spinning" with a pause icon under a player bar saying
   * "Couldn't reach the Archive", and its next tap stopped instead of retrying.
   * `transport.error` is scoped to the current slot, so while it is set this
   * night is not playing, and a tap asks again (playSingle clears the error).
   */
  const isPlaying = !!slotId && playingSlot?.id === slotId && !transport.error;
  const issueHref = `/songbook/${s.slug}`;
  const readLabel = s.kind === "issue" ? `Read Vol. ${s.issueNumber ?? 1}` : "Read the guide";

  const handleCue = () => {
    if (!end) return;
    if (isPlaying) {
      stopPlayback();
      return;
    }
    unlockAudioInGesture();
    trackCtaClick("hero_songbook_play", "audio");
    captureEvent("songbook_spotlight_played", {
      slug: s.slug,
      kind: s.kind,
      night: end.which,
      show_date: end.date,
      prewarmed: !!found,
    });
    // Typed void on the context, async underneath. Wrapped so a rejection is
    // logged here rather than surfacing as an unhandled one.
    void Promise.resolve(playSingle(spotlightSlot(s, end, found))).catch((e) =>
      console.error("[songbook spotlight] play failed", e),
    );
  };

  // A community entry knows a venue only when its guide includes that night.
  // The tape found for the night knows its own, and once it is found that is
  // a fact about this recording, not a guess.
  const nightLine = end ? [end.label, end.venue ?? found?.venue].filter(Boolean).join(" · ") : "";
  const ordinal = end?.which === "first" ? "first" : "last";
  const finding = s.finding;
  const findingLine =
    finding?.kind === "sleepers"
      ? finding.count === 1 ? "sleeper you probably haven't heard" : "sleepers you probably haven't heard"
      : finding?.kind === "nights"
        ? finding.count === 1 ? "night worth knowing" : "nights worth knowing"
        : null;

  return (
    <>
      <style>{CARD_STYLES}</style>
      <article className="sb-spot" aria-labelledby="sb-spot-title">
        <div className="sb-spot__eyebrow">
          <span className="sb-spot__series">
            <span className="sb-spot__dot" aria-hidden="true" />
            The Songbook
          </span>
          <span>This week</span>
        </div>

        <h2 id="sb-spot-title" className="sb-spot__title">{s.title}</h2>
        {/* A community entry has no headline, and none is invented. Nor is a
            name put here: the guide's own page carries the credit. */}
        {s.headline && <p className="sb-spot__hook">{s.headline}</p>}

        {(s.first.year || s.last.year) && (
          <div
            className="sb-life"
            role="img"
            aria-label={[
              s.first.label && `First played ${s.first.label}`,
              s.timesPlayed != null && `played ${s.timesPlayed} times`,
              s.last.label && `last played ${s.last.label}`,
            ].filter(Boolean).join(", ")}
          >
            <span className={`sb-life__label${cue === "first" ? " is-cued" : ""}`} style={{ gridArea: "fl" }}>
              First
            </span>
            {s.timesPlayed != null && (
              <span className="sb-life__count">
                <b>{s.timesPlayed}</b> times
              </span>
            )}
            <span
              className={`sb-life__label sb-life__label--last${cue === "last" ? " is-cued" : ""}`}
              style={{ gridArea: "ll" }}
            >
              Last
            </span>
            <span className="sb-life__year" style={{ gridArea: "fy" }}>{s.first.year ?? "—"}</span>
            <span className="sb-life__rail">
              <span className={`sb-life__pin${cue === "first" ? " is-cued" : ""}`} />
              <span className="sb-life__dash" />
              <span className={`sb-life__pin${cue === "last" ? " is-cued" : ""}`} />
            </span>
            <span className="sb-life__year sb-life__year--last" style={{ gridArea: "ly" }}>
              {s.last.year ?? "—"}
            </span>
          </div>
        )}

        {end ? (
          <button
            type="button"
            onClick={handleCue}
            className={`sb-cue${isPlaying ? " is-playing" : ""}`}
            aria-label={
              isPlaying
                ? `Stop ${s.title}`
                : `Play ${s.title}, the ${ordinal} time they played it${nightLine ? `: ${nightLine}` : ""}`
            }
          >
            <span className="sb-cue__disc">
              <NoteIcon playing={isPlaying} />
            </span>
            <span className="sb-cue__text">
              <span className="sb-cue__kicker">
                {isPlaying ? "Now spinning" : `Hear the ${ordinal} one`}
              </span>
              {nightLine && <span className="sb-cue__night">{nightLine}</span>}
              {end.note && <span className="sb-cue__note">{end.note}</span>}
            </span>
          </button>
        ) : null}

        <Link
          to={issueHref}
          // Neither end could be offered (no date, or the Archive said neither
          // night is on tape), so the issue is the way in, torn off the same way.
          className={`sb-more${end ? "" : " sb-more--torn"}`}
          onClick={() => trackCtaClick("hero_songbook_read", issueHref)}
        >
          {finding && <span className="sb-more__n">{finding.count}</span>}
          <span className="sb-more__text" style={finding ? undefined : { gridColumn: "1 / -1" }}>
            {findingLine && <span className="sb-more__line">{findingLine}</span>}
            {finding?.kind === "sleepers" && (
              <span className="sb-more__sub">Real regard, almost no attention.</span>
            )}
            <span className="sb-more__go">
              {readLabel} <span aria-hidden="true">→</span>
            </span>
          </span>
        </Link>
      </article>
    </>
  );
};

export default SongbookSpotlightCard;
