import { useCallback, useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { X, GripVertical, ChevronRight, ChevronDown, ExternalLink, Headphones, Play, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { findArchiveRecording, type ArchiveResult } from "@/lib/archiveOrg";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];
type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];

export interface SetlistSlotData {
  id: string;
  song: Song;
  version?: NotableVersion | null;
  setNumber: number;
  position: number;
  segueToNext: boolean;
  notes: string;
}

interface SetlistDisplayProps {
  slots: SetlistSlotData[];
  activeSlotId?: string | null;
  description?: string | null;
  generatingDescription?: boolean;
  onRemoveSlot: (id: string) => void;
  onToggleSegue: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onReorder: (newSlots: SetlistSlotData[]) => void;
  onPlayVersion?: (slot: SetlistSlotData) => void;
  onPlaySetlist?: () => void;
  onGenerateDescription?: () => void;
}

/* ── Sortable slot item ── */
const SortableSlotItem = ({
  slot,
  isLast,
  isPlaying,
  onRemoveSlot,
  onToggleSegue,
  onUpdateNotes,
  onPlayVersion,
}: {
  slot: SetlistSlotData;
  isLast: boolean;
  isPlaying: boolean;
  onRemoveSlot: (id: string) => void;
  onToggleSegue: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onPlayVersion?: (slot: SetlistSlotData) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot.id });

  // Auto-fetch Archive.org link if slot doesn't have one via version
  const existingArchiveUrl = slot.version?.archive_org_url || null;
  const [archiveResult, setArchiveResult] = useState<ArchiveResult | null>(
    existingArchiveUrl ? { url: existingArchiveUrl, date: slot.version?.show_date || null, venue: slot.version?.venue || null } : null
  );
  const [archiveLoading, setArchiveLoading] = useState(false);

  useEffect(() => {
    if (existingArchiveUrl) {
      setArchiveResult({ url: existingArchiveUrl, date: slot.version?.show_date || null, venue: slot.version?.venue || null });
      return;
    }
    let cancelled = false;
    setArchiveLoading(true);
    findArchiveRecording(slot.song.title).then((result) => {
      if (!cancelled) {
        setArchiveResult(result);
        setArchiveLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [slot.song.title, existingArchiveUrl]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`rounded-lg bg-card border p-3 group transition-all duration-300 ${isPlaying ? 'border-primary ring-2 ring-primary/30 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.4)]' : 'border-border song-glow'}`}>
        <div className="flex items-start gap-2">
          <button
            {...attributes}
            {...listeners}
            className="mt-1 cursor-grab active:cursor-grabbing touch-none shrink-0"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-body text-base lg:text-xl text-foreground font-medium">{slot.song.title}</span>
              <button
                onClick={() => onRemoveSlot(slot.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4 text-muted-foreground hover:text-primary" />
              </button>
            </div>
            {slot.version && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-sm lg:text-base text-muted-foreground font-body">
                  {slot.version.show_date} — {slot.version.venue}
                </span>
              </div>
            )}
            {/* Archive.org link — shown for all slots */}
            {archiveResult && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <button
                  onClick={() => {
                    const playSlot = {
                      ...slot,
                      version: slot.version || {
                        id: "",
                        song_id: slot.song.id,
                        show_date: archiveResult.date || "",
                        archive_org_url: archiveResult.url,
                        venue: archiveResult.venue,
                        city: null,
                        era_id: null,
                        rating: null,
                        description: null,
                      },
                    };
                    if (!playSlot.version!.archive_org_url) {
                      playSlot.version = { ...playSlot.version!, archive_org_url: archiveResult.url };
                    }
                    onPlayVersion?.(playSlot);
                  }}
                  title="Preview on Archive.org"
                >
                  <Headphones className="w-3 h-3 text-accent hover:text-primary transition-colors" />
                </button>
                <a
                  href={archiveResult.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-secondary hover:text-primary transition-colors font-body"
                  title="Open on Archive.org"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span className="hidden sm:inline">Archive.org</span>
                </a>
                {(archiveResult.date || archiveResult.venue) && (
                  <span className="text-xs lg:text-sm text-muted-foreground font-body">
                    {[archiveResult.date, archiveResult.venue].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
            )}
            {archiveLoading && !archiveResult && (
              <span className="text-[10px] text-muted-foreground/50 font-body mt-1 block">
                Finding on Archive.org…
              </span>
            )}
            <Textarea
              placeholder="Notes..."
              value={slot.notes}
              onChange={(e) => onUpdateNotes(slot.id, e.target.value)}
              className="mt-2 min-h-[28px] h-7 text-xs bg-transparent border-border resize-none font-body text-muted-foreground focus:text-foreground"
            />
          </div>
        </div>
      </div>
      {!isLast && (
        <button
          onClick={() => onToggleSegue(slot.id)}
          className="flex items-center justify-center w-full py-1"
        >
          {slot.segueToNext ? (
            <ChevronRight className="w-4 h-4 text-primary" />
          ) : (
            <div className="w-4 h-px bg-border" />
          )}
        </button>
      )}
    </div>
  );
};

/* ── Set section (droppable) ── */
const SetSection = ({
  title,
  setNumber,
  slots,
  activeSlotId,
  onRemoveSlot,
  onToggleSegue,
  onUpdateNotes,
  onPlayVersion,
}: {
  title: string;
  setNumber: number;
  slots: SetlistSlotData[];
  activeSlotId?: string | null;
  onRemoveSlot: (id: string) => void;
  onToggleSegue: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onPlayVersion?: (slot: SetlistSlotData) => void;
}) => {
  const setSlots = slots.filter((s) => s.setNumber === setNumber);
  const ids = setSlots.map((s) => s.id);

  return (
    <div className="space-y-1">
      <h3 className="font-display text-sm text-muted-foreground uppercase tracking-wider px-2 py-2">
        {title}
      </h3>
      {setSlots.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground font-body">
            {setNumber === 1
              ? "Every great show starts with the first note."
              : "Drop songs here"}
          </p>
        </div>
      )}
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {setSlots.map((slot, index) => (
          <SortableSlotItem
            key={slot.id}
            slot={slot}
            isLast={index === setSlots.length - 1}
            isPlaying={activeSlotId === slot.id}
            onRemoveSlot={onRemoveSlot}
            onToggleSegue={onToggleSegue}
            onUpdateNotes={onUpdateNotes}
            onPlayVersion={onPlayVersion}
          />
        ))}
      </SortableContext>
    </div>
  );
};

/* ── Collapsible description ── */
const DescriptionCollapsible = ({ description, defaultOpen = true }: { description: string; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-body text-primary/80 hover:text-primary transition-colors py-1"
      >
        <Sparkles className="w-3 h-3" />
        <span>Charlie's Liner Notes</span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <p className="text-sm font-body text-muted-foreground italic leading-relaxed px-1 py-2 border-l-2 border-primary/40 pl-3">
          {description}
        </p>
      </motion.div>
    </div>
  );
};

/* ── Main component ── */
const SetlistDisplay = ({
  slots,
  activeSlotId,
  description,
  generatingDescription,
  onRemoveSlot,
  onToggleSegue,
  onUpdateNotes,
  onReorder,
  onPlayVersion,
  onPlaySetlist,
  onGenerateDescription,
}: SetlistDisplayProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeSlot = slots.find((s) => s.id === active.id);
      const overSlot = slots.find((s) => s.id === over.id);
      if (!activeSlot || !overSlot) return;

      // If moving between sets, change the set number
      const targetSetNumber = overSlot.setNumber;

      // Get slots for the source and target sets
      if (activeSlot.setNumber === targetSetNumber) {
        // Same set: simple reorder
        const setSlots = slots.filter((s) => s.setNumber === targetSetNumber);
        const oldIndex = setSlots.findIndex((s) => s.id === active.id);
        const newIndex = setSlots.findIndex((s) => s.id === over.id);
        const reordered = arrayMove(setSlots, oldIndex, newIndex);

        const newSlots = slots.map((s) => {
          if (s.setNumber !== targetSetNumber) return s;
          const idx = reordered.findIndex((r) => r.id === s.id);
          return { ...s, position: idx };
        });
        onReorder(newSlots);
      } else {
        // Cross-set move
        const newSlots = slots.map((s) => {
          if (s.id === active.id) {
            return { ...s, setNumber: targetSetNumber };
          }
          return s;
        });

        // Recalculate positions for affected sets
        const recalculated = newSlots.map((s) => {
          const setSlots = newSlots
            .filter((ss) => ss.setNumber === s.setNumber)
            .sort((a, b) => a.position - b.position);
          const idx = setSlots.findIndex((ss) => ss.id === s.id);
          return { ...s, position: idx };
        });

        onReorder(recalculated);
      }
    },
    [slots, onReorder]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-foreground">The Set</h2>
          <div className="flex items-center gap-2">
            {slots.length > 0 && onGenerateDescription && (
              <Button
                onClick={onGenerateDescription}
                variant="outline"
                size="sm"
                disabled={generatingDescription}
                className="gap-1.5 border-primary/30 text-primary font-body text-xs h-8 px-3 hover:bg-primary/10 transition-all"
              >
                {generatingDescription ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : description ? (
                  <RefreshCw className="w-3.5 h-3.5" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {generatingDescription ? "Charlie's writing..." : description ? "Rewrite" : "Ask Charlie for Liner Notes"}
              </Button>
            )}
            {slots.length > 0 && onPlaySetlist && (
              <Button
                onClick={onPlaySetlist}
                size="sm"
                className="gap-1.5 bg-primary text-primary-foreground font-display text-xs h-8 px-3 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Play Setlist
              </Button>
            )}
          </div>
        </div>
        {description && (
          <DescriptionCollapsible description={description} />
        )}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <SetSection
            title="Set I"
            setNumber={1}
            slots={slots}
            activeSlotId={activeSlotId}
            onRemoveSlot={onRemoveSlot}
            onToggleSegue={onToggleSegue}
            onUpdateNotes={onUpdateNotes}
            onPlayVersion={onPlayVersion}
          />
          <SetSection
            title="Set II"
            setNumber={2}
            slots={slots}
            activeSlotId={activeSlotId}
            onRemoveSlot={onRemoveSlot}
            onToggleSegue={onToggleSegue}
            onUpdateNotes={onUpdateNotes}
            onPlayVersion={onPlayVersion}
          />
          <SetSection
            title="Encore"
            setNumber={3}
            slots={slots}
            activeSlotId={activeSlotId}
            onRemoveSlot={onRemoveSlot}
            onToggleSegue={onToggleSegue}
            onUpdateNotes={onUpdateNotes}
            onPlayVersion={onPlayVersion}
          />
        </div>
      </DndContext>
    </div>
  );
};

export default SetlistDisplay;
