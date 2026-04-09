import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, X, Loader2, Cast, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { matchScore } from "@/lib/archiveOrg";

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

const AudioPlayer = ({ archiveUrl, songTitle, showDate, venue, autoPlay = false, singleTrackMode = false, directTrackUrl, onClose, onEnded, playlistInfo, onNext, onPrev, activeSetlistId }: AudioPlayerProps) => {
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getIdentifier = useCallback((url: string) => {
    const match = url.match(/archive\.org\/details\/([^/?#]+)/);
    return match?.[1] || null;
  }, []);

  useEffect(() => {
    const fetchTracks = async () => {
      setLoading(true);
      setError(null);

      // If we have a direct track URL, just use it
      if (directTrackUrl) {
        setTracks([{ title: songTitle, src: directTrackUrl }]);
        setCurrentTrack(0);
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
        const res = await fetch(`https://archive.org/metadata/${identifier}`);
        if (!res.ok) throw new Error("Failed to fetch metadata");
        const meta = await res.json();

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
          setError("No audio files found");
        } else {
          setTracks(audioFiles);
          // Use fuzzy matching to find the right track
          let bestIdx = 0;
          let bestScore = 0;
          audioFiles.forEach((t: Track, i: number) => {
            const score = matchScore(t.title, songTitle);
            if (score > bestScore) {
              bestScore = score;
              bestIdx = i;
            }
          });
          setCurrentTrack(bestIdx);
        }
      } catch {
        setError("Couldn't load audio from archive.org");
      }
      setLoading(false);
    };

    fetchTracks();
  }, [archiveUrl, songTitle, getIdentifier, directTrackUrl]);

  useEffect(() => {
    if (tracks.length > 0 && audioRef.current) {
      audioRef.current.load();
      if (playing || autoPlay) {
        setPlaying(true);
        audioRef.current.play().catch(() => {});
      }
    }
  }, [currentTrack, tracks]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setProgress(audioRef.current.currentTime);
    setDuration(audioRef.current.duration || 0);
  };

  const handleSeek = (value: number[]) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = value[0];
    setProgress(value[0]);
  };

  const handleEnded = () => {
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
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg"
      >
        <audio
          ref={audioRef}
          src={track?.src}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onLoadedMetadata={handleTimeUpdate}
          muted={muted}
        />

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
          <button
            onClick={togglePlay}
            disabled={loading || !!error}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-50 transition-all hover:brightness-110"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : playing ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>

          <div
            className={`flex-1 min-w-0 ${activeSetlistId ? 'cursor-pointer' : ''}`}
            onClick={() => activeSetlistId && navigate(`/setlist/${activeSetlistId}`)}
          >
            {error ? (
              <p className="text-sm text-destructive font-body truncate">{error}</p>
            ) : (
              <>
                <p className="text-base sm:text-lg text-foreground font-display truncate font-bold flex items-center gap-1.5">
                  {songTitle}
                  {activeSetlistId && <ChevronRight className="w-4 h-4 text-primary/70 shrink-0" />}
                </p>
                <p className="text-sm sm:text-base text-primary/90 font-body truncate font-medium">
                  {showDate} {venue ? `· ${venue}` : ""}
                </p>
                {activeSetlistId && (
                  <p className="text-[10px] text-muted-foreground font-mono tracking-wider mt-0.5 hidden sm:block">
                    <span className="text-primary/60 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">View Poster ↗</span>
                  </p>
                )}
              </>
            )}
          </div>

          <span className="text-[10px] text-muted-foreground font-mono tabular-nums shrink-0">
            {formatTime(progress)} / {formatTime(duration)}
          </span>

          <a href="https://archive.org" target="_blank" rel="noopener noreferrer" className="text-[9px] text-muted-foreground/50 hover:text-muted-foreground font-body shrink-0 hidden sm:inline transition-colors">
            via archive.org
          </a>

          <Popover>
            <PopoverTrigger asChild>
              <button className="text-muted-foreground hover:text-primary shrink-0 transition-colors" title="Cast to speakers">
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

          <button onClick={() => setMuted(!muted)} className="text-muted-foreground hover:text-foreground shrink-0">
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
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onPrev}
                disabled={playlistInfo.current <= 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                title="Previous song"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
              </button>
              <span className="text-[10px] text-muted-foreground font-body tabular-nums">
                {playlistInfo.current}/{playlistInfo.total}
              </span>
              <button
                onClick={onNext}
                disabled={playlistInfo.current >= playlistInfo.total}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                title="Next song"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
              </button>
            </div>
          )}

          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AudioPlayer;
