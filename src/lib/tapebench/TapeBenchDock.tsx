/**
 * TapeBench's hand on the app. Compiled in ONLY when the build sets
 * VITE_TAPEBENCH=1 (see App.tsx); a production bundle never contains it.
 *
 * The bench navigates to the tap's real route, writes the tap's spec to
 * `window.__tapebenchSpec`, and clicks the button below with a real pointer.
 * The click handler then makes the same calls, in the same order, that the
 * named surface makes in its own handler — the same exported functions, not
 * a copy of them:
 *
 *   version_picker / issue   playVersion: unlockAudio, beginTap, then (no url)
 *                            findRecordingForDate → playSingle with url+track
 *   landing_pick             the picker's hero on the debut: the same
 *   songbook_spotlight       handleCue: unlockAudioInGesture, beginTap,
 *                            playSingle(spotlightSlot(...)) — cold, no prewarm
 *   setlist_poster           handlePlaySong: playSingle on the real slot id,
 *                            so the precomputed playability table is consulted
 *
 * What it does NOT reproduce is page state built before the tap (the
 * poster's per-page archive prefetch, the spotlight's prewarm). Those make
 * real taps faster than these, so the bench errs slow.
 *
 * Measurement is the tap telemetry's own record (src/lib/player/tapTelemetry)
 * plus the moment each on-screen answer appears, observed from the click.
 */
import { useEffect, useRef } from "react";
import { useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { findNight } from "@/lib/tapeIndex";
import { abandonPendingTap, beginTap, type TapSurface } from "@/lib/player/tapTelemetry";
import { unlockAudioInGesture } from "@/lib/player/gestureUnlock";
import { spotlightSlot } from "@/lib/songbookSpotlight";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";

export interface TapeBenchSpec {
  id: string;
  surface: "version_picker" | "landing_pick" | "songbook_spotlight" | "setlist_poster" | "issue";
  songId: string;
  title: string;
  showDate: string | null;
  archiveUrl: string | null;
  slotId?: string | null;
  key?: string;
}

/** What appeared on screen, in ms from the click. */
export interface TapeBenchMarks {
  clickAt: number;
  ack?: number;
  crate?: number;
  oops?: number;
  barError?: number;
  toast?: number;
  autoplayPrompt?: number;
  planB?: number;
  lookupError?: string;
}

type BenchWindow = Window & {
  __tapebenchSpec?: TapeBenchSpec;
  __tapebenchMarks?: TapeBenchMarks;
};

const SURFACE: Record<TapeBenchSpec["surface"], TapSurface> = {
  version_picker: "version_picker",
  landing_pick: "version_picker",
  songbook_spotlight: "songbook_spotlight",
  setlist_poster: "setlist_poster",
  issue: "version_picker",
};

const MARKS: Array<[keyof TapeBenchMarks, string]> = [
  ["ack", "[data-tap-ack]"],
  ["crate", "[data-crate-digging]"],
  ["oops", "[data-playback-oops]"],
  ["barError", "[data-player-error]"],
  ["toast", "[data-sonner-toast]"],
  ["autoplayPrompt", '[aria-label="Tap to start the tape"]'],
  ["planB", "[data-plan-b]"],
];

const TapeBenchDock = () => {
  const { playSingle, unlockAudio, reportPlaybackFailure } = useAudioPlayer();
  const observer = useRef<MutationObserver | null>(null);

  useEffect(() => () => observer.current?.disconnect(), []);

  const watch = (marks: TapeBenchMarks) => {
    observer.current?.disconnect();
    const check = () => {
      const t = Math.round(performance.now() - marks.clickAt);
      for (const [key, sel] of MARKS) {
        if (marks[key] === undefined && document.querySelector(sel)) (marks as unknown as Record<string, number>)[key] = t;
      }
    };
    observer.current = new MutationObserver(check);
    observer.current.observe(document.body, { childList: true, subtree: true, attributes: true });
    check();
  };

  const versionSlot = (spec: TapeBenchSpec, url: string | null, track: string | null): PlayableSlot => ({
    id: `picker-${spec.songId}-${spec.key ?? spec.showDate}`,
    song: { id: spec.songId, title: spec.title },
    version: {
      ...SYNTHETIC_VERSION_DEFAULTS,
      id: `archive-picker-${spec.key ?? spec.showDate}`,
      song_id: spec.songId,
      show_date: spec.showDate ?? "",
      archive_org_url: url,
    },
    setNumber: 1,
    position: 0,
    segueToNext: false,
    directTrackUrl: track,
  });

  const onClick = async () => {
    const w = window as BenchWindow;
    const spec = w.__tapebenchSpec;
    if (!spec) return;
    const marks: TapeBenchMarks = { clickAt: performance.now() };
    w.__tapebenchMarks = marks;
    watch(marks);

    if (spec.surface === "songbook_spotlight") {
      unlockAudioInGesture();
      beginTap("songbook_spotlight", { songId: spec.songId, title: spec.title, showDate: spec.showDate, hasPrecomputed: false });
      void playSingle(
        spotlightSlot(
          { slug: `bench-${spec.songId}`, songId: spec.songId, title: spec.title },
          { which: spec.key === "last" ? "last" : "first", date: spec.showDate, label: null, year: spec.showDate?.slice(0, 4) ?? null, note: null, venue: null, city: null, archiveUrl: null, versionId: null },
          null,
        ),
      );
      return;
    }

    if (spec.surface === "setlist_poster") {
      // handlePlaySong: no unlock of its own; playSingle does it in the tap.
      void playSingle({
        id: spec.slotId ?? spec.id,
        song: { id: spec.songId, title: spec.title },
        version: {
          ...SYNTHETIC_VERSION_DEFAULTS,
          id: `bench-${spec.slotId ?? spec.id}`,
          song_id: spec.songId,
          show_date: spec.showDate ?? "",
          archive_org_url: spec.archiveUrl,
        },
        setNumber: 1,
        position: 0,
        segueToNext: false,
        directTrackUrl: null,
      });
      return;
    }

    // The version picker's playVersion (and the hero, which is playVersion on
    // the debut), for the picker, the landing pick and a reported night.
    unlockAudio();
    beginTap(SURFACE[spec.surface], { songId: spec.songId, title: spec.title, showDate: spec.showDate, hasPrecomputed: false });
    let url = spec.archiveUrl;
    let track: string | null = null;
    let stream: string | null = null;
    if (!url) {
      if (!spec.showDate) return;
      try {
        const tape = await findNight(spec.title, spec.showDate, spec.songId);
        if (!tape?.url) {
          reportPlaybackFailure({ kind: "no_tape", songId: spec.songId, songTitle: spec.title, showDate: spec.showDate });
          return;
        }
        url = tape.url;
        track = tape.directTrackUrl ?? null;
        stream = tape.streamUrl ?? null;
      } catch (e) {
        // As VersionPicker does: the Archive could not be asked.
        marks.lookupError = String(e).slice(0, 120);
        abandonPendingTap("unreachable", "lookup");
        return;
      }
    }
    void playSingle({ ...versionSlot(spec, url, track), streamUrl: stream });
  };

  return (
    <button
      id="tapebench-tap"
      type="button"
      onClick={() => void onClick()}
      // Out of the way of everything the bench measures, but a real target:
      // the iOS policy shim and WebKit's own activation both need a real click.
      style={{ position: "fixed", top: 0, left: 0, width: 24, height: 24, opacity: 0.01, zIndex: 2147483647 }}
      aria-hidden="true"
      tabIndex={-1}
    />
  );
};

export default TapeBenchDock;
