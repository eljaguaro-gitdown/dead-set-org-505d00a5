import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useDragControls } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, X, Loader2, Cast, ChevronRight, GripHorizontal, SkipForward, SkipBack } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import PosterModal from "@/components/PosterModal";
import { EraMotif, eraNameFromDate } from "@/components/EraArt";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

/**
 * Player bar for the gapless engine. Pure UI shell — playback lives in the
 * single Queue owned by AudioPlayerContext, reached only through `transport`.
 * The progress fill is driven imperatively from a rAF loop reading the
 * engine's progress ref; time labels update from the ~4Hz subscription.
 * Neither path causes a React render per progress tick.
 */
const GaplessPlayerBar = () => {
  const navigate = useNavigate();
  const {
    playingSlot,
    playlistMode,
    playlistIndex,
    playlistSlots,
    activeSetlistId,
    stopPlayback,
    transport,
  } = useAudioPlayer();

  const [muted, setMuted] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);
  // Low-frequency (~4Hz) time labels; the bar fill never goes through state.
  const [labelTime, setLabelTime] = useState({ currentTime: 0, duration: 0 });
  const fillRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const dragControls = useDragControls();
  const y = useMotionValue(0);
  const [yOffset, setYOffset] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const stored = Number(window.localStorage.getItem("audioPlayerYOffset"));
    return Number.isFinite(stored) ? stored : 0;
  });
  useEffect(() => { y.set(yOffset); }, [yOffset, y]);

  // The transport object is rebuilt per provider render but delegates to the
  // same engine; hold it in a ref so the mount-once effects below always see
  // the latest without resubscribing every render.
  const transportRef = useRef(transport);
  transportRef.current = transport;

  // Progress fill via rAF reading the engine ref — smooth without renders.
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const p = transportRef.current.getProgress();
      if (fillRef.current) {
        const pct = p.duration > 0 ? Math.min(100, (p.currentTime / p.duration) * 100) : 0;
        fillRef.current.style.width = `${pct}%`;
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  // Throttled label updates from the engine's subscription (~4Hz).
  useEffect(() => {
    return transportRef.current.subscribeProgress((p) => setLabelTime(p));
  }, []);

  if (!playingSlot?.version) return null;

  const songTitle = playingSlot.song.title;
  const showDate = playingSlot.version.show_date;
  const venue = playingSlot.version.venue;
  const playlistInfo = playlistMode
    ? { current: playlistIndex + 1, total: playlistSlots.length }
    : null;

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const p = transport.getProgress();
    if (!p.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    transport.seek(pct * p.duration);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    transport.setVolume(next ? 0 : 1);
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={barRef}
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
          try { window.localStorage.setItem("audioPlayerYOffset", String(next)); } catch { /* noop */ }
        }}
        className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-dashed border-border bg-card paper-grain"
      >
        {/* Drag handle — lift the player up to reveal content beneath */}
        <button
          type="button"
          aria-label="Drag to reposition player"
          onPointerDown={(e) => dragControls.start(e)}
          onDoubleClick={() => {
            setYOffset(0);
            try { window.localStorage.setItem("audioPlayerYOffset", "0"); } catch { /* noop */ }
          }}
          className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 h-7 px-4 flex items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-card-foreground cursor-grab active:cursor-grabbing touch-none"
          title="Drag to move · double-click to reset"
        >
          <GripHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* Autoplay blocked — needs one tap to open the audio pipeline */}
        {transport.autoplayBlocked && (
          <button
            type="button"
            onClick={transport.play}
            className="absolute inset-x-0 -top-10 mx-auto w-fit px-4 py-2 rounded-[10px] bg-background/95 border border-primary/40 text-dead-gold font-mono uppercase tracking-[0.18em] text-sm shadow-lg hover:bg-background hover:border-primary transition-colors flex items-center gap-2"
            aria-label="Tap to start the tape"
          >
            <Play className="w-3.5 h-3.5" />
            Tap to start the tape
          </button>
        )}

        {/* Progress bar — fill width driven imperatively from the rAF loop */}
        <div className="w-full h-1 bg-muted cursor-pointer" onClick={handleSeekClick}>
          <div ref={fillRef} className="h-full bg-primary" style={{ width: "0%" }} />
        </div>

        <div className="px-4 py-3 flex items-center gap-3 max-sm:flex-wrap max-sm:gap-x-2 max-sm:gap-y-1.5">
          {playlistInfo && (
            <button
              onClick={transport.previous}
              disabled={playlistInfo.current <= 1}
              className="w-9 h-9 rounded-full bg-muted/60 text-card-foreground flex items-center justify-center shrink-0 disabled:opacity-30 hover:bg-muted transition-colors max-sm:order-1"
              title="Previous song"
              aria-label="Previous song"
            >
              <SkipBack className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={transport.togglePlayPause}
            disabled={transport.isLoading}
            className="w-12 h-12 rounded-full foil flex items-center justify-center shrink-0 disabled:opacity-50 transition-all hover:brightness-105 max-sm:order-2"
            aria-label={transport.isPlaying ? "Pause" : "Play"}
          >
            {transport.isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : transport.isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          {playlistInfo && (
            <button
              onClick={transport.next}
              disabled={playlistInfo.current >= playlistInfo.total}
              className="w-9 h-9 rounded-full bg-secondary text-card-foreground flex items-center justify-center shrink-0 disabled:opacity-30 hover:bg-muted transition-colors max-sm:order-3"
              title="Next song"
              aria-label="Next song"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          )}

          <div
            className={`flex-1 min-w-0 max-sm:order-5 max-sm:basis-0 ${activeSetlistId ? "cursor-pointer" : ""}`}
            onClick={() => activeSetlistId && navigate(`/setlist/${activeSetlistId}`)}
          >
            {playlistInfo && (
              <p className="font-mono uppercase tracking-[0.18em] text-accent-foreground text-[11px] sm:text-sm tabular-nums leading-none mb-1">
                Song {playlistInfo.current} of {playlistInfo.total}
              </p>
            )}
            <p className="text-base sm:text-lg text-card-foreground font-display truncate">
              {songTitle}
            </p>
            <p className="text-xs sm:text-sm text-card-foreground/70 font-ticket uppercase tracking-wide flex items-center gap-1.5">
              <EraMotif era={eraNameFromDate(showDate)} size={13} className="shrink-0" />
              <span className="truncate">{showDate} {venue ? `· ${venue}` : ""}</span>
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
                  className="h-7 px-3 rounded-md bg-transparent text-accent-foreground border border-primary/40 text-[11px] font-mono uppercase tracking-wider hover:bg-primary/10 transition-all shrink-0 inline-flex items-center gap-1"
                  title="View poster"
                >
                  View Poster
                </button>
              </div>
            )}
          </div>

          <span className="text-[11px] text-muted-foreground font-mono tabular-nums shrink-0 max-sm:order-8 max-sm:text-muted-foreground">
            {formatTime(labelTime.currentTime)} / {formatTime(labelTime.duration)}
          </span>

          <a href="https://archive.org" target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-card-foreground font-mono shrink-0 inline max-sm:order-last max-sm:ml-auto transition-colors">
            via archive.org
          </a>

          <Popover>
            <PopoverTrigger asChild>
              <button className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-primary shrink-0 transition-colors rounded-full max-sm:order-9 max-sm:text-muted-foreground" title="Cast to speakers">
                <Cast className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-72 text-xs font-body space-y-2 bg-card border-border">
              <p className="font-display text-sm text-card-foreground">🔊 Cast to Sonos & Speakers</p>
              <div className="space-y-1.5 text-muted-foreground">
                <p><strong className="text-card-foreground">Chrome:</strong> Menu (⋮) → "Cast…" → select your Sonos/Chromecast device</p>
                <p><strong className="text-card-foreground">macOS:</strong> Click the AirPlay icon in the menu bar → select your Sonos speaker</p>
                <p><strong className="text-card-foreground">iPhone/iPad:</strong> Open Control Center → tap AirPlay → select your Sonos</p>
                <p><strong className="text-card-foreground">Windows:</strong> Settings → Bluetooth & devices → pair your speaker</p>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                Sonos One, Beam, Arc, Era & Move support AirPlay 2
              </p>
            </PopoverContent>
          </Popover>

          <button onClick={toggleMute} className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 rounded-full transition-colors max-sm:order-10" title={muted ? "Unmute" : "Mute"}>
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {playlistInfo && (
            <span className="text-sm text-muted-foreground font-mono tabular-nums shrink-0 hidden sm:inline" title="Position in setlist">
              {playlistInfo.current}/{playlistInfo.total}
            </span>
          )}

          <button onClick={stopPlayback} className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0 rounded-full transition-colors max-sm:order-6" title="Close player">
            <X className="w-4 h-4" />
          </button>

          {/* Mobile-only row break: forces utility controls onto a slim second row */}
          <div aria-hidden className="hidden max-sm:block basis-full h-0 max-sm:order-7" />
        </div>
      </motion.div>
      <PosterModal
        open={posterOpen}
        songTitle={songTitle}
        showDate={showDate}
        venue={venue}
        setlistId={activeSetlistId ?? null}
        playlistInfo={playlistInfo}
        onClose={() => setPosterOpen(false)}
        onPrev={playlistInfo ? transport.previous : undefined}
        onNext={playlistInfo ? transport.next : undefined}
      />
    </AnimatePresence>
  );
};

export default GaplessPlayerBar;
