import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ShowPlate from "@/components/ShowPlate";

interface PosterModalProps {
  open: boolean;
  songTitle: string;
  showDate: string;
  venue?: string | null;
  setlistId?: string | null;
  playlistInfo?: { current: number; total: number } | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

const PosterModal = ({
  open,
  songTitle,
  showDate,
  venue,
  setlistId,
  playlistInfo,
  onClose,
  onPrev,
  onNext,
}: PosterModalProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && onPrev) onPrev();
      else if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onPrev, onNext]);

  // Parse "Venue · City, ST" loosely → name and state code
  const venueName = (venue || "").split("·")[0]?.trim() || venue || "";
  const venueStateMatch = (venue || "").match(/,\s*([A-Z]{2})\b/);
  const venueState = venueStateMatch?.[1] || "";

  const canPrev = !!onPrev && !!playlistInfo && playlistInfo.current > 1;
  const canNext = !!onNext && !!playlistInfo && playlistInfo.current < playlistInfo.total;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[80] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center px-4 py-6"
          onClick={onClose}
        >
          <button
            onClick={onClose}
            aria-label="Close poster"
            className="absolute top-4 right-4 w-11 h-11 rounded-lg border border-border bg-card/80 text-card-foreground hover:bg-card flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {canPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
              aria-label="Previous song"
              className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-lg border border-border bg-card/80 text-card-foreground hover:bg-card flex items-center justify-center transition-colors z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {canNext && (
            <button
              onClick={(e) => { e.stopPropagation(); onNext?.(); }}
              aria-label="Next song"
              className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-lg border border-border bg-card/80 text-card-foreground hover:bg-card flex items-center justify-center transition-colors z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          <motion.div
            key={`${songTitle}-${showDate}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80 && canNext) onNext?.();
              else if (info.offset.x > 80 && canPrev) onPrev?.();
            }}
            className="w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono uppercase tracking-[0.2em] text-dead-gold text-center mb-3 text-sm">
              {songTitle}
            </p>
            <ShowPlate
              showDate={showDate}
              venueName={venueName}
              venueState={venueState}
              setlistName={songTitle}
              size="full"
            />
            <p className="font-body text-foreground/75 text-center mt-4">
              {showDate}{venue ? ` · ${venue}` : ""}
            </p>

            <div className="flex items-center justify-center gap-3 mt-6">
              {setlistId && (
                <button
                  onClick={() => { onClose(); navigate(`/setlist/${setlistId}`); }}
                  className="h-10 px-4 rounded-[10px] bg-primary text-primary-foreground font-mono uppercase tracking-wider text-sm hover:brightness-110 transition-all flex items-center gap-2"
                >
                  Go to Setlist <ExternalLink className="w-4 h-4" />
                </button>
              )}
              {playlistInfo && (
                <span className="font-mono text-foreground/75 tabular-nums text-sm">
                  {playlistInfo.current} / {playlistInfo.total}
                </span>
              )}
            </div>
            <p className="font-mono text-foreground/60 text-center mt-4 text-sm">
              <span className="sm:hidden">Swipe to browse</span>
              <span className="hidden sm:inline">Swipe or use ← → to browse</span>
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PosterModal;
