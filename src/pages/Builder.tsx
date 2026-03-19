import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { findArchiveRecording } from "@/lib/archiveOrg";
import { Sparkles, Share2, Users, LogOut, MessageCircle, Globe, CheckCircle, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageLayout from "@/components/PageLayout";
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
  const [playlistMode, setPlaylistMode] = useState(false);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const [description, setDescription] = useState<string | null>(null);
  const [generatingDescription, setGeneratingDescription] = useState(false);

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
    setSlots,
  } = useSetlist(user, paramId);

  // Initialize setlist (create new or load existing)
  const creatingRef = useRef(false);
  useEffect(() => {
    if (!user || initialized || authLoading) return;
    if (!paramId && !setlist) {
      if (creatingRef.current) return;
      creatingRef.current = true;
      createSetlist(title, selectedEra).then((created) => {
        if (created) {
          navigate(`/builder/${created.id}`, { replace: true });
        }
        setInitialized(true);
        creatingRef.current = false;
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
    if ((setlist as any)?.description) {
      setDescription((setlist as any).description);
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
    (newSlots: SetlistSlotData[]) => {
      setSlots(newSlots);
      // Persist position/set changes to DB
      if (setlist) {
        const changed = newSlots.filter((ns) => {
          const old = slots.find((s) => s.id === ns.id);
          return old && (old.position !== ns.position || old.setNumber !== ns.setNumber);
        });
        changed.forEach((slot) => {
          updateSlot(slot.id, { position: slot.position, setNumber: slot.setNumber });
        });
      }
    },
    [setlist, slots, updateSlot, setSlots]
  );

  const handleApplyAISuggestion = useCallback(
    async (suggestion: { explanation: string; sets: { setNumber: number; songs: { songId: string; title: string; segueToNext: boolean; notes: string; position: number }[] }[] }) => {
      // Clear existing slots
      for (const slot of slots) {
        await removeSlot(slot.id);
      }
      // Add AI-suggested songs
      await addAISongsToCurrentSetlist(suggestion);
    },
    [slots, songs, removeSlot, addSlot]
  );

  const handleCreateNewFromAI = useCallback(
    async (suggestion: { explanation: string; sets: { setNumber: number; songs: { songId: string; title: string; segueToNext: boolean; notes: string; position: number }[] }[] }, customTitle?: string) => {
      const firstSongs = suggestion.sets.flatMap(s => s.songs).slice(0, 2).map(s => s.title);
      const newTitle = customTitle || (firstSongs.length > 0 ? `AI Set: ${firstSongs.join(" > ")}` : "AI Generated Setlist");
      const created = await createSetlist(newTitle, selectedEra);
      if (!created) return;
      navigate(`/builder/${created.id}`, { replace: false });
      setTimeout(async () => {
        await addAISongsToSetlist(suggestion, created.id);
      }, 300);
    },
    [songs, createSetlist, selectedEra, navigate]
  );

  const addAISongsToCurrentSetlist = useCallback(
    async (suggestion: { sets: { setNumber: number; songs: { songId: string; title: string; segueToNext: boolean; notes: string; position: number }[] }[] }) => {
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
    [songs, addSlot]
  );

  const addAISongsToSetlist = useCallback(
    async (suggestion: { sets: { setNumber: number; songs: { songId: string; title: string; segueToNext: boolean; notes: string; position: number }[] }[] }, targetSetlistId: string) => {
      for (const set of suggestion.sets) {
        for (const suggestedSong of set.songs) {
          const song = songs.find((s) => s.id === suggestedSong.songId);
          if (!song || !user) continue;
          await supabase.from("setlist_slots").insert({
            id: crypto.randomUUID(),
            setlist_id: targetSetlistId,
            set_number: set.setNumber,
            position: suggestedSong.position,
            song_id: song.id,
            added_by_user_id: user.id,
            notes: suggestedSong.notes || "",
            segue_to_next: suggestedSong.segueToNext,
          });
        }
      }
    },
    [songs, user]
  );

  const handleGenerateDescription = useCallback(async () => {
    if (!setlist) return;
    setGeneratingDescription(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-setlist-description", {
        body: { setlistId: setlist.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDescription(data.description);
      toast.success("Liner notes generated!");
    } catch (e: any) {
      console.error("Description generation error:", e);
      toast.error(e.message || "Failed to generate description");
    } finally {
      setGeneratingDescription(false);
    }
  }, [setlist]);
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
    <PageLayout minimal>
      {/* Top Bar */}
      <header className="border-b border-border">
        {/* Row 1: Logo, title, saved indicator */}
        <div className="px-3 py-2 flex items-center gap-2">
          <button onClick={() => navigate("/")} className="font-display text-lg text-primary shrink-0">
            DS
          </button>
          <button
            onClick={() => navigate("/my-setlists")}
            className="text-xs font-body text-muted-foreground hover:text-foreground transition-colors shrink-0 hidden sm:flex items-center gap-1"
            title="My Setlists"
          >
            <List className="w-3.5 h-3.5" /> My Setlists
          </button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="bg-transparent border-none text-foreground font-display text-base sm:text-lg p-0 h-auto focus-visible:ring-0 min-w-0 flex-1"
          />
          {setlist && (
            <span className="flex items-center gap-1 text-xs text-accent font-body shrink-0" title="All changes are saved automatically">
              <CheckCircle className="w-3 h-3" /> <span className="hidden sm:inline">Saved</span>
            </span>
          )}
          <CollaboratorAvatars collaborators={collaborators} />
        </div>

        {/* Row 2: Toolbar — horizontally scrollable on mobile */}
        <div className="px-3 py-1.5 border-t border-border/50 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {/* Set selector */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground font-body hidden sm:inline">Add to:</span>
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

          <div className="w-px h-5 bg-border shrink-0" />

          {/* Era filter — compact on mobile */}
          <Select value={selectedEra || ""} onValueChange={(v) => setSelectedEra(v || null)}>
            <SelectTrigger className="w-auto min-w-[90px] max-w-[140px] bg-card border-border text-foreground font-body text-xs h-7 shrink-0">
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

          <div className="w-px h-5 bg-border shrink-0" />

          {/* Action buttons — icon-only on mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-foreground"
            onClick={() => setChatOpen(true)}
            title="Chat"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="default"
            size="sm"
            className="shrink-0 h-7 px-2.5 gap-1.5 bg-gradient-to-r from-primary to-accent text-primary-foreground font-display text-xs shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 animate-pulse hover:animate-none"
            onClick={() => setAiOpen(true)}
            title="AI Dead Head — Generate a setlist"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Dead Head</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 shrink-0 ${setlist?.is_public ? "text-accent" : "text-foreground"}`}
            onClick={togglePublic}
            title={setlist?.is_public ? "Public — visible on Browse" : "Private — only you and collaborators"}
          >
            <Globe className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-foreground"
            onClick={() => setShareOpen(true)}
            title="Share"
          >
            <Share2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/my-setlists")}
            title="My Setlists"
          >
            <List className="w-3.5 h-3.5 sm:hidden" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={signOut}
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Song Vault */}
        <div className="w-full lg:w-[380px] border-b lg:border-b-0 border-r-0 lg:border-r border-border overflow-hidden flex flex-col max-h-[45vh] lg:max-h-[calc(100vh-85px)]">
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
        <div className="flex-1 overflow-hidden flex flex-col min-h-[40vh] lg:max-h-[calc(100vh-85px)]">
           <SetlistDisplay
            slots={slots}
            activeSlotId={playlistMode && playingSlot ? playingSlot.id : null}
            description={description}
            generatingDescription={generatingDescription}
            onGenerateDescription={handleGenerateDescription}
            onRemoveSlot={handleRemoveSlot}
            onToggleSegue={handleToggleSegue}
            onUpdateNotes={handleUpdateNotes}
            onReorder={handleReorder}
            onPlayVersion={(slot) => {
              setPlaylistMode(false);
              setPlayingSlot(slot);
            }}
            onPlaySetlist={async () => {
              if (slots.length === 0) return;
              const sorted = [...slots].sort((a, b) => a.setNumber - b.setNumber || a.position - b.position);
              // Resolve archive URL for first slot if missing
              let firstSlot = sorted[0];
              if (!firstSlot.version?.archive_org_url) {
                const result = await findArchiveRecording(firstSlot.song.title);
                if (result) {
                  firstSlot = {
                    ...firstSlot,
                    version: {
                      id: "", song_id: firstSlot.song.id, show_date: result.date || "",
                      archive_org_url: result.url, venue: result.venue,
                      city: null, era_id: null, rating: null, description: null,
                    },
                  };
                } else {
                  toast.error("Couldn't find audio for the first song");
                  return;
                }
              }
              setPlaylistMode(true);
              setPlaylistIndex(0);
              setPlayingSlot(firstSlot);
            }}
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
        onCreateNewSetlist={handleCreateNewFromAI}
      />

      {/* Audio Player */}
      {playingSlot?.version?.archive_org_url && (() => {
        const sortedSlots = [...slots].sort((a, b) => a.setNumber - b.setNumber || a.position - b.position);
        const advancePlaylist = async (dir: number) => {
          const newIdx = playlistIndex + dir;
          if (newIdx >= 0 && newIdx < sortedSlots.length) {
            let nextSlot = sortedSlots[newIdx];
            if (!nextSlot.version?.archive_org_url) {
              const result = await findArchiveRecording(nextSlot.song.title);
              if (result) {
                nextSlot = {
                  ...nextSlot,
                  version: {
                    id: "", song_id: nextSlot.song.id, show_date: result.date || "",
                    archive_org_url: result.url, venue: result.venue,
                    city: null, era_id: null, rating: null, description: null,
                  },
                };
              }
            }
            setPlaylistIndex(newIdx);
            setPlayingSlot(nextSlot);
          }
        };
        return (
          <AudioPlayer
            archiveUrl={playingSlot.version.archive_org_url}
            songTitle={playingSlot.song.title}
            showDate={playingSlot.version.show_date}
            venue={playingSlot.version.venue}
            onClose={() => {
              setPlayingSlot(null);
              setPlaylistMode(false);
            }}
            onEnded={playlistMode ? () => advancePlaylist(1) : undefined}
            playlistInfo={playlistMode ? { current: playlistIndex + 1, total: sortedSlots.length } : null}
            onNext={playlistMode ? () => advancePlaylist(1) : undefined}
            onPrev={playlistMode ? () => advancePlaylist(-1) : undefined}
          />
        );
      })()}
    </PageLayout>
  );
};

export default Builder;
