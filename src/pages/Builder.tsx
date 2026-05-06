import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Star, Share2, Users, LogOut, MessageCircle, Globe, CheckCircle, List, Music, LayoutList, Save, FileImage, MoreHorizontal, CalendarDays } from "lucide-react";
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
import CosmicCharlieDialog from "@/components/CosmicCharlieDialog";
import BuildFromShowDialog, { type ShowSeed } from "@/components/BuildFromShowDialog";
import CosmicCharlieWelcome from "@/components/CosmicCharlieWelcome";
import AuthModal from "@/components/AuthModal";
import MiniSetlistBar from "@/components/MiniSetlistBar";
import SaveCelebration from "@/components/SaveCelebration";
import GuestSignInPrompt from "@/components/GuestSignInPrompt";
import ShowPlate from "@/components/ShowPlate";
import ShareFlow from "@/components/ShareFlow";
import { useSongs } from "@/hooks/useSongs";
import { useAuth } from "@/hooks/useAuth";
import { useSetlist } from "@/hooks/useSetlist";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { emitCommunityFeedOptimisticInsert } from "@/lib/communityFeedEvents";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];
type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];

/* Overflow menu sub-component */
const OverflowMenu = ({
  user,
  isMobile,
  isPublic,
  onTogglePublic,
  onCollaborate,
  onSignOut,
  onMySetlists,
  chatUnread,
}: {
  user: any;
  isMobile: boolean;
  isPublic: boolean;
  onTogglePublic: () => void;
  onCollaborate: () => void;
  onSignOut: () => void;
  onMySetlists: () => void;
  chatUnread: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [open]);

  const itemClass = "flex items-center gap-2.5 w-full font-body text-sm px-3 py-2 rounded-lg hover:bg-muted text-left text-foreground transition-colors";

  return (
    <div ref={ref} className="relative shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 text-muted-foreground hover:text-foreground relative"
        onClick={() => setOpen((v) => !v)}
        title="More actions"
      >
        <MoreHorizontal className="w-5 h-5" />
        {chatUnread && user && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-primary rounded-full animate-pulse border-2 border-card" />
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-md p-1 min-w-[180px]">
          <button className={itemClass} onClick={() => { onTogglePublic(); setOpen(false); }}>
            <Globe className="w-4 h-4" />
            {isPublic ? "Make private" : "Make public"}
          </button>
          {user && (
            <button className={itemClass} onClick={() => { onCollaborate(); setOpen(false); }}>
              <MessageCircle className="w-4 h-4" />
              Chat / Collaborate
              {chatUnread && <span className="ml-auto w-2 h-2 bg-primary rounded-full" />}
            </button>
          )}
          {user && isMobile && (
            <button className={itemClass} onClick={() => { onMySetlists(); setOpen(false); }}>
              <List className="w-4 h-4" />
              My Setlists
            </button>
          )}
          {user && (
            <button className={`${itemClass} text-muted-foreground`} onClick={() => { onSignOut(); setOpen(false); }}>
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          )}
        </div>
      )}
    </div>
  );
};

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
  const [charlieOpen, setCharlieOpen] = useState(false);
  const [showDateOpen, setShowDateOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const { playSingle, playSetlist: globalPlaySetlist, playingSlot } = useAudioPlayer();
  const [description, setDescription] = useState<string | null>(null);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [mobileTab, setMobileTab] = useState<"songs" | "setlist">(paramId ? "setlist" : "songs");
  const [miniBarPulse, setMiniBarPulse] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [savedSetlistId, setSavedSetlistId] = useState<string | null>(null);
  const [guestPromptShown, setGuestPromptShown] = useState(false);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [showIdleNudge, setShowIdleNudge] = useState(false);
  const [charlieCreating, setCharlieCreating] = useState(false);

  // Auth modal state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const pendingActionRef = useRef<"save" | "share" | "collaborate" | null>(null);

  // AI welcome overlay: show when explicitly requested via ?wizard=true, or for fresh guest builder
  const [searchParams, setSearchParams] = useSearchParams();
  const wizardRequested = searchParams.get("wizard") === "true";
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const showWelcome = !paramId && !welcomeDismissed && (wizardRequested || (!authLoading && !user));

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
  const hasGuestData = guestSlots.length > 0;

  // Restore cached guest data from sessionStorage (survives OAuth redirect)
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || songs.length === 0) return;
    const cached = sessionStorage.getItem("deadset-guest-cache");
    if (!cached) return;
    restoredRef.current = true;
    try {
      const parsed = JSON.parse(cached);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.era) setSelectedEra(parsed.era);
      if (parsed.description) setDescription(parsed.description);
      if (parsed.slots?.length) {
        const restored: SetlistSlotData[] = parsed.slots
          .map((s: any) => {
            const song = songs.find((sg) => sg.id === s.songId);
            if (!song) return null;
            return {
              id: s.id || crypto.randomUUID(),
              song,
              version: null,
              setNumber: s.setNumber,
              position: s.position,
              segueToNext: s.segueToNext || false,
              notes: s.notes || "",
            };
          })
          .filter(Boolean) as SetlistSlotData[];
        if (restored.length > 0) setGuestSlots(restored);
      }
      // Don't clear cache yet — clear after successful save to DB
    } catch { /* ignore corrupt cache */ }
  }, [songs]);

  // Helper: cache guest data to sessionStorage before auth redirect
  const cacheGuestData = useCallback(() => {
    const currentSlots = guestSlots.length > 0 ? guestSlots : [];
    if (currentSlots.length === 0) return;
    const payload = {
      title,
      era: selectedEra,
      description,
      slots: currentSlots.map((s) => ({
        id: s.id,
        songId: s.song.id,
        setNumber: s.setNumber,
        position: s.position,
        segueToNext: s.segueToNext,
        notes: s.notes,
      })),
    };
    sessionStorage.setItem("deadset-guest-cache", JSON.stringify(payload));
  }, [guestSlots, title, selectedEra, description]);

  // Initialize setlist for authenticated users (create new or load existing)
  const creatingRef = useRef(false);
  useEffect(() => {
    if (!user || initialized || authLoading || showWelcome || hasGuestData) return;
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
  }, [user, paramId, initialized, authLoading, setlist, showWelcome, hasGuestData]);

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

  // Fetch display name for share text
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name").eq("user_id", user.id).single()
      .then(({ data }) => setDisplayName(data?.display_name || null));
  }, [user]);

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
      cacheGuestData();
      pendingActionRef.current = action;
      setAuthModalOpen(true);
      return true; // blocked
    }
    return false; // allowed
  }, [user, cacheGuestData]);

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
    // Check in-memory guest slots first, then sessionStorage cache
    const hasInMemory = guestSlotsRef.current.length > 0;
    const cachedRaw = sessionStorage.getItem("deadset-guest-cache");
    if (!hasInMemory && !cachedRaw) return;

    hasSavedGuestRef.current = true;

    const saveGuestSetlist = async () => {
      let slotsToSave = guestSlotsRef.current;
      let titleToSave = guestTitleRef.current;
      let eraToSave = guestEraRef.current;

      // If no in-memory slots, restore from cache (OAuth redirect case)
      if (slotsToSave.length === 0 && cachedRaw) {
        try {
          const parsed = JSON.parse(cachedRaw);
          if (parsed.title) titleToSave = parsed.title;
          if (parsed.era) eraToSave = parsed.era;
          if (parsed.description) setDescription(parsed.description);
          // We need songs to resolve IDs — wait for them
          if (songs.length === 0) {
            // Songs not loaded yet; reset flag and let effect re-run
            hasSavedGuestRef.current = false;
            return;
          }
          slotsToSave = (parsed.slots || [])
            .map((s: any) => {
              const song = songs.find((sg: any) => sg.id === s.songId);
              if (!song) return null;
              return {
                id: s.id || crypto.randomUUID(),
                song,
                version: null,
                setNumber: s.setNumber,
                position: s.position,
                segueToNext: s.segueToNext || false,
                notes: s.notes || "",
              };
            })
            .filter(Boolean) as SetlistSlotData[];
          if (slotsToSave.length === 0) {
            sessionStorage.removeItem("deadset-guest-cache");
            hasSavedGuestRef.current = false;
            return;
          }
        } catch {
          sessionStorage.removeItem("deadset-guest-cache");
          hasSavedGuestRef.current = false;
          return;
        }
      }

      const shareToken = crypto.randomUUID();
      const { data: newSetlist, error } = await supabase
        .from("setlists")
        .insert({
          creator_id: user.id,
          title: titleToSave,
          era_id: eraToSave || null,
          share_token: shareToken,
          is_public: true,
          is_collaborative: false,
        })
        .select()
        .single();

      if (error || !newSetlist) {
        toast.error("Failed to save your setlist");
        hasSavedGuestRef.current = false;
        return;
      }

      const slotsToInsert = slotsToSave.map((slot) => ({
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

      // Mark initialized BEFORE clearing guest data to prevent the
      // init effect from racing and trying to create a duplicate setlist
      setInitialized(true);

      // Clear guest state and cache
      sessionStorage.removeItem("deadset-guest-cache");
      setGuestSlots([]);
      setSavedSetlistId(newSetlist.id);
      setShowCelebration(true);
      navigate(`/builder/${newSetlist.id}`, { replace: true });
      setMobileTab("setlist");

      pendingActionRef.current = null;
    };
    saveGuestSetlist();
  }, [user, navigate, songs]);

  const handleApplySuggestion = useCallback(
    async (suggestion: { setlist_name?: string; explanation: string; sets: { setNumber: number; songs: { songId: string; title: string; segueToNext: boolean; notes: string; position: number }[] }[] }) => {
      const newTitle = suggestion.setlist_name?.trim() || title;
      setTitle(newTitle);
      if (suggestion.explanation) setDescription(suggestion.explanation);

      if (isGuestMode) {
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
        setMobileTab("setlist");
      } else {
        for (const slot of slots) {
          await removeSlot(slot.id);
        }
        await addSongsToCurrentSetlist(suggestion);
        if (newTitle !== setlist?.title) updateTitle(newTitle);
      }
    },
    [isGuestMode, slots, songs, removeSlot, title, setlist, updateTitle]
  );

  const handleCreateNewFromCharlie = useCallback(
    async (suggestion: { setlist_name?: string; explanation: string; sets: { setNumber: number; songs: { songId: string; title: string; segueToNext: boolean; notes: string; position: number }[] }[] }, customTitle?: string) => {
      // Build the slot list ONCE so guest + auth flows share the same data and we
      // can hydrate local state immediately (avoids the post-navigate empty-render bug).
      const builtSlots: SetlistSlotData[] = [];
      let dropped = 0;
      for (const set of suggestion.sets) {
        for (const suggestedSong of set.songs) {
          const song = songs.find((s) => s.id === suggestedSong.songId);
          if (!song) {
            dropped++;
            continue;
          }
          builtSlots.push({
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

      if (builtSlots.length === 0) {
        console.error("[Cosmic Charlie] No songs could be matched to the catalog", { suggestion, songsLoaded: songs.length });
        toast.error("Charlie's picks didn't match the catalog. Try again.");
        return;
      }
      if (dropped > 0) {
        console.warn(`[Cosmic Charlie] Dropped ${dropped} unmatched songs from suggestion`);
      }

      if (isGuestMode) {
        const newTitle = customTitle || suggestion.setlist_name?.trim() || "Untitled Setlist";
        setCharlieCreating(true);
        setTitle(newTitle);
        if (suggestion.explanation) setDescription(suggestion.explanation);
        setGuestSlots(builtSlots);
        setMobileTab("setlist");
        // Brief skeleton so UI doesn't flash empty between dialog close and render
        setTimeout(() => setCharlieCreating(false), 350);
        return;
      }

      setCharlieCreating(true);
      try {
        const newTitle = customTitle || suggestion.setlist_name?.trim() || "Untitled Setlist";
        if (suggestion.explanation) setDescription(suggestion.explanation);
        const created = await createSetlist(newTitle, selectedEra);
        if (!created) {
          setCharlieCreating(false);
          return;
        }
        // Persist slots directly before navigating (avoids stale closure / unmount issues)
        await addSongsToSetlist(suggestion, created.id);
        if (suggestion.explanation) {
          await supabase.from("setlists").update({ description: suggestion.explanation }).eq("id", created.id);
        }
        // Hydrate local slots immediately so the UI shows the songs even if the
        // post-navigate loadSetlist() races or briefly returns an empty result.
        setSlots(builtSlots);
        setMobileTab("setlist");
        navigate(`/builder/${created.id}`, { replace: false });
      } finally {
        // Keep skeleton visible briefly after navigation so route transition can settle
        setTimeout(() => setCharlieCreating(false), 400);
      }
    },
    [isGuestMode, songs, createSetlist, selectedEra, navigate, setSlots]
  );

  const addSongsToCurrentSetlist = useCallback(
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

  const addSongsToSetlist = useCallback(
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

  // Seed a setlist from a chosen show date — works for both guests and authed users.
  // Uses the real historical setlist (sets, order, segues) parsed from archive.org.
  const handleShowDateSeed = useCallback(
    async (seed: ShowSeed) => {
      const newSlots: SetlistSlotData[] = seed.slots.map((s) => ({
        id: crypto.randomUUID(),
        song: s.song,
        version: null,
        setNumber: s.setNumber,
        position: s.position,
        segueToNext: s.segueToNext,
        notes: s.sourceDate
          ? `From ${s.sourceDate}${s.sourceVenue ? ` · ${s.sourceVenue}` : ""}`
          : "",
      }));

      setTitle(seed.title);
      if (seed.eraId) setSelectedEra(seed.eraId);

      if (isGuestMode) {
        setGuestSlots(newSlots);
        setMobileTab("setlist");
        return;
      }

      // Authenticated: REPLACE the setlist atomically so the user gets exactly the show they
      // picked — no merge with prior slots, no race with realtime, no curation.
      if (setlist) {
        if (seed.title !== setlist.title) await updateTitle(seed.title);
        if (!user) return;

        // 1. Atomic wipe of existing slots in a single query
        const { error: delErr } = await supabase
          .from("setlist_slots")
          .delete()
          .eq("setlist_id", setlist.id);
        if (delErr) {
          console.error("Failed to clear setlist:", delErr);
          toast.error("Couldn't replace setlist — try again");
          return;
        }

        // 2. Bulk insert the historical show
        const rows = newSlots.map((slot) => ({
          id: slot.id,
          setlist_id: setlist.id,
          set_number: slot.setNumber,
          position: slot.position,
          song_id: slot.song.id,
          notable_version_id: null,
          added_by_user_id: user.id,
          notes: slot.notes,
          segue_to_next: slot.segueToNext,
        }));
        if (rows.length > 0) {
          const { error: insErr } = await supabase.from("setlist_slots").insert(rows);
          if (insErr) {
            console.error("Failed to insert show slots:", insErr);
            toast.error("Couldn't load show into setlist");
            return;
          }
        }

        // 3. Sync local state immediately (realtime will reconcile)
        setSlots(newSlots);
      } else {
        const created = await createSetlist(seed.title, seed.eraId);
        if (!created || !user) return;
        const rows = newSlots.map((slot) => ({
          id: slot.id,
          setlist_id: created.id,
          set_number: slot.setNumber,
          position: slot.position,
          song_id: slot.song.id,
          notable_version_id: null,
          added_by_user_id: user.id,
          notes: slot.notes,
          segue_to_next: slot.segueToNext,
        }));
        if (rows.length > 0) {
          await supabase.from("setlist_slots").insert(rows);
        }
        navigate(`/builder/${created.id}`, { replace: false });
      }
      setMobileTab("setlist");
    },
    [isGuestMode, setlist, user, createSetlist, updateTitle, navigate, setSlots],
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
    if (setlist) {
      setSavedSetlistId(setlist.id);
      setShowCelebration(true);
    } else {
      toast.success("Setlist is saved!");
    }
  }, [requireAuth, setlist]);

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
    togglePublic().then((updatedSetlist) => {
      if (!updatedSetlist?.is_public || !user) return;

      emitCommunityFeedOptimisticInsert({
        id: updatedSetlist.id,
        title: updatedSetlist.title,
        creator_id: updatedSetlist.creator_id,
        era_id: updatedSetlist.era_id,
        upvote_count: updatedSetlist.upvote_count,
        play_count: updatedSetlist.play_count,
        creator_name: displayName || "Unknown",
        song_count: activeSlots.length,
        created_at: updatedSetlist.created_at,
      });
    });
  }, [requireAuth, togglePublic, user, displayName, activeSlots]);

  // Handle AI welcome overlay generation
  const handleWelcomeGenerated = useCallback(
    async (suggestion: { setlist_name?: string; explanation: string; sets: { setNumber: number; songs: { songId: string; title: string; segueToNext: boolean; notes: string; position: number }[] }[] }, eraId: string | null) => {
      if (eraId) setSelectedEra(eraId);
      const newTitle = suggestion.setlist_name?.trim() || "Untitled Setlist";
      setTitle(newTitle);
      if (suggestion.explanation) setDescription(suggestion.explanation);

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
        // For authenticated users, create the setlist first then persist slots directly
        // (setlist is null at this point because init was skipped while welcome was shown)
        const created = await createSetlist(newTitle, eraId);
        if (created) {
          for (const slot of newSlots) {
            await supabase.from("setlist_slots").insert({
              id: slot.id,
              setlist_id: created.id,
              set_number: slot.setNumber,
              position: slot.position,
              song_id: slot.song.id,
              notable_version_id: slot.version?.id || null,
              added_by_user_id: user!.id,
              notes: slot.notes,
              segue_to_next: slot.segueToNext,
            });
          }
          // Update description if generated
          if (suggestion.explanation) {
            await supabase.from("setlists").update({ description: suggestion.explanation }).eq("id", created.id);
          }
          navigate(`/builder/${created.id}`, { replace: true });
        }
      }

      setWelcomeDismissed(true);
      // Clear wizard param from URL
      if (wizardRequested) {
        searchParams.delete("wizard");
        setSearchParams(searchParams, { replace: true });
      }
      setMobileTab("setlist");

      const firstPlayable = newSlots.find((s) => s.version?.archive_org_url);
      if (firstPlayable) {
        playSingle(firstPlayable);
      }

      toast.success("Charlie's got you — your dream show is ready! 🎶");
    },
    [songs, isGuestMode, createSetlist, user, navigate, playSingle]
  );

  // Show guest sign-in prompt after guest builds a setlist with 2+ songs
  useEffect(() => {
    if (isGuestMode && guestSlots.length >= 2 && !guestPromptShown) {
      const timer = setTimeout(() => {
        setShowGuestPrompt(true);
        setGuestPromptShown(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isGuestMode, guestSlots.length, guestPromptShown]);

  // Idle nudge: if builder has 0 songs after 10s, suggest Cosmic Charlie
  useEffect(() => {
    if (showWelcome || activeSlots.length > 0 || charlieOpen || showIdleNudge) return;
    const timer = setTimeout(() => {
      if (activeSlots.length === 0) setShowIdleNudge(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [showWelcome, activeSlots.length, charlieOpen, showIdleNudge]);

  // Dismiss idle nudge when songs are added or Charlie opens
  useEffect(() => {
    if (activeSlots.length > 0 || charlieOpen) setShowIdleNudge(false);
  }, [activeSlots.length, charlieOpen]);

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
      {/* Cosmic Charlie Welcome for fresh builder */}
      {showWelcome && (
        <CosmicCharlieWelcome
          eras={eras}
          onGenerated={handleWelcomeGenerated}
          onSkip={() => {
            setWelcomeDismissed(true);
            if (wizardRequested) {
              searchParams.delete("wizard");
              setSearchParams(searchParams, { replace: true });
            }
          }}
        />
      )}

      {!showWelcome && <>
      <header className="border-b border-border">
        {/* Row 1: Logo, title, saved indicator */}
        <div className="px-3 sm:px-6 py-2.5 sm:py-5 flex items-center gap-2 sm:gap-5">
          <button onClick={() => navigate("/")} className="font-display text-2xl sm:text-6xl text-primary shrink-0">
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
            className="bg-transparent border-none text-foreground font-display text-lg sm:text-4xl md:text-5xl p-0 h-auto focus-visible:ring-0 min-w-0 flex-1"
          />
          {setlist && (
            <span className="flex items-center gap-1 text-xs text-accent font-body shrink-0" title="All changes are saved automatically">
              <CheckCircle className="w-3.5 h-3.5" />
            </span>
          )}
          {isGuestMode && guestSlots.length > 0 && (
            <Button
              variant="default"
              size="sm"
              className="shrink-0 h-9 px-3 gap-1.5 bg-primary text-primary-foreground font-body text-xs"
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

        {/* Row 2: Toolbar — 2 rows on mobile, single row on desktop */}
        <div className="px-2 sm:px-4 py-2 border-t border-border/50 flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Row 2a: Set selector + Era filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-sm text-muted-foreground font-body hidden sm:inline">Add to:</span>
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setActiveSet(n)}
                  className={`min-w-[44px] min-h-[44px] px-3 py-2 text-sm font-body rounded-[10px] transition-colors ${
                    activeSet === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n === 3 ? "E" : `S${n}`}
                </button>
              ))}
            </div>

            <div className="w-px h-7 bg-border shrink-0 hidden sm:block" />

            {/* Era filter */}
            <Select value={selectedEra || ""} onValueChange={(v) => setSelectedEra(v || null)}>
              <SelectTrigger className="w-auto min-w-[100px] max-w-[160px] bg-card border-border text-foreground font-body text-sm h-10 shrink-0">
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
          </div>

          {/* Row 2b: Action buttons — collapsed toolbar */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Primary: Cosmic Charlie */}
            <Button
              variant="default"
              size="sm"
              className="shrink-0 h-10 px-4 gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground font-display text-sm shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 animate-[fadeInScale_0.4s_ease-out_forwards]"
              onClick={() => setCharlieOpen(true)}
              title="Cosmic Charlie — Your Deadhead Guide"
            >
              <Star className="w-5 h-5" />
              <span className="hidden sm:inline">Cosmic Charlie</span>
            </Button>

            {/* From a show date */}
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 h-10 px-3 gap-2 border-border text-foreground hover:bg-muted font-body text-sm"
              onClick={() => setShowDateOpen(true)}
              title="Recreate a show from a specific date"
            >
              <CalendarDays className="w-5 h-5" />
              <span className="hidden md:inline">From a show</span>
            </Button>

            {/* Secondary: Share */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 text-foreground"
              onClick={handleShare}
              title="Share"
            >
              <Share2 className="w-5 h-5" />
            </Button>

            {/* View Poster & Plate — prominent CTA when saved */}
            {paramId && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 h-10 px-4 gap-2 border-primary/50 text-primary hover:bg-primary/10 hover:border-primary font-display text-sm transition-all duration-200"
                onClick={() => navigate(`/setlist/${paramId}`)}
                title="View your concert poster and shareable plate"
              >
                <FileImage className="w-5 h-5" />
                <span className="hidden sm:inline">View Poster</span>
              </Button>
            )}

            {/* Overflow menu */}
            {(() => {
              const hasOverflowItems = true; // Globe toggle is always available
              const showOverflow = isMobile || hasOverflowItems;
              if (!showOverflow) return null;
              return (
                <OverflowMenu
                  user={user}
                  isMobile={isMobile}
                  isPublic={!!setlist?.is_public}
                  onTogglePublic={handleTogglePublic}
                  onCollaborate={handleCollaborate}
                  onSignOut={async () => { await signOut(); navigate("/"); }}
                  onMySetlists={() => navigate("/my-setlists")}
                  chatUnread={chatUnread}
                />
              );
            })()}
          </div>
        </div>
      </header>

      {/* Mobile Tab Switcher — The Set first, Song Vault second */}
      {isMobile && (
        <div className="flex border-b border-border bg-card/50">
          <button
            onClick={() => setMobileTab("setlist")}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-body transition-colors relative ${
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
          <button
            onClick={() => setMobileTab("songs")}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-body transition-colors ${
              mobileTab === "songs"
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground"
            }`}
          >
            <Music className="w-4 h-4" />
            Song Vault
          </button>
        </div>
      )}

      {/* Main Content — Setlist first, Song Vault second */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Setlist — hidden on mobile when songs tab is active */}
        <div className={`flex-1 overflow-hidden flex flex-col ${
          isMobile ? (mobileTab === "setlist" ? "flex-1" : "hidden") : "lg:max-h-[calc(100vh-85px)]"
        }`}>
          {/* Mobile: Plate + Poster strip at top */}
          {isMobile && activeSlots.length > 0 && (
            <div className="border-b border-border bg-[#0F0E0C] px-3 py-3">
              <div className="flex gap-3 items-start">
                {/* Plate thumbnail */}
                <button
                  className="w-[45%] shrink-0 relative group"
                  onClick={() => setShareOpen(true)}
                >
                  <ShowPlate setlistName={title || "Untitled"} size="thumb" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 active:opacity-100 bg-black/30 rounded-lg transition-opacity">
                    <span className="flex items-center gap-1 text-white font-display text-xs"><Share2 className="w-3 h-3" /> Share</span>
                  </div>
                </button>
                {/* Mini J-card poster */}
                <button
                  className="flex-1 min-w-0 text-left relative group"
                  onClick={() => {
                    const id = paramId || setlist?.id;
                    if (id) navigate(`/setlist/${id}`);
                    else toast.info("Save your setlist first to view the full poster");
                  }}
                >
                  <div className="jcard-paper rounded border border-[hsl(28_20%_55%/0.4)] overflow-hidden" style={{ background: "hsl(38 30% 90%)" }}>
                    <div className="px-3 pt-2 pb-1.5">
                      <p className="font-display text-[7px] tracking-[0.12em] uppercase" style={{ color: "hsl(28 30% 25%)" }}>Grateful Dead</p>
                      <p className="font-hand text-xs leading-tight truncate" style={{ color: "hsl(220 60% 30%)" }}>{title || "Untitled"}</p>
                    </div>
                    <div className="mx-2 h-[1px]" style={{ background: "repeating-linear-gradient(90deg, hsl(var(--primary) / 0.3) 0px, hsl(var(--primary) / 0.3) 4px, transparent 4px, transparent 7px)" }} />
                    <div className="px-3 py-1.5">
                      {[1, 2, 3].map((setNum) => {
                        const items = activeSlots.filter(s => s.setNumber === setNum);
                        if (items.length === 0) return null;
                        return (
                          <div key={setNum} className="mb-1 last:mb-0">
                            <p className="font-marker text-[6px] tracking-[0.2em] uppercase" style={{ color: "hsl(var(--primary))" }}>
                              {setNum === 3 ? "Encore" : `Set ${["", "I", "II"][setNum]}`}
                            </p>
                            <p className="font-hand text-[8px] leading-tight truncate" style={{ color: "hsl(220 50% 20%)" }}>
                              {items.map((s, i) => s.song.title + (s.segueToNext ? " → " : i < items.length - 1 ? ", " : "")).join("")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 active:opacity-100 bg-black/30 rounded transition-opacity">
                    <span className="flex items-center gap-1 text-white font-display text-xs"><FileImage className="w-3 h-3" /> Poster</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Idle nudge — no songs after 10s */}
          {showIdleNudge && activeSlots.length === 0 && !showWelcome && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-3 mt-3 p-4 rounded-xl border border-primary/30 bg-primary/5 text-center"
            >
              <p className="font-body text-sm text-foreground mb-2">
                Not sure where to start? 🎶
              </p>
              <Button
                size="sm"
                onClick={() => { setShowIdleNudge(false); setCharlieOpen(true); }}
                className="gap-2 font-body text-sm"
              >
                <Star className="w-4 h-4" />
                Let Cosmic Charlie Build Your Show
              </Button>
            </motion.div>
          )}

           {charlieCreating && activeSlots.length === 0 ? (
            <div role="status" aria-live="polite" className="px-3 py-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                <span className="inline-block w-3 h-3 rounded-full bg-primary animate-pulse" />
                Cosmic Charlie is curating your setlist…
              </div>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl border border-border bg-muted/40 animate-pulse"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          ) : (
            <SetlistDisplay
              slots={activeSlots}
              activeSlotId={playingSlot ? playingSlot.id : null}
              description={description}
              generatingDescription={generatingDescription}
              eraYearRange={(() => {
                const e = eras.find((x) => x.id === selectedEra);
                return e ? { start: e.year_start, end: e.year_end } : null;
              })()}
              onGenerateDescription={handleGenerateDescription}
              onRemoveSlot={handleRemoveSlot}
              onToggleSegue={handleToggleSegue}
              onUpdateNotes={handleUpdateNotes}
              onReorder={handleReorder}
              onPlayVersion={(slot) => {
                // Auto-advance through the rest of the setlist after this song.
                playSingle(slot, { slots: activeSlots, setlistId: setlist?.id ?? null });
              }}
              onPlaySetlist={async () => {
                if (activeSlots.length === 0) return;
                await globalPlaySetlist(activeSlots, setlist?.id);
              }}
            />
          )}
        </div>

        {/* Show Plate + Poster preview — between setlist and vault on desktop */}
        {!isMobile && activeSlots.length > 0 && (
          <div className="w-[320px] border-l border-border bg-[#0F0E0C] flex flex-col shrink-0 overflow-y-auto max-h-[calc(100vh-85px)]">
            {/* Plate — clickable to share */}
            <button
              className="p-4 cursor-pointer hover:opacity-90 transition-opacity group relative"
              onClick={() => setShareOpen(true)}
              title="Click to share plate"
            >
              <ShowPlate setlistName={title || "Untitled"} size="thumb" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded-lg m-4">
                <span className="flex items-center gap-1.5 text-white font-display text-sm"><Share2 className="w-4 h-4" /> Share Plate</span>
              </div>
            </button>

            {/* J-Card Poster replica — clickable to full poster */}
            <button
              className="mx-4 mb-4 cursor-pointer hover:opacity-90 transition-opacity group relative text-left"
              onClick={() => {
                const id = paramId || setlist?.id;
                if (id) navigate(`/setlist/${id}`);
                else toast.info("Save your setlist first to view the full poster");
              }}
              title="Click to view full poster"
            >
              <div className="jcard-paper jcard-lines relative border border-[hsl(28_20%_55%/0.5)] rounded overflow-hidden" style={{ background: "hsl(38 30% 90%)" }}>
                <div className="jcard-margin relative">
                  <div className="px-5 pt-4 pb-3 relative">
                    <h4 className="font-display text-[10px] tracking-[0.15em] uppercase" style={{ color: "hsl(28 30% 25%)" }}>
                      Grateful Dead
                    </h4>
                    <p className="font-hand text-base leading-tight mt-0.5" style={{ color: "hsl(220 60% 30%)" }}>
                      {title || "Untitled"}
                    </p>
                    <p className="font-hand text-[9px] mt-1" style={{ color: "hsl(28 15% 50%)" }}>
                      {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                  <div className="mx-4 h-[1.5px]" style={{ background: "repeating-linear-gradient(90deg, hsl(var(--primary) / 0.4) 0px, hsl(var(--primary) / 0.4) 6px, transparent 6px, transparent 10px)" }} />
                  <div className="px-5 py-3 space-y-3">
                    {[1, 2, 3].map((setNum) => {
                      const setSlotItems = activeSlots.filter(s => s.setNumber === setNum);
                      if (setSlotItems.length === 0) return null;
                      return (
                        <div key={setNum}>
                          <h5 className="font-marker text-[8px] tracking-[0.25em] uppercase mb-1" style={{ color: "hsl(var(--primary))" }}>
                            {setNum === 3 ? "Encore" : `Set ${["", "I", "II"][setNum]}`}
                          </h5>
                          <div className="space-y-0">
                            {setSlotItems.map((slot, i) => (
                              <div key={slot.id} className="flex items-baseline gap-1.5 py-[2px]">
                                <span className="text-[8px] font-mono tabular-nums w-3 text-right shrink-0" style={{ color: "hsl(28 15% 50%)" }}>
                                  {i + 1}.
                                </span>
                                <span className="font-hand text-[11px] leading-snug" style={{ color: "hsl(220 50% 20%)" }}>
                                  {slot.song.title}
                                </span>
                                {slot.segueToNext && (
                                  <span className="text-[9px] font-bold shrink-0" style={{ color: "hsl(var(--primary))" }}>→</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 rounded">
                  <span className="flex items-center gap-1.5 text-white font-display text-sm"><FileImage className="w-4 h-4" /> View Poster</span>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Song Vault — hidden on mobile when setlist tab is active */}
        <div className={`w-full lg:w-[380px] border-b lg:border-b-0 border-l-0 lg:border-l border-border overflow-hidden flex flex-col ${
          isMobile ? (mobileTab === "songs" ? "flex-1 pb-20" : "hidden") : "max-h-[calc(100vh-85px)]"
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

      {/* Share Dialog (legacy) */}
      <ShareDialog
        open={shareOpen && !paramId}
        onOpenChange={setShareOpen}
        shareLink={getShareLink()}
        creatorName={displayName || undefined}
        setlistTitle={title}
        description={description}
      />

      {/* Share Flow with Show Plate (when setlist is saved) */}
      {paramId && (
        <ShareFlow
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          setlistId={paramId}
          setlistName={title}
          eraName={eras.find(e => e.id === selectedEra)?.name}
          description={description}
        />
      )}

      {/* Cosmic Charlie Dialog */}
      <CosmicCharlieDialog
        open={charlieOpen}
        onOpenChange={setCharlieOpen}
        eraId={selectedEra}
        currentSlots={activeSlots.map((s) => ({
          songTitle: s.song.title,
          setNumber: s.setNumber,
          segue: s.segueToNext,
        }))}
        onApplySuggestion={handleApplySuggestion}
        onCreateNewSetlist={handleCreateNewFromCharlie}
      />

      <BuildFromShowDialog
        open={showDateOpen}
        onOpenChange={setShowDateOpen}
        onSeed={handleShowDateSeed}
      />

      {/* Inline Auth Modal for guests */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onAuthenticated={handleAuthenticated}
        onBeforeRedirect={cacheGuestData}
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

      {/* Save celebration */}
      {showCelebration && savedSetlistId && (
        <SaveCelebration
          setlistId={savedSetlistId}
          setlistTitle={title}
          onDismiss={() => setShowCelebration(false)}
        />
      )}

      {/* Guest sign-in prompt */}
      <GuestSignInPrompt
        open={showGuestPrompt}
        onSignIn={() => {
          cacheGuestData();
          setShowGuestPrompt(false);
          pendingActionRef.current = "save";
          setAuthModalOpen(true);
        }}
        onDismiss={() => setShowGuestPrompt(false)}
      />

      </>}
    </PageLayout>
  );
};

export default Builder;
