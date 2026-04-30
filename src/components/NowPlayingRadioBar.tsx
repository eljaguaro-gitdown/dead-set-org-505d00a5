import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Radio, X, RotateCcw } from "lucide-react";
import { useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";

interface RadioTrack {
  title: string;
  venue: string;
  date: string;
  archiveUrl: string;
}

/**
 * Curated ambient pool — mirrors AmbientPlayer's archive picks so the
 * "Start the radio" CTA always lands on a verified Archive.org recording.
 */
const RADIO_POOL: RadioTrack[] = [
  { title: "Scarlet Begonias → Fire on the Mountain", venue: "Barton Hall, Cornell", date: "5/8/77", archiveUrl: "https://archive.org/details/gd1977-05-08.152379.aud.petrunis.flac2448" },
  { title: "Eyes of the World", venue: "Winterland", date: "10/18/74", archiveUrl: "https://archive.org/details/gd1974-10-18.176647.sony.ecm250.falanga.menke.miller.clugston.flac2496" },
  { title: "Dark Star", venue: "Fillmore West", date: "2/27/69", archiveUrl: "https://archive.org/details/gd1969-02-27.132573.sbd.16track.healy-latvala-wise.flac16" },
  { title: "China Cat → I Know You Rider", venue: "Lyceum, London", date: "5/26/72", archiveUrl: "https://archive.org/details/gd1972-05-26.sbd.smith.94452.sbeok.flac16" },
  { title: "Help on the Way → Slipknot!", venue: "Great American Music Hall", date: "8/13/75", archiveUrl: "https://archive.org/details/gd1975-08-13.155570.FM.flegel.flac1644" },
  { title: "Terrapin Station", venue: "Winterland", date: "12/31/78", archiveUrl: "https://archive.org/details/gd78-12-31.sbd.ashley.1667.sbeok.shnf" },
  { title: "Morning Dew", venue: "Barton Hall, Cornell", date: "5/8/77", archiveUrl: "https://archive.org/details/gd1977-05-08.152379.aud.petrunis.flac2448" },
  { title: "Standing on the Moon", venue: "Shoreline", date: "6/21/89", archiveUrl: "https://archive.org/details/gd1989-06-21.151620.UltraMatrix.sbd.cm.miller.t.flac16" },
];

const DISMISS_KEY = "nowPlayingBar.dismissed"; // "1" = dismissed
const LAST_TRACK_KEY = "nowPlayingBar.lastTrack"; // JSON RadioTrack
const WAS_PLAYING_KEY = "nowPlayingBar.wasPlaying"; // "1" if user was actively listening

const readDismissed = (): boolean => {
  try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
};
const readLastTrack = (): RadioTrack | null => {
  try {
    const raw = localStorage.getItem(LAST_TRACK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.title && parsed?.archiveUrl) return parsed as RadioTrack;
    return null;
  } catch { return null; }
};
const readWasPlaying = (): boolean => {
  try { return localStorage.getItem(WAS_PLAYING_KEY) === "1"; } catch { return false; }
};

const NowPlayingRadioBar = () => {
  const { playSingle, playingSlot, stopPlayback, playlistMode, playlistSlots, playlistIndex } = useAudioPlayer();

  const barRef = useRef<HTMLDivElement | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(readDismissed);
  const [lastTrack, setLastTrack] = useState<RadioTrack | null>(readLastTrack);
  // True when a previous session was actively playing the radio — show "Resume" affordance.
  const [pendingResume, setPendingResume] = useState<boolean>(() => readWasPlaying() && !!readLastTrack());

  const isLive = !!playingSlot;

  // Pick a fresh ambient track per session, but prefer the last one the user heard.
  const fallbackAmbient = useMemo(() => RADIO_POOL[Math.floor(Math.random() * RADIO_POOL.length)], []);
  const ambient = lastTrack ?? fallbackAmbient;

  // Persist whether radio is actively playing (across reloads).
  // We only consider it the "radio" when the playing slot id starts with "radio-".
  const isRadioSlot = !!playingSlot && playingSlot.id.startsWith("radio-");
  useEffect(() => {
    try {
      if (isRadioSlot) {
        localStorage.setItem(WAS_PLAYING_KEY, "1");
      } else if (!isLive) {
        // Cleared playback (user hit stop, or finished) — forget the "wasPlaying" flag.
        localStorage.setItem(WAS_PLAYING_KEY, "0");
      }
    } catch {}
  }, [isRadioSlot, isLive]);

  // Once anything starts playing, the "pending resume" prompt is no longer relevant.
  useEffect(() => {
    if (isLive && pendingResume) setPendingResume(false);
    if (isLive && dismissed) setDismissed(false);
  }, [isLive, pendingResume, dismissed]);

  /** Build a PlayableSlot from a RadioTrack and start playback. */
  const startTrack = (track: RadioTrack) => {
    const slot: PlayableSlot = {
      id: `radio-${track.archiveUrl}`,
      song: { id: `radio-song`, title: track.title },
      version: {
        id: `radio-version`,
        song_id: `radio-song`,
        show_date: track.date,
        venue: track.venue,
        archive_org_url: track.archiveUrl,
        description: null,
        city: null,
        era_id: null,
        rating: null,
      },
      setNumber: 1,
      position: 0,
      segueToNext: false,
    };
    try { localStorage.setItem(LAST_TRACK_KEY, JSON.stringify(track)); } catch {}
    setLastTrack(track);
    playSingle(slot);
  };

  const handleToggle = () => {
    if (isLive) {
      stopPlayback();
      return;
    }
    startTrack(ambient);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      localStorage.setItem(DISMISS_KEY, "1");
      // Dismissing the bar also implicitly cancels any pending resume.
      localStorage.setItem(WAS_PLAYING_KEY, "0");
    } catch {}
    setDismissed(true);
    setPendingResume(false);
  };

  // Hide entirely when dismissed AND nothing is playing AND no resume to offer.
  if (dismissed && !isLive) return null;

  const display = isLive
    ? {
        title: playingSlot.song.title,
        meta: [playingSlot.version?.venue, playingSlot.version?.show_date].filter(Boolean).join(" · "),
      }
    : {
        title: ambient.title,
        meta: `${ambient.venue} · ${ambient.date}`,
      };

  const labelPrefix = isLive
    ? (playlistMode ? `Setlist · ${playlistIndex + 1}/${playlistSlots.length}` : "Now playing")
    : pendingResume
      ? "Tap to resume the radio"
      : "Tap to start the radio";

  return (
    <div
      ref={barRef}
      className="fixed top-0 left-0 right-0 z-50 border-b border-primary/15 bg-background/95 backdrop-blur-md"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      role="region"
      aria-label="Radio bar"
    >
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-3 px-3 sm:px-4 py-2 text-left group"
        aria-label={isLive ? "Stop playback" : pendingResume ? "Resume the radio" : "Start the radio"}
      >
        {/* Play / Pause / Resume */}
        <span className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors shrink-0">
          {isLive ? (
            <Pause className="w-3.5 h-3.5 text-primary fill-primary" />
          ) : pendingResume ? (
            <RotateCcw className="w-3.5 h-3.5 text-primary" />
          ) : (
            <Play className="w-3.5 h-3.5 text-primary fill-primary ml-0.5" />
          )}
        </span>

        {/* Equalizer / radio icon */}
        <span className="hidden sm:flex items-end gap-[2px] h-3.5 shrink-0" aria-hidden>
          {isLive ? (
            [1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-[2px] rounded-full bg-primary/70 animate-eq"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))
          ) : (
            <Radio className="w-4 h-4 text-primary/70" />
          )}
        </span>

        {/* Track / CTA copy */}
        <span className="flex flex-col min-w-0 flex-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-primary/70 font-mono leading-none mb-0.5 truncate">
            {labelPrefix}
          </span>
          <span className="text-sm sm:text-base font-body text-foreground truncate leading-tight">
            <span className="font-semibold">{display.title}</span>
            {display.meta && (
              <span className="text-muted-foreground font-normal"> — {display.meta}</span>
            )}
          </span>
        </span>

        {/* Dismiss (only when idle) */}
        {!isLive && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleDismiss}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleDismiss(e as unknown as React.MouseEvent); }}
            className="ml-1 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors shrink-0"
            aria-label="Hide radio bar"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>
    </div>
  );
};

export default NowPlayingRadioBar;
