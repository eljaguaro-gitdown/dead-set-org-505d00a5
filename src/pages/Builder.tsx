import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { Sparkles, Share2, Users, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import SongVault from "@/components/SongVault";
import SetlistDisplay, { type SetlistSlotData } from "@/components/SetlistDisplay";
import { useSongs } from "@/hooks/useSongs";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];
type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];

const Builder = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [title, setTitle] = useState("Untitled Setlist");
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [slots, setSlots] = useState<SetlistSlotData[]>([]);
  const [activeSet, setActiveSet] = useState(1);

  const { songs, eras, loading, getNotableVersions } = useSongs(selectedEra);

  const handleSelectSong = useCallback(
    (song: Song, version?: NotableVersion) => {
      const setSlotCount = slots.filter((s) => s.setNumber === activeSet).length;
      const newSlot: SetlistSlotData = {
        id: crypto.randomUUID(),
        song,
        version: version || null,
        setNumber: activeSet,
        position: setSlotCount,
        segueToNext: false,
        notes: "",
      };
      setSlots((prev) => [...prev, newSlot]);
      toast.success(`${song.title} added to Set ${activeSet === 3 ? "Encore" : activeSet}`);
    },
    [slots, activeSet]
  );

  const handleRemoveSlot = useCallback((id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleToggleSegue = useCallback((id: string) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, segueToNext: !s.segueToNext } : s))
    );
  }, []);

  const handleUpdateNotes = useCallback((id: string, notes: string) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, notes } : s)));
  }, []);

  const handleReorder = useCallback(
    (setNumber: number, fromIndex: number, toIndex: number) => {
      setSlots((prev) => {
        const setSlots = prev.filter((s) => s.setNumber === setNumber);
        const otherSlots = prev.filter((s) => s.setNumber !== setNumber);
        const [moved] = setSlots.splice(fromIndex, 1);
        setSlots.splice(toIndex, 0, moved);
        return [...otherSlots, ...setSlots.map((s, i) => ({ ...s, position: i }))];
      });
    },
    []
  );

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="grain-overlay min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate("/")} className="font-display text-lg text-primary shrink-0">
            DS
          </button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent border-none text-foreground font-display text-lg p-0 h-auto focus-visible:ring-0 max-w-[200px]"
          />
          <Select value={selectedEra || ""} onValueChange={(v) => setSelectedEra(v || null)}>
            <SelectTrigger className="w-[160px] bg-card border-border text-foreground font-body text-xs h-8">
              <SelectValue placeholder="All eras" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {eras.map((era) => (
                <SelectItem key={era.id} value={era.id} className="font-body text-xs">
                  {era.name} ({era.year_start}–{era.year_end})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {/* Set selector for adding songs */}
          <div className="flex items-center gap-1 mr-2">
            <span className="text-xs text-muted-foreground font-body">Add to:</span>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setActiveSet(n)}
                className={`px-2 py-1 text-xs font-body rounded transition-colors ${
                  activeSet === n
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {n === 3 ? "E" : `S${n}`}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="border-border text-foreground font-body gap-1.5" disabled>
            <Users className="w-3.5 h-3.5" /> Collab
          </Button>
          <Button variant="outline" size="sm" className="border-border text-foreground font-body gap-1.5" disabled>
            <Sparkles className="w-3.5 h-3.5" /> AI
          </Button>
          <Button variant="outline" size="sm" className="border-border text-foreground font-body gap-1.5" disabled>
            <Share2 className="w-3.5 h-3.5" /> Share
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Song Vault */}
        <div className="w-full lg:w-[380px] border-r border-border overflow-hidden flex flex-col lg:max-h-[calc(100vh-57px)]">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <SongVault
              songs={songs}
              eraId={selectedEra}
              onSelectSong={handleSelectSong}
              getNotableVersions={getNotableVersions}
            />
          )}
        </div>

        {/* Setlist */}
        <div className="flex-1 overflow-hidden flex flex-col lg:max-h-[calc(100vh-57px)]">
          <SetlistDisplay
            slots={slots}
            onRemoveSlot={handleRemoveSlot}
            onToggleSegue={handleToggleSegue}
            onUpdateNotes={handleUpdateNotes}
            onReorder={handleReorder}
          />
        </div>
      </div>
    </div>
  );
};

export default Builder;
