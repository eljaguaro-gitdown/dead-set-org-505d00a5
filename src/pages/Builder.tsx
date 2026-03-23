import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Share2, Users, LogOut, MessageCircle, Globe, CheckCircle, List, Music, LayoutList, Save } from "lucide-react";
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
import AIWelcomeOverlay from "@/components/AIWelcomeOverlay";
import AuthModal from "@/components/AuthModal";
import MiniSetlistBar from "@/components/MiniSetlistBar";
import SaveCelebration from "@/components/SaveCelebration";
import { useSongs } from "@/hooks/useSongs";
import { useAuth } from "@/hooks/useAuth";
import { useSetlist } from "@/hooks/useSetlist";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];
type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];

const Builder = () => {
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const { user, loading: authLoading, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [title, setTitle] = useState("Untitled Setlist");
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [activeSet, setActiveSet] = useState(1);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const { playSingle, playSetlist: globalPlaySetlist, playingSlot } = useAudioPlayer();
  const [description, setDescription] = useState<string | null>(null);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [mobileTab, setMobileTab] = useState<"songs" | "setlist">("songs");
  const [miniBarPulse, setMiniBarPulse] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [savedSetlistId, setSavedSetlistId] = useState<string | null>(null);

  // Auth modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const pendingActionRef = useRef<"save" | "share" | "collaborate" | null>(null);

  // AI welcome overlay: show for fresh builder (no paramId, no slots loaded)
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const showWelcome = !paramId && !welcomeDismissed;

  // Guest mode: track local-only slots when no user/setlist
  const isGuestMode = !user && !paramId;

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

  // Guest-only local slots (used when no user and no paramId)
  const [guestSlots, setGuestSlots] = useState<SetlistSlotData[]>([]);
  const activeSlots = isGuestMode ? guestSlots : slots;

  // Initialize setlist for authenticated users (create new or load existing)
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
    if (!isGuestMode && title !== setlist?.title) {
      updateTitle(title);
    }
  }, [title, setlist, updateTitle, isGuestMode]);

  const handleSelectSong = useCallback(
    (song: Song, version?: NotableVersion) => {
      const currentSlots = isGuestMode ? guestSlots : slots;
      const setSlotCount = currentSlots.filter((s) => s.setNumber === activeSet).length;
      const newSlot: SetlistSlotData = {
        id: crypto.randomUUID(),
        song,
        version: version || null,
        setNumber: activeSet,
        position: setSlotCount,
        segueToNext: false,
        notes: "",
      };
      if (isGuestMode) {
        setGuestSlots((prev) => [...prev, newSlot]);
      } else {
        addSlot(newSlot);
      }
      toast.success(`Added ${song.title} to ${activeSet === 3 ? "Encore" : `Set ${activeSet}`}`, { duration: 2000 });
      if (isMobile && mobileTab === "songs") {
        setMiniBarPulse(true);
        setTimeout(() => setMiniBarPulse(false), 400);
      }
    },
    [slots, guestSlots, activeSet, addSlot, isMobile, isGuestMode]
  );

  const handleRemoveSlot = useCallback((id: string) => {
    if (isGuestMode) {
      setGuestSlots((prev) => prev.filter((s) => s.id !== id));
    } else {
      removeSlot(id);
    }
  }, [removeSlot, isGuestMode]);

  const handleToggleSegue = useCallback((id: string) => {
    const currentSlots = isGuestMode ? guestSlots : slots;
    const slot = currentSlots.find((s) => s.id === id);
    if (slot) {
      if (isGuestMode) {
        setGuestSlots((prev) =>
          prev.map((s) => (s.id === id ? { ...s, segueToNext: !s.segueToNext } : s))
        );
      } else {
        updateSlot(id, { segueToNext: !slot.segueToNext });
      }
    }
  }, [slots, guestSlots, updateSlot, isGuestMode]);

  const handleUpdateNotes = useCallback((id: string, notes: string) => {
    if (isGuestMode) {
      setGuestSlots((prev) =>
        prev.map((s) => (s.id === id ? { ...s, notes } : s))
      );
    } else {
      updateSlot(id, { notes });
    }
  }, [updateSlot, isGuestMode]);

  const handleReorder = useCallback(
    (newSlots: SetlistSlotData[]) => {
      if (isGuestMode) {
        setGuestSlots(newSlots);
      } else {
        setSlots(newSlots);
        if (setlist) {
          const changed = newSlots.filter((ns) => {
            const old = slots.find((s) => s.id === ns.id);
            return old && (old.position !== ns.position || old.setNumber !== ns.setNumber);
          });
          changed.forEach((slot) => {
            updateSlot(slot.id, { position: slot.position, setNumber: slot.setNumber });
          });
        }
      }
    },
    [isGuestMode, setlist, slots, updateSlot, setSlots]
  );

  // Gate actions behind auth for guests
  const requireAuth = useCallback((action: "save" | "share" | "collaborate") => {
    if (!user) {
      pendingActionRef.current = action;
      setAuthModalOpen(true);
      return true; // blocked
    }
    return false; // allowed
  }, [user]);

  // After auth completes, save guest setlist to Supabase
  const handleAuthenticated = useCallback(async () => {
    // The user state will update via onAuthStateChange in useAuth.
    // We need to wait for the user to be set, then persist guest data.
    // We'll handle this via the effect below.
  }, []);

  // When user becomes available and we have guest slots, persist them
  const guestSlotsRef = useRef<SetlistSlotData[]>([]);
  guestSlotsRef.current = guestSlots;
  const guestTitleRef = useRef(title);
  guestTitleRef.current = title;
  const guestEraRef = useRef(selectedEra);
  guestEraRef.current = selectedEra;

  const hasSavedGuestRef = useRef(false);
  useEffect(() => {
    if (!user || hasSavedGuestRef.current) return;
    if (guestSlotsRef.current.length === 0) return;
    // We have a newly authenticated user with guest slots — save them
    hasSavedGuestRef.current = true;
    const saveGuestSetlist = async () => {
      const shareToken = crypto.randomUUID().slice(0, 8);
      const { data: newSetlist, error } = await supabase
        .from("setlists")
        .insert({
          creator_id: user.id,
          title: guestTitleRef.current,
          era_id: guestEraRef.current || null,
          share_token: shareToken,
          is_public: false,
          is_collaborative: false,
        })
        .select()
        .single();

      if (error || !newSetlist) {
        toast.error("Failed to save your setlist");
        hasSavedGuestRef.current = false;
        return;
      }

      // Persist all guest slots
      const slotsToInsert = guestSlotsRef.current.map((slot) => ({
        id: slot.id,
        setlist_id: newSetlist.id,
        set_number: slot.setNumber,
        position: slot.position,
        song_id: slot.song.id,
        notable_version_id: slot.version?.id || null,
        added_by_user_id: user.id,
        notes: slot.notes,
        segue_to_next: slot.segueToNext,
      }));

      if (slotsToInsert.length > 0) {
        await supabase.from("setlist_slots").insert(slotsToInsert);
      }

      // Clear guest state
      setGuestSlots([]);
      setSavedSetlistId(newSetlist.id);
      setShowCelebration(true);
      navigate(`/builder/${newSetlist.id}`, { replace: true });

      pendingActionRef.current = null;
    };
    saveGuestSetlist();
  }, [user, navigate]);

  const handleApplyAISuggestion = useCallback(
    async (suggestion: { explanation: string; sets: { setNumber: number; songs: { songId: string; title: string; segueToNext: boolean; notes: string; position: number }[] }[] }) => {
      if (isGuestMode) {
        // Clear guest slots and add AI songs locally
        const newSlots: SetlistSlotData[] = [];
        for (const set of suggestion.sets) {
          for (const suggestedSong of set.songs) {
            const song = songs.find((s) => s.id === suggestedSong.songId);
            if (!song) continue;
            newSlots.push({
              id: crypto.randomUUID(),
              song,
              version: null,
              setNumber: set.setNumber,
              position: suggestedSong.position,
              segueToNext: suggestedSong.segueToNext,
              notes: suggestedSong.notes || "",
            });
          }
        }
        setGuestSlots(newSlots);
      } else {
        for (const slot of slots) {
          await removeSlot(slot.id);
        }
        await addAISongsToCurrentSetlist(suggestion);
      }
    },
    [isGuestMode, slots, songs, removeSlot]
  );

  const handleCreateNewFromAI = useCallback(
    async (suggestion: { explanation: string; sets: { setNumber: number; songs: { songId: string; title: string; segueToNext: boolean; notes: string; position: number }[] }[] }, customTitle?: string) => {
      if (isGuestMode) {
        // In guest mode, just replace current slots and update title
        const firstSongs = suggestion.sets.flatMap(s => s.songs).slice(0, 2).map(s => s.title);
        const newTitle = customTitle || (firstSongs.length > 0 ? `AI Set: ${firstSongs.join(" > ")}` : "AI Generated Setlist");
        setTitle(newTitle);

        const newSlots: SetlistSlotData[] = [];
        for (const set of suggestion.sets) {
          for (const suggestedSong of set.songs) {
            const song = songs.find((s) => s.id === suggestedSong.songId);
            if (!song) continue;
            newSlots.push({
              id: crypto.randomUUID(),
              song,
              version: null,
              setNumber: set.setNumber,
              position: suggestedSong.position,
              segueToNext: suggestedSong.segueToNext,
              notes: suggestedSong.notes || "",
            });
          }
        }
        setGuestSlots(newSlots);
        return;
      }

      const firstSongs = suggestion.sets.flatMap(s => s.songs).slice(0, 2).map(s => s.title);
      const newTitle = customTitle || (firstSongs.length > 0 ? `AI Set: ${firstSongs.join(" > ")}` : "AI Generated Setlist");
      const created = await createSetlist(newTitle, selectedEra);
      if (!created) return;
      navigate(`/builder/${created.id}`, { replace: false });
      setTimeout(async () => {
        await addAISongsToSetlist(suggestion, created.id);
      }, 300);
    },
    [isGuestMode, songs, createSetlist, selectedEra, navigate]
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

  // Gated actions
  const handleSave = useCallback(() => {
    if (requireAuth("save")) return;
    // Already authenticated — setlist auto-saves
    toast.success("Setlist is saved!");
  }, [requireAuth]);

  const handleShare = useCallback(() => {
    if (requireAuth("share")) return;
    setShareOpen(true);
  }, [requireAuth]);

  const handleCollaborate = useCallback(() => {
    if (requireAuth("collaborate")) return;
    setChatOpen(true);
  }, [requireAuth]);

  const handleTogglePublic = useCallback(() => {
    if (requireAuth("save")) return;
    togglePublic();
  }, [requireAuth, togglePublic]);

  // Handle AI welcome overlay generation
  const handleWelcomeGenerated = useCallback(
    (suggestion: { explanation: string; sets: { setNumber: number; songs: { songId: string; title: string; segueToNext: boolean; notes: string; position: number }[] }[] }, eraId: string | null) => {
      if (eraId) setSelectedEra(eraId);
      const firstSongs = suggestion.sets.flatMap(s => s.songs).slice(0, 2).map(s => s.title);
      const newTitle = firstSongs.length > 0 ? `${firstSongs.join(" > ")}` : "AI Generated Setlist";
      setTitle(newTitle);

      const newSlots: SetlistSlotData[] = [];
      for (const set of suggestion.sets) {
        for (const suggestedSong of set.songs) {
          const song = songs.find((s) => s.id === suggestedSong.songId);
          if (!song) continue;
          newSlots.push({
            id: crypto.randomUUID(),
            song,
            version: null,
            setNumber: set.setNumber,
            position: suggestedSong.position,
            segueToNext: suggestedSong.segueToNext,
            notes: suggestedSong.notes || "",
          });
        }
      }

      if (isGuestMode) {
        setGuestSlots(newSlots);
      } else {
        newSlots.forEach((slot) => addSlot(slot));
      }

      setWelcomeDismissed(true);
      setMobileTab("setlist");

      const firstPlayable = newSlots.find((s) => s.version?.archive_org_url);
      if (firstPlayable) {
        playSingle(firstPlayable);
      }

      toast.success("Your dream show is ready! 🎶");
    },
    [songs, isGuestMode, addSlot, playSingle]
  );

  if (authLoading && paramId) {
    return (
      <PageLayout minimal><div className="flex-1 flex items-center justify-center">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-48 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div></PageLayout>
    );
  }

  return (
    <PageLayout minimal>
      {/* AI Welcome Overlay for fresh builder */}
      {showWelcome && (
        <AIWelcomeOverlay
          eras={eras}
          onGenerated={handleWelcomeGenerated}
          onSkip={() => setWelcomeDismissed(true)}
        />
      )}

      {!showWelcome && <>
      <header className="border-b border-border">
        {/* Row 1: Logo, title, saved indicator */}
        <div className="px-3 sm:px-6 py-3 sm:py-5 flex items-center gap-2 sm:gap-5">
          <button onClick={() => navigate("/")} className="font-display text-3xl sm:text-6xl text-primary shrink-0">
            DS
          </button>
          {user && (
            <button
              onClick={() => navigate("/my-setlists")}
              className="text-2xl font-body text-muted-foreground hover:text-foreground transition-colors shrink-0 hidden sm:flex items-center gap-2"
              title="My Setlists"
            >
              <List className="w-8 h-8" /> My Setlists
            </button>
          )}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            className="bg-transparent border-none text-foreground font-display text-xl sm:text-4xl md:text-5xl p-0 h-auto focus-visible:ring-0 min-w-0 flex-1"
          />
          {setlist && (
            <span className="flex items-center gap-1 text-xs sm:text-sm text-accent font-body shrink-0" title="All changes are saved automatically">
              <CheckCircle className="w-3 sm:w-4 h-3 sm:h-4" /> <span className="hidden sm:inline">Saved</span>
            </span>
          )}
          {isGuestMode && guestSlots.length > 0 && (
            <Button
              variant="default"
              size="sm"
              className="shrink-0 h-8 sm:h-9 px-3 gap-1.5 bg-primary text-primary-foreground font-body text-xs sm:text-sm"
              onClick={handleSave}
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">Save</span>
            </Button>
          )}
          {!isGuestMode && (
            <div className="hidden sm:block">
              <CollaboratorAvatars collaborators={collaborators} />
            </div>
          )}
        </div>

        {/* Row 2: Toolbar */}
        <div className="px-2 sm:px-4 py-2 border-t border-border/50 flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide">
          {/* Set selector */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <span className="text-sm text-muted-foreground font-body hidden sm:inline">Add to:</span>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setActiveSet(n)}
                className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm font-body rounded transition-colors ${
                  activeSet === n
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {n === 3 ? "E" : `S${n}`}
              </button>
            ))}
          </div>

          <div className="w-px h-5 sm:h-6 bg-border shrink-0" />

          {/* Era filter */}
          <Select value={selectedEra || ""} onValueChange={(v) => setSelectedEra(v || null)}>
            <SelectTrigger className="w-auto min-w-[80px] sm:min-w-[100px] max-w-[140px] sm:max-w-[160px] bg-card border-border text-foreground font-body text-xs sm:text-sm h-8 sm:h-9 shrink-0">
              <SelectValue placeholder="All eras" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {eras.map((era) => (
                <SelectItem key={era.id} value={era.id} className="font-body text-sm">
                  {era.name} ({era.year_start}–{era.year_end})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-px h-5 sm:h-6 bg-border shrink-0" />

          {/* Action buttons */}
          {user && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 text-foreground relative"
              onClick={handleCollaborate}
              title="Chat"
            >
              <MessageCircle className="w-4 sm:w-5 h-4 sm:h-5" />
              {chatUnread && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary rounded-full animate-pulse border-2 border-card" />
              )}
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            className="shrink-0 h-8 sm:h-9 px-2 sm:px-3 gap-1.5 sm:gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground font-display text-xs sm:text-sm shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 animate-pulse hover:animate-none"
            onClick={() => setAiOpen(true)}
            title="AI Dead Head — Generate a setlist"
          >
            <Sparkles className="w-4 sm:w-5 h-4 sm:h-5" />
            <span className="hidden sm:inline">AI Dead Head</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 sm:h-9 sm:w-9 shrink-0 ${setlist?.is_public ? "text-accent" : "text-foreground"}`}
            onClick={handleTogglePublic}
            title={setlist?.is_public ? "Public — visible on Browse" : "Private — only you and collaborators"}
          >
            <Globe className="w-4 sm:w-5 h-4 sm:h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 text-foreground"
            onClick={handleShare}
            title="Share"
          >
            <Share2 className="w-4 sm:w-5 h-4 sm:h-5" />
          </Button>
          {user && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 text-muted-foreground hover:text-foreground sm:hidden"
                onClick={() => navigate("/my-setlists")}
                title="My Setlists"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={signOut}
                title="Sign Out"
              >
                <LogOut className="w-4 sm:w-5 h-4 sm:h-5" />
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      {isMobile && (
        <div className="flex border-b border-border bg-card/50">
          <button
            onClick={() => setMobileTab("songs")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-body transition-colors ${
              mobileTab === "songs"
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground"
            }`}
          >
            <Music className="w-4 h-4" />
            Song Vault
          </button>
          <button
            onClick={() => setMobileTab("setlist")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-body transition-colors relative ${
              mobileTab === "setlist"
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground"
            }`}
          >
            <LayoutList className="w-4 h-4" />
            The Set
            {activeSlots.length > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {activeSlots.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Song Vault — hidden on mobile when setlist tab is active */}
        <div className={`w-full lg:w-[380px] border-b lg:border-b-0 border-r-0 lg:border-r border-border overflow-hidden flex flex-col ${
          isMobile ? (mobileTab === "songs" ? "flex-1 pb-12" : "hidden") : "max-h-[calc(100vh-85px)]"
        }`}>
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
                playSingle({
                  id: "preview",
                  song: { title: songTitle, id: "" } as any,
                  version: { archive_org_url: url, show_date: showDate, venue } as any,
                  setNumber: 1,
                  position: 0,
                  segueToNext: false,
                });
              }}
            />
          )}
        </div>

        {/* Setlist — hidden on mobile when songs tab is active */}
        <div className={`flex-1 overflow-hidden flex flex-col ${
          isMobile ? (mobileTab === "setlist" ? "flex-1" : "hidden") : "lg:max-h-[calc(100vh-85px)]"
        }`}>
           <SetlistDisplay
            slots={activeSlots}
            activeSlotId={playingSlot ? playingSlot.id : null}
            description={description}
            generatingDescription={generatingDescription}
            onGenerateDescription={handleGenerateDescription}
            onRemoveSlot={handleRemoveSlot}
            onToggleSegue={handleToggleSegue}
            onUpdateNotes={handleUpdateNotes}
            onReorder={handleReorder}
            onPlayVersion={(slot) => {
              playSingle(slot);
            }}
            onPlaySetlist={async () => {
              if (activeSlots.length === 0) return;
              await globalPlaySetlist(activeSlots, setlist?.id);
            }}
          />
        </div>
      </div>

      {/* Chat Sidebar — only for authenticated users */}
      {user && (
        <ChatSidebar
          setlistId={setlist?.id || null}
          user={user}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          onUnreadChange={setChatUnread}
        />
      )}

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
        currentSlots={activeSlots.map((s) => ({
          songTitle: s.song.title,
          setNumber: s.setNumber,
          segue: s.segueToNext,
        }))}
        onApplySuggestion={handleApplyAISuggestion}
        onCreateNewSetlist={handleCreateNewFromAI}
      />

      {/* Inline Auth Modal for guests */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onAuthenticated={handleAuthenticated}
      />

      {/* Mobile mini-setlist bar — shown when browsing Song Vault */}
      {isMobile && mobileTab === "songs" && activeSlots.length > 0 && (
        <MiniSetlistBar
          title={title}
          songCount={activeSlots.length}
          onExpand={() => setMobileTab("setlist")}
          pulse={miniBarPulse}
        />
      )}

      </>}
    </PageLayout>
  );
};

export default Builder;
