import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useDragControls } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, X, Loader2, Cast, ChevronRight, GripHorizontal, SkipForward, SkipBack, FastForward } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import PosterModal from "@/components/PosterModal";
import { findTrackInRecording, matchScore } from "@/lib/archiveOrg";
import { audioDebug } from "@/lib/audioDebug";
import {
  pausePlayEvent,
  resumePlayEvent,
  setPlayEventTrackDuration,
  finalizePlayEvent,
} from "@/lib/playEventTracker";

interface Track {
  title: string;
  src: string;
}

interface AudioPlayerProps {
  archiveUrl: string;
  songTitle: string;
  showDate: string;
  venue?: string | null;
  autoPlay?: boolean;
  singleTrackMode?: boolean;
  directTrackUrl?: string | null;
  onClose: () => void;
  onEnded?: () => void;
  playlistInfo?: { current: number; total: number } | null;
  onNext?: () => void;
  onPrev?: () => void;
  activeSetlistId?: string | null;
}

// Default seconds of no `timeupdate` before we treat a playlist track as stalled and skip it.
// Override at runtime via `localStorage.setItem("playlistStallTimeoutMs", "20000")`.
const DEFAULT_STALL_TIMEOUT_MS = 12000;

const readStallTimeoutMs = (): number => {
  if (typeof window === "undefined") return DEFAULT_STALL_TIMEOUT_MS;
  const raw = Number(window.localStorage.getItem("playlistStallTimeoutMs"));
  // Clamp: 0 disables, otherwise require a sane minimum so we don't skip prematurely.
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_STALL_TIMEOUT_MS;
  return Math.max(3000, raw);
};

