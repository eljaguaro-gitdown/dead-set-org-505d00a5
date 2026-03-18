import { motion } from "framer-motion";
import { X, GripVertical, ChevronRight, ExternalLink, Headphones } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
  onRemoveSlot: (id: string) => void;
  onToggleSegue: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onReorder: (setNumber: number, fromIndex: number, toIndex: number) => void;
  onPlayVersion?: (slot: SetlistSlotData) => void;
}

const SetSection = ({
  title,
  setNumber,
  slots,
  onRemoveSlot,
  onToggleSegue,
  onUpdateNotes,
  onPlayVersion,
}: {
  title: string;
  setNumber: number;
  slots: SetlistSlotData[];
  onRemoveSlot: (id: string) => void;
  onToggleSegue: (id: string) => void;
  onUpdateNotes: (id: string, notes: string) => void;
  onPlayVersion?: (slot: SetlistSlotData) => void;
}) => {
  const setSlots = slots.filter((s) => s.setNumber === setNumber);

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
      {setSlots.map((slot, index) => (
        <div key={slot.id}>
          <motion.div
            layout
            className="song-glow rounded-lg bg-card border border-border p-3 group"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-start gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground mt-1 cursor-grab shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-body text-sm text-foreground font-medium">{slot.song.title}</span>
                  <button
                    onClick={() => onRemoveSlot(slot.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4 text-muted-foreground hover:text-primary" />
                  </button>
                </div>
                {slot.version && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-xs text-muted-foreground font-body">
                      {slot.version.show_date} — {slot.version.venue}
                    </span>
                    {slot.version.archive_org_url && (
                      <a
                        href={slot.version.archive_org_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-3 h-3 text-secondary" />
                      </a>
                    )}
                  </div>
                )}
                <Textarea
                  placeholder="Notes..."
                  value={slot.notes}
                  onChange={(e) => onUpdateNotes(slot.id, e.target.value)}
                  className="mt-2 min-h-[28px] h-7 text-xs bg-transparent border-border resize-none font-body text-muted-foreground focus:text-foreground"
                />
              </div>
            </div>
          </motion.div>
          {index < setSlots.length - 1 && (
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
      ))}
    </div>
  );
};

const SetlistDisplay = ({
  slots,
  onRemoveSlot,
  onToggleSegue,
  onUpdateNotes,
}: SetlistDisplayProps) => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="font-display text-lg text-foreground">The Set</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <SetSection
          title="Set I"
          setNumber={1}
          slots={slots}
          onRemoveSlot={onRemoveSlot}
          onToggleSegue={onToggleSegue}
          onUpdateNotes={onUpdateNotes}
        />
        <SetSection
          title="Set II"
          setNumber={2}
          slots={slots}
          onRemoveSlot={onRemoveSlot}
          onToggleSegue={onToggleSegue}
          onUpdateNotes={onUpdateNotes}
        />
        <SetSection
          title="Encore"
          setNumber={3}
          slots={slots}
          onRemoveSlot={onRemoveSlot}
          onToggleSegue={onToggleSegue}
          onUpdateNotes={onUpdateNotes}
        />
      </div>
    </div>
  );
};

export default SetlistDisplay;
