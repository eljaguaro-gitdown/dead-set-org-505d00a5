import { useState, useCallback, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Sparkles, Share2, Users, LogOut, MessageCircle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import SongVault from "@/components/SongVault";
import SetlistDisplay, { type SetlistSlotData } from "@/components/SetlistDisplay";
import CollaboratorAvatars from "@/components/CollaboratorAvatars";
import ChatSidebar from "@/components/ChatSidebar";
import ShareDialog from "@/components/ShareDialog";
import AIDeadHeadDialog from "@/components/AIDeadHeadDialog";
import AudioPlayer from "@/components/AudioPlayer";
import { useSongs } from "@/hooks/useSongs";
import { useAuth } from "@/hooks/useAuth";
import { useSetlist } from "@/hooks/useSetlist";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];
type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];

const Builder = () => {
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const { user, loading: authLoading, signOut } = useAuth();
  const [title, setTitle] = useState("Untitled Setlist");
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [activeSet, setActiveSet] = useState(1);
  const [chatOpen, setChatOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [playingSlot, setPlayingSlot] = useState<import("@/components/SetlistDisplay").SetlistSlotData | null>(null);

  const { songs, eras, loading: songsLoading, getNotableVersions } = useSongs(selectedEra);
  const {
    setlist,
    slots,
    collaborators,
    createSetlist,
    addSlot,
    removeSlot,
    updateSlot,
    updateTitle,
    togglePublic,
    getShareLink,
  } = useSetlist(user, paramId);

  // Initialize setlist (create new or load existing)
  useEffect(() => {
    if (!user || initialized || authLoading) return;
    if (!paramId && !setlist) {
      // Create new setlist
      createSetlist(title, selectedEra).then((created) => {
        if (created) {
          navigate(`/builder/${created.id}`, { replace: true });
        }
        setInitialized(true);
      });
    } else {
      setInitialized(true);
    }
  }, [user, paramId, initialized, authLoading, setlist]);

  // Sync title from loaded setlist
  useEffect(() => {
    if (setlist?.title) {
      setTitle(setlist.title);
    }
    if (setlist?.era_id) {
      setSelectedEra(setlist.era_id);
    }
  }, [setlist]);

  const handleTitleBlur = useCallback(() => {
    if (title !== setlist?.title) {
      updateTitle(title);
    }
  }, [title, setlist, updateTitle]);

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
      addSlot(newSlot);
      toast.success(`${song.title} added to Set ${activeSet === 3 ? "Encore" : activeSet}`);
    },
    [slots, activeSet, addSlot]
  );

  const handleRemoveSlot = useCallback((id: string) => {
    removeSlot(id);
  }, [removeSlot]);

  const handleToggleSegue = useCallback((id: string) => {
    const slot = slots.find((s) => s.id === id);
    if (slot) {
      updateSlot(id, { segueToNext: !slot.segueToNext });
    }
  }, [slots, updateSlot]);

  const handleUpdateNotes = useCallback((id: string, notes: string) => {
    updateSlot(id, { notes });
  }, [updateSlot]);

  const handleReorder = useCallback(
    (setNumber: number, fromIndex: number, toIndex: number) => {
      // Local reorder (DB sync handled by updateSlot)
    },
    []
  );

  const handleApplyAISuggestion = useCallback(
    async (suggestion: { explanation: string; sets: { setNumber: number; songs: { songId: string; title: string; segueToNext: boolean; notes: string; position: number }[] }[] }) => {
      // Clear existing slots
      for (const slot of slots) {
        await removeSlot(slot.id);
      }
      // Find songs from the songs array by matching IDs
      for (const set of suggestion.sets) {
        for (const suggestedSong of set.songs) {
          const song = songs.find((s) => s.id === suggestedSong.songId);
          if (!song) continue;
          const newSlot: SetlistSlotData = {
            id: crypto.randomUUID(),
            song,
            version: null,
            setNumber: set.setNumber,
            position: suggestedSong.position,
            segueToNext: suggestedSong.segueToNext,
            notes: suggestedSong.notes || "",
          };
          await addSlot(newSlot);
        }
      }
    },
    [slots, songs, removeSlot, addSlot]
  );

  if (authLoading) {
    return (
      <div className="grain-overlay min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-48 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

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
            onBlur={handleTitleBlur}
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
          <CollaboratorAvatars collaborators={collaborators} />
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
          <Button
            variant="outline"
            size="sm"
            className="border-border text-foreground font-body gap-1.5"
            onClick={() => setChatOpen(true)}
          >
            <MessageCircle className="w-3.5 h-3.5" /> Chat
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-border text-foreground font-body gap-1.5"
            onClick={() => setAiOpen(true)}
          >
            <Sparkles className="w-3.5 h-3.5" /> AI
          </Button>
          <Button
            variant="outline"
            size="sm"
            className={`border-border font-body gap-1.5 ${setlist?.is_public ? "text-accent border-accent/40" : "text-foreground"}`}
            onClick={togglePublic}
            title={setlist?.is_public ? "Public — visible on Browse" : "Private — only you and collaborators"}
          >
            <Globe className="w-3.5 h-3.5" /> {setlist?.is_public ? "Public" : "Private"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-border text-foreground font-body gap-1.5"
            onClick={() => setShareOpen(true)}
          >
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
          {songsLoading ? (
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
              onPlayArchive={(url, songTitle, showDate, venue) => {
                setPlayingSlot({
                  id: "preview",
                  song: { title: songTitle } as any,
                  version: { archive_org_url: url, show_date: showDate, venue } as any,
                  setNumber: 1,
                  position: 0,
                  segueToNext: false,
                  notes: "",
                });
              }}
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
            onPlayVersion={(slot) => setPlayingSlot(slot)}
          />
        </div>
      </div>

      {/* Chat Sidebar */}
      <ChatSidebar
        setlistId={setlist?.id || null}
        user={user}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      {/* Share Dialog */}
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        shareLink={getShareLink()}
      />

      {/* AI Dead Head Dialog */}
      <AIDeadHeadDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        eraId={selectedEra}
        currentSlots={slots.map((s) => ({
          songTitle: s.song.title,
          setNumber: s.setNumber,
          segue: s.segueToNext,
        }))}
        onApplySuggestion={handleApplyAISuggestion}
      />

      {/* Audio Player */}
      {playingSlot?.version?.archive_org_url && (
        <AudioPlayer
          archiveUrl={playingSlot.version.archive_org_url}
          songTitle={playingSlot.song.title}
          showDate={playingSlot.version.show_date}
          venue={playingSlot.version.venue}
          onClose={() => setPlayingSlot(null)}
        />
      )}
    </div>
  );
};

export default Builder;