const AudioPlayer = ({ archiveUrl, songTitle, showDate, venue, autoPlay = false, singleTrackMode = false, directTrackUrl, onClose, onEnded, playlistInfo, onNext, onPrev, activeSetlistId }: AudioPlayerProps) => {
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  // Intent state — what the USER wants, independent of what the <audio>
  // element is actually doing. During an iOS phone-call interruption the
  // element's `paused` flips to true, but `userWantsToPlay` stays true so
  // we know to resume once the interruption ends.
  const [userWantsToPlay, setUserWantsToPlay] = useState(autoPlay);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dragControls = useDragControls();
  const [posterOpen, setPosterOpen] = useState(false);
  const y = useMotionValue(0);
  // Persisted vertical offset (negative = lifted up). Restored across mounts.
  const [yOffset, setYOffset] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const stored = Number(window.localStorage.getItem("audioPlayerYOffset"));
    return Number.isFinite(stored) ? stored : 0;
  });
  useEffect(() => { y.set(yOffset); }, [yOffset, y]);

  // Stall watchdog: if no `timeupdate` fires within the configured window while
  // actively playing, attempt one retry (re-resolve + reload). If the retry also
  // stalls, fall back to advancing the playlist when in playlist mode.
  const lastTimeUpdateRef = useRef<number>(Date.now());
  const stallTimeoutMsRef = useRef<number>(readStallTimeoutMs());
  // Tracks whether we've already attempted a retry for the current track/src.
  // Reset whenever the resolved track src changes (new track or re-resolution).
  const retriedRef = useRef<boolean>(false);
  const [retrying, setRetrying] = useState(false);

  // Re-resolve the current song's track URL from archive.org and swap it in.
  // Used by the retry flow when playback stalls or errors mid-song.
  const attemptRetry = useCallback(async (reason: "stall" | "error") => {
    if (retriedRef.current) return false;
    retriedRef.current = true;
    setRetrying(true);
    audioDebug.log("player", "retry initiated", { song: songTitle, reason }, "warn");
    console.warn("[AudioPlayer] retry initiated", { songTitle, reason });

    const resumeAt = audioRef.current?.currentTime ?? 0;
    try {
      // Prefer re-resolving via archive.org so a transient CDN miss can
      // produce a fresh download URL. Fall back to the existing src.
      let nextUrl: string | null = null;
      if (archiveUrl) {
        nextUrl = await findTrackInRecording(archiveUrl, songTitle);
      }
      const finalUrl = nextUrl || tracks[currentTrack]?.src || null;
      if (!finalUrl) {
        audioDebug.log("player", "retry failed — no URL", { song: songTitle }, "error");
        setRetrying(false);
        return false;
      }
      setTracks((prev) => {
        const copy = [...prev];
        if (copy[currentTrack]) copy[currentTrack] = { ...copy[currentTrack], src: finalUrl };
        return copy;
      });
      // Give React a tick to apply the new src, then reload + seek + play.
      setTimeout(() => {
        const el = audioRef.current;
        if (!el) return;
        try {
          el.load();
          const onLoaded = () => {
            try { if (resumeAt > 1) el.currentTime = Math.max(0, resumeAt - 1); } catch {}
            el.play().catch(() => {});
            el.removeEventListener("loadedmetadata", onLoaded);
          };
          el.addEventListener("loadedmetadata", onLoaded);
        } catch {}
        lastTimeUpdateRef.current = Date.now();
        setRetrying(false);
        setPlaying(true);
      }, 50);
      audioDebug.log("player", "retry applied", { song: songTitle, url: finalUrl, resumeAt });
      return true;
    } catch (e) {
      audioDebug.log("player", "retry threw", { song: songTitle, error: String(e) }, "error");
      setRetrying(false);
      return false;
    }
  }, [archiveUrl, songTitle, tracks, currentTrack]);

  // Reset the retry budget whenever we switch tracks or the resolved src changes.
  useEffect(() => {
    retriedRef.current = false;
  }, [currentTrack, tracks[currentTrack]?.src]);

  useEffect(() => {
    if (!playing || !!error) return;
    lastTimeUpdateRef.current = Date.now();
    const intervalMs = 1500;
    const interval = window.setInterval(async () => {
      if (retrying) return;
      const elapsed = Date.now() - lastTimeUpdateRef.current;
      if (elapsed < stallTimeoutMsRef.current) return;

      // First stall: try one retry before giving up.
      if (!retriedRef.current) {
        window.clearInterval(interval);
        const ok = await attemptRetry("stall");
        if (!ok && singleTrackMode && onEnded) {
          setPlaying(false);
          onEnded();
        }
        return;
      }

      // Already retried — skip if we can, otherwise just stop.
      audioDebug.log("player", "stall after retry — giving up", { song: songTitle, elapsedMs: elapsed }, "warn");
      console.warn("[AudioPlayer] stall after retry — giving up", { songTitle, elapsedMs: elapsed });
      window.clearInterval(interval);
      setPlaying(false);
      if (singleTrackMode && onEnded) onEnded();
    }, intervalMs);
    return () => window.clearInterval(interval);
  }, [singleTrackMode, onEnded, playing, error, songTitle, currentTrack, attemptRetry, retrying]);

  const getIdentifier = useCallback((url: string) => {
    const match = url.match(/archive\.org\/details\/([^/?#]+)/);
    return match?.[1] || null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchTracks = async () => {
      setLoading(true);
      setError(null);
      setTracks([]);
      setCurrentTrack(0);

      // If we already know the exact track, use it immediately.
      if (directTrackUrl) {
        setTracks([{ title: songTitle, src: directTrackUrl }]);
        setLoading(false);
        return;
      }

      const identifier = getIdentifier(archiveUrl);
      if (!identifier) {
        setError("Invalid archive.org URL");
        setLoading(false);
        return;
      }

      try {
        // First try to resolve the exact song inside this recording.
        audioDebug.log("player", "resolving track in recording", { identifier, song: songTitle });
        const resolvedTrackUrl = await findTrackInRecording(archiveUrl, songTitle);
        if (cancelled) return;
        if (resolvedTrackUrl) {
          audioDebug.log("player", "track resolved", { url: resolvedTrackUrl });
          setTracks([{ title: songTitle, src: resolvedTrackUrl }]);
          setLoading(false);
          return;
        }

        // Only fall back to fuzzy matching if exact resolution fails.
        audioDebug.log("player", "exact resolve failed — fetching metadata for fuzzy match", { identifier }, "warn");
        const res = await fetch(`https://archive.org/metadata/${identifier}`);
        if (cancelled) return;
        if (!res.ok) throw new Error("Failed to fetch metadata");
        const meta = await res.json();
        if (cancelled) return;

        const audioFiles = (meta.files || [])
          .filter((f: any) =>
            f.format === "VBR MP3" || f.format === "Ogg Vorbis" ||
            f.name?.endsWith(".mp3") || f.name?.endsWith(".ogg")
          )
          .sort((a: any, b: any) => (a.track || a.name || "").localeCompare(b.track || b.name || ""))
          .map((f: any) => ({
            title: f.title || f.name?.replace(/\.[^.]+$/, "") || "Unknown",
            src: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`,
          }));

        if (audioFiles.length === 0) {
          audioDebug.log("player", "no audio files in recording", { identifier }, "error");
          setError("No audio files found");
        } else {
          setTracks(audioFiles);
          let bestIdx = 0;
          let bestScore = 0;
          audioFiles.forEach((t: Track, i: number) => {
            const score = matchScore(t.title, songTitle);
            if (score > bestScore) {
              bestScore = score;
              bestIdx = i;
            }
          });
          audioDebug.log("player", "fuzzy match selected", { index: bestIdx, score: bestScore, total: audioFiles.length });
          setCurrentTrack(bestIdx);
        }
      } catch (e) {
        if (!cancelled) {
          audioDebug.log("player", "metadata fetch failed", { identifier, error: String(e) }, "error");
          setError("Couldn't load audio from archive.org");
        }
      }
      if (!cancelled) setLoading(false);
    };

    fetchTracks();
    return () => { cancelled = true; };
  }, [archiveUrl, songTitle, getIdentifier, directTrackUrl]);

  // If track resolution fails while in a playlist, skip ahead instead of stalling.
  useEffect(() => {
    if (error && singleTrackMode && onEnded) {
      console.warn("[AudioPlayer] resolution failed in playlist — auto-advancing", { songTitle, error });
      const t = setTimeout(() => onEnded(), 600);
      return () => clearTimeout(t);
    }
  }, [error, singleTrackMode, onEnded, songTitle]);

  useEffect(() => {
    const el = audioRef.current;
    if (tracks.length === 0 || !el) return;
    el.load();
    if (!(playing || autoPlay)) return;
    setPlaying(true);

    // First attempt: try immediately. May reject if the source isn't yet
    // buffered enough — that's expected after a remount when auto-advancing
    // to the next song in a setlist.
    const tryPlay = () => el.play().catch(() => {});
    tryPlay();

    // Fallback: when the browser signals it CAN play, retry if still paused.
    // Without this, the next song in a setlist often loads but never starts
    // because the immediate play() after the AudioPlayer remount lost the race.
    const onCanPlay = () => {
      if (el.paused) tryPlay();
    };
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("loadeddata", onCanPlay);
    return () => {
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("loadeddata", onCanPlay);
    };
  }, [currentTrack, tracks, autoPlay]);

  // Defense in depth: when this player unmounts (slot change or close), forcibly
  // pause + detach the audio element so a previously-buffered stream can never
  // continue playing while a new player instance is starting.
  useEffect(() => {
    return () => {
      const el = audioRef.current;
      if (!el) return;
      try {
        el.pause();
        el.removeAttribute("src");
        el.load();
      } catch { /* noop */ }
    };
  }, []);

  // iOS / Android lock-screen "Now Playing" metadata + interruption recovery.
  // Critical for iOS: when a phone call interrupts playback, iOS pauses the
  // audio element. Without Media Session action handlers, the OS has no way
  // to resume us after the call ends — the lock-screen play button stays
  // greyed out and tapping our in-app play button hits a stale state.
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported action */ }
    };
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: songTitle || "Dead-Set.Org",
        artist: "Dead-Set.Org",
        album: venue ? `${venue}${showDate ? ` • ${showDate}` : ""}` : "The music never stopped.",
        artwork: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });
    } catch { /* metadata unsupported */ }

    setHandler("play", () => {
      const el = audioRef.current;
      if (!el) return;
      setUserWantsToPlay(true);
      el.play().then(() => {
        setPlaying(true);
        audioDebug.setPlaybackState("playing");
        resumePlayEvent();
        try { navigator.mediaSession.playbackState = "playing"; } catch {}
      }).catch((e) => {
        audioDebug.log("player", "mediaSession play rejected", { error: String(e) }, "error");
      });
    });
    setHandler("pause", () => {
      const el = audioRef.current;
      if (!el) return;
      setUserWantsToPlay(false);
      el.pause();
      setPlaying(false);
      audioDebug.setPlaybackState("paused");
      pausePlayEvent();
      try { navigator.mediaSession.playbackState = "paused"; } catch {}
    });
    setHandler("stop", () => {
      setUserWantsToPlay(false);
      audioRef.current?.pause();
      setPlaying(false);
      try { navigator.mediaSession.playbackState = "paused"; } catch {}
    });
    setHandler("nexttrack", onNext ? () => onNext() : null);
    setHandler("previoustrack", onPrev ? () => onPrev() : null);
    setHandler("seekbackward", (details) => {
      const el = audioRef.current;
      if (!el) return;
      el.currentTime = Math.max(0, el.currentTime - (details.seekOffset ?? 10));
    });
    setHandler("seekforward", (details) => {
      const el = audioRef.current;
      if (!el) return;
      el.currentTime = Math.min(el.duration || 0, el.currentTime + (details.seekOffset ?? 10));
    });
    setHandler("seekto", (details) => {
      const el = audioRef.current;
      if (!el || details.seekTime == null) return;
      if (details.fastSeek && "fastSeek" in el) {
        (el as HTMLAudioElement & { fastSeek: (t: number) => void }).fastSeek(details.seekTime);
      } else {
        el.currentTime = details.seekTime;
      }
    });

    return () => {
      (["play","pause","stop","nexttrack","previoustrack","seekbackward","seekforward","seekto"] as MediaSessionAction[])
        .forEach((a) => setHandler(a, null));
    };
  }, [songTitle, venue, showDate, onNext, onPrev]);

  // Keep playback state + scrubbable position in sync with the OS widget.
  // setPositionState gives iOS the data it needs to draw the lock-screen
  // scrubber AND to correctly restore playback after an interruption.
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    } catch { /* noop */ }
    try {
      if (duration > 0 && Number.isFinite(duration) && navigator.mediaSession.setPositionState) {
        navigator.mediaSession.setPositionState({
          duration,
          position: Math.min(progress, duration),
          playbackRate: audioRef.current?.playbackRate ?? 1,
        });
      }
    } catch { /* noop */ }
  }, [playing, progress, duration]);

  // CRITICAL iOS FIX: mirror the audio element's own play/pause events into
  // our React state. When iOS interrupts for a phone call it pauses the
  // <audio> directly — without this listener our `playing` state drifts out
  // of sync, the in-app button shows the wrong icon, and Media Session's
  // "play" action can't resume cleanly. Syncing here lets the lock-screen
  // Play button (handled above) bring playback back to life after the call.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => {
      setPlaying(true);
      audioDebug.setPlaybackState("playing");
      try { navigator.mediaSession.playbackState = "playing"; } catch {}
    };
    const onPause = () => {
      // Ignore pause events fired during end-of-track teardown.
      if (el.ended) return;
      setPlaying(false);
      audioDebug.setPlaybackState("paused");
      try { navigator.mediaSession.playbackState = "paused"; } catch {}
    };
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, []);

  // iOS interruption recovery: resume playback once the OS lets us back in.
  // Listens for the events iOS fires around phone calls, Siri, route changes,
  // and tab visibility flips. Only acts if `userWantsToPlay` is still true —
  // a user-initiated pause is left alone.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible" && userWantsToPlay && audio.paused) {
        try {
          await audio.play();
        } catch (err) {
          console.warn("Resume failed after visibility change:", err);
        }
      }
    };

    const handleAudioPause = () => {
      // Audio paused but intent is still "play" — treat as an OS interruption.
      // Don't mutate userWantsToPlay; the visibility/stalled handlers will
      // attempt recovery when the OS hands us back.
      if (userWantsToPlay) {
        console.log("Playback interrupted (likely iOS audio session)");
      }
    };

    const handleStalled = async () => {
      if (userWantsToPlay && audio.paused) {
        const currentTime = audio.currentTime;
        audio.load();
        audio.currentTime = currentTime;
        try {
          await audio.play();
        } catch (err) {
          console.warn("Stalled recovery failed:", err);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    audio.addEventListener("pause", handleAudioPause);
    audio.addEventListener("stalled", handleStalled);
    audio.addEventListener("suspend", handleStalled);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      audio.removeEventListener("pause", handleAudioPause);
      audio.removeEventListener("stalled", handleStalled);
      audio.removeEventListener("suspend", handleStalled);
    };
  }, [userWantsToPlay]);

  // Fallback recovery: when auto-resume fails (iOS sometimes refuses
  // .play() until a fresh user gesture), surface a "Tap to resume" overlay
  // after 2s of divergence between intent and reality.
  const [needsResume, setNeedsResume] = useState(false);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let timeoutId: number | null = null;

    const evaluate = () => {
      if (timeoutId) { window.clearTimeout(timeoutId); timeoutId = null; }
      if (!userWantsToPlay || !audio.paused || document.visibilityState !== "visible") {
        setNeedsResume(false);
        return;
      }
      timeoutId = window.setTimeout(() => {
        if (userWantsToPlay && audio.paused && document.visibilityState === "visible") {
          setNeedsResume(true);
        }
      }, 2000);
    };

    const clear = () => {
      if (timeoutId) { window.clearTimeout(timeoutId); timeoutId = null; }
      setNeedsResume(false);
    };

    evaluate();
    audio.addEventListener("pause", evaluate);
    audio.addEventListener("play", clear);
    audio.addEventListener("playing", clear);
    document.addEventListener("visibilitychange", evaluate);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      audio.removeEventListener("pause", evaluate);
      audio.removeEventListener("play", clear);
      audio.removeEventListener("playing", clear);
      document.removeEventListener("visibilitychange", evaluate);
    };
  }, [userWantsToPlay]);

  const handleManualResume = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setNeedsResume(false);
    } catch (err) {
      console.warn("Manual resume failed:", err);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      setUserWantsToPlay(false);
      audioRef.current.pause();
      audioDebug.setPlaybackState("paused");
      pausePlayEvent();
    } else {
      setUserWantsToPlay(true);
      audioRef.current.play().catch((e) => {
        audioDebug.log("player", "play() rejected", { error: String(e) }, "error");
      });
      audioDebug.setPlaybackState("playing");
      resumePlayEvent();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    lastTimeUpdateRef.current = Date.now();
    setProgress(audioRef.current.currentTime);
    const dur = audioRef.current.duration || 0;
    setDuration(dur);
    if (dur > 0) setPlayEventTrackDuration(dur * 1000);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value[0];
    setProgress(value[0]);
  };

  const handleEnded = () => {
    audioDebug.log("player", "track ended", { song: songTitle });
    audioDebug.setPlaybackState("ended");
    console.log("[AudioPlayer] track ended", { songTitle, singleTrackMode, hasOnEnded: !!onEnded });
    void finalizePlayEvent("finished");
    if (singleTrackMode) {
      setPlaying(false);
      onEnded?.();
      return;
    }
    if (currentTrack < tracks.length - 1) {
      setCurrentTrack((p) => p + 1);
    } else {
      setPlaying(false);
      onEnded?.();
    }
  };

  const handleAudioError = async () => {
    const src = tracks[currentTrack]?.src;
    audioDebug.log("player", "audio element error", { song: songTitle, src }, "error");
    audioDebug.setPlaybackState("error");
    console.warn("[AudioPlayer] audio error", { songTitle, src: track?.src });

    // Try one retry before giving up. Re-resolves the track URL and reloads.
    if (!retriedRef.current) {
      const ok = await attemptRetry("error");
      if (ok) return;
    }

    // Retry failed (or already used). In playlist mode, advance past the
    // broken track so the queue keeps moving.
    void finalizePlayEvent("error");
    if (singleTrackMode && onEnded) {
      setPlaying(false);
      onEnded();
    } else {
      setError("Couldn't play this track");
    }
  };

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const track = tracks[currentTrack];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        style={{ y }}
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0.05}
        dragConstraints={{ top: -window.innerHeight + 200, bottom: 0 }}
        onDragEnd={(_, info) => {
          const next = Math.min(0, Math.max(-window.innerHeight + 200, yOffset + info.offset.y));
          setYOffset(next);
          try { window.localStorage.setItem("audioPlayerYOffset", String(next)); } catch {}
        }}
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg shadow-2xl"
      >
        {/* Drag handle — lift the player up to reveal content beneath */}
        <button
          type="button"
          aria-label="Drag to reposition player"
          onPointerDown={(e) => dragControls.start(e)}
          onDoubleClick={() => {
            setYOffset(0);
            try { window.localStorage.setItem("audioPlayerYOffset", "0"); } catch {}
          }}
          className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 h-6 px-3 flex items-center justify-center rounded-full border border-border bg-card/95 backdrop-blur-lg text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none shadow-md"
          title="Drag to move · double-click to reset"
        >
          <GripHorizontal className="w-3.5 h-3.5" />
        </button>

        <audio
          ref={audioRef}
          src={track?.src}
          preload="auto"
          playsInline
          crossOrigin="anonymous"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onError={handleAudioError}
          onLoadedMetadata={handleTimeUpdate}
          muted={muted}
        />

        {/* iOS interruption fallback — appears only when auto-resume fails */}
        {needsResume && (
          <button
            type="button"
            onClick={handleManualResume}
            className="absolute inset-x-0 -top-10 mx-auto w-fit px-4 py-2 rounded-[10px] bg-background/95 border border-primary/40 text-primary font-mono uppercase tracking-[0.18em] text-sm shadow-lg hover:bg-background hover:border-primary transition-colors flex items-center gap-2"
            aria-label="Tap to resume playback"
          >
            <Play className="w-3.5 h-3.5" />
            Tap to resume
          </button>
        )}

        {/* Progress bar */}
        <div className="w-full h-1 bg-muted cursor-pointer" onClick={(e) => {
          if (!duration) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          handleSeek([pct * duration]);
        }}>
          <div
            className="h-full bg-primary transition-all duration-150"
            style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
          />
        </div>

        <div className="px-4 py-3 flex items-center gap-3">
          {/* Prominent Prev button — playlist mode only. Always enabled if there's a previous track. */}
          {playlistInfo && (
            <button
              onClick={onPrev}
              disabled={playlistInfo.current <= 1}
              className="w-9 h-9 rounded-full bg-muted/60 text-foreground flex items-center justify-center shrink-0 disabled:opacity-30 hover:bg-muted transition-colors"
              title="Previous song"
              aria-label="Previous song"
            >
              <SkipBack className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={togglePlay}
            disabled={loading || !!error}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-50 transition-all hover:brightness-110"
            aria-label={playing ? "Pause" : "Play"}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : playing ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          {/* Prominent Next button — playlist mode only. Always enabled, even mid-load or on error. */}
          {playlistInfo && (
            <button
              onClick={onNext}
              disabled={playlistInfo.current >= playlistInfo.total}
              className="w-9 h-9 rounded-full bg-muted/60 text-foreground flex items-center justify-center shrink-0 disabled:opacity-30 hover:bg-muted transition-colors"
              title="Next song"
              aria-label="Next song"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          )}

          {/* Skip — distinct from Next: useful when the current track refuses to load.
              Mirrors Next behavior but stays bright/visible during loading & error states. */}
          {playlistInfo && (loading || !!error) && (
            <button
              onClick={onNext}
              disabled={playlistInfo.current >= playlistInfo.total}
              className="h-9 px-2.5 rounded-md bg-destructive/15 text-destructive border border-destructive/30 flex items-center gap-1 shrink-0 disabled:opacity-30 hover:bg-destructive/25 transition-colors text-xs font-mono uppercase tracking-wider"
              title="Skip this track"
              aria-label="Skip this track"
            >
              <FastForward className="w-3.5 h-3.5" />
              Skip
            </button>
          )}

          <div
            className={`flex-1 min-w-0 ${activeSetlistId ? 'cursor-pointer' : ''}`}
            onClick={() => activeSetlistId && navigate(`/setlist/${activeSetlistId}`)}
          >
            {error ? (
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm text-destructive font-body truncate">{error}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    retriedRef.current = false;
                    setError(null);
                    setRetrying(false);
                    attemptRetry("error");
                  }}
                  className="h-7 px-2 rounded-md bg-muted/60 text-foreground border border-border text-[10px] font-mono uppercase tracking-wider hover:bg-muted transition-colors shrink-0"
                  title="Retry this track"
                >
                  Retry
                </button>
                {activeSetlistId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/setlist/${activeSetlistId}`);
                    }}
                    className="h-7 px-2 rounded-md bg-primary/15 text-primary border border-primary/30 text-[10px] font-mono uppercase tracking-wider hover:bg-primary/25 transition-colors shrink-0 flex items-center gap-1"
                    title="Back to setlist"
                  >
                    Setlist <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : (
              <>
                {playlistInfo && (
                  <p className="font-mono uppercase tracking-[0.18em] text-primary/70 text-[11px] sm:text-sm tabular-nums leading-none mb-1">
                    Song {playlistInfo.current} of {playlistInfo.total}
                  </p>
                )}
                <p className="text-base sm:text-lg text-foreground font-display truncate font-bold">
                  {songTitle}
                </p>
                <p className="text-sm sm:text-base text-primary/90 font-body truncate font-medium">
                  {showDate} {venue ? `· ${venue}` : ""}
                </p>
                {activeSetlistId && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/setlist/${activeSetlistId}`);
                      }}
                      className="h-7 px-3 rounded-md bg-primary text-primary-foreground border border-primary text-[11px] font-mono uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1 shrink-0"
                      title="Go to setlist"
                    >
                      Go to Setlist <ChevronRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPosterOpen(true);
                      }}
                      className="h-7 px-3 rounded-md bg-transparent text-primary border border-primary/40 text-[11px] font-mono uppercase tracking-wider hover:bg-primary/10 transition-all shrink-0 inline-flex items-center gap-1"
                      title="View poster"
                    >
                      View Poster
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <span className="text-[11px] text-muted-foreground font-mono tabular-nums shrink-0">
            {formatTime(progress)} / {formatTime(duration)}
          </span>

          <a href="https://archive.org" target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground font-body shrink-0 hidden sm:inline transition-colors">
            via archive.org
          </a>

          <Popover>
            <PopoverTrigger asChild>
              <button className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-primary shrink-0 transition-colors rounded-full" title="Cast to speakers">
                <Cast className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-72 text-xs font-body space-y-2 bg-card border-border">
              <p className="font-display text-sm text-foreground">🔊 Cast to Sonos & Speakers</p>
              <div className="space-y-1.5 text-muted-foreground">
                <p><strong className="text-foreground">Chrome:</strong> Menu (⋮) → "Cast…" → select your Sonos/Chromecast device</p>
                <p><strong className="text-foreground">macOS:</strong> Click the AirPlay icon in the menu bar → select your Sonos speaker</p>
                <p><strong className="text-foreground">iPhone/iPad:</strong> Open Control Center → tap AirPlay → select your Sonos</p>
                <p><strong className="text-foreground">Windows:</strong> Settings → Bluetooth & devices → pair your speaker</p>
              </div>
              <p className="text-[10px] text-muted-foreground/60 pt-1 border-t border-border">
                Sonos One, Beam, Arc, Era & Move support AirPlay 2
              </p>
            </PopoverContent>
          </Popover>

          <button onClick={() => setMuted(!muted)} className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 rounded-full transition-colors" title={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Only show track selector when NOT in single-track/direct mode */}
          {tracks.length > 1 && !singleTrackMode && !directTrackUrl && (
            <select
              value={currentTrack}
              onChange={(e) => {
                setCurrentTrack(Number(e.target.value));
                setPlaying(true);
              }}
              className="bg-muted border border-border rounded text-[10px] text-foreground font-body px-1 py-0.5 max-w-[100px] shrink-0"
            >
              {tracks.map((t, i) => (
                <option key={i} value={i}>
                  {t.title.length > 20 ? t.title.slice(0, 20) + "…" : t.title}
                </option>
              ))}
            </select>
          )}

          {playlistInfo && (
            <span className="text-sm text-muted-foreground font-mono tabular-nums shrink-0 hidden sm:inline" title="Position in setlist">
              {playlistInfo.current}/{playlistInfo.total}
            </span>
          )}

          <button onClick={onClose} className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 rounded-full transition-colors" title="Close player">
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
      <PosterModal
        open={posterOpen}
        songTitle={songTitle}
        showDate={showDate}
        venue={venue}
        setlistId={activeSetlistId ?? null}
        playlistInfo={playlistInfo ?? null}
        onClose={() => setPosterOpen(false)}
        onPrev={onPrev}
        onNext={onNext}
      />
    </AnimatePresence>
  );
};

export default AudioPlayer;
