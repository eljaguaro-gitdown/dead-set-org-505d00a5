import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, X, Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";

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
  onClose: () => void;
  onEnded?: () => void;
  playlistInfo?: { current: number; total: number } | null;
  onNext?: () => void;
  onPrev?: () => void;
}

const AudioPlayer = ({ archiveUrl, songTitle, showDate, venue, autoPlay = false, singleTrackMode = false, onClose, onEnded, playlistInfo, onNext, onPrev }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract identifier from archive.org URL
  const getIdentifier = useCallback((url: string) => {
    const match = url.match(/archive\.org\/details\/([^/?#]+)/);
    return match?.[1] || null;
  }, []);

  useEffect(() => {
    const fetchTracks = async () => {
      setLoading(true);
      setError(null);
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
          // Try to find a track matching the song title
          const matchIdx = audioFiles.findIndex((t: Track) =>
            t.title.toLowerCase().includes(songTitle.toLowerCase())
          );
          setCurrentTrack(matchIdx >= 0 ? matchIdx : 0);
        }
      } catch {
        setError("Couldn't load audio from archive.org");
      }
      setLoading(false);
    };

    fetchTracks();
  }, [archiveUrl, songTitle, getIdentifier]);

  useEffect(() => {
    if (tracks.length > 0 && audioRef.current) {
      audioRef.current.load();
      if (playing) audioRef.current.play().catch(() => {});
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
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md"
      >
        <audio
          ref={audioRef}
          src={track?.src}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onLoadedMetadata={handleTimeUpdate}
          muted={muted}
        />

        {/* Progress bar (thin, at top of player) */}
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

        <div className="px-4 py-2.5 flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            disabled={loading || !!error}
            className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : playing ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            {error ? (
              <p className="text-xs text-destructive font-body truncate">{error}</p>
            ) : (
              <>
                <p className="text-xs text-foreground font-body truncate font-medium">
                  {track?.title || songTitle}
                </p>
                <p className="text-[10px] text-muted-foreground font-body truncate">
                  {showDate} {venue ? `— ${venue}` : ""}
                </p>
              </>
            )}
          </div>

          {/* Time */}
          <span className="text-[10px] text-muted-foreground font-body tabular-nums shrink-0">
            {formatTime(progress)} / {formatTime(duration)}
          </span>

          {/* Volume */}
          <button onClick={() => setMuted(!muted)} className="text-muted-foreground hover:text-foreground shrink-0">
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Track selector (compact) */}
          {tracks.length > 1 && (
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

          {/* Playlist nav */}
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

          {/* Close */}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AudioPlayer;
