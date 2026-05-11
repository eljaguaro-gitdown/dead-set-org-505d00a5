import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import type { SetlistSlotData } from "@/components/SetlistDisplay";
import type { User } from "@supabase/supabase-js";

type SetlistRow = Database["public"]["Tables"]["setlists"]["Row"];
type Song = Database["public"]["Tables"]["songs"]["Row"];
type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];

const decodeArchiveNotes = (slotId: string, songId: string, rawNotes: string | null) => {
  let notes = rawNotes || "";
  let version: NotableVersion | null = null;

  if (!notes.startsWith("{\"__archive\":true")) return { notes, version };

  try {
    const nlIndex = notes.indexOf("\n");
    const metaStr = nlIndex > -1 ? notes.substring(0, nlIndex) : notes;
    const meta = JSON.parse(metaStr);
    if (meta.__archive) {
      version = {
        id: `archive-reconstructed-${slotId}`,
        song_id: songId,
        show_date: meta.show_date || "",
        archive_org_url: meta.archive_org_url || null,
        venue: meta.venue || null,
        city: null,
        era_id: null,
        rating: meta.rating || null,
        description: null,
      };
      notes = nlIndex > -1 ? notes.substring(nlIndex + 1) : "";
    }
  } catch {
    // Not valid JSON; leave user notes untouched.
  }

  return { notes, version };
};

const encodeArchiveNotes = (slot: SetlistSlotData) => {
  const userNotes = slot.notes || "";
  if (!slot.version?.id?.startsWith("archive-")) return userNotes;
  const archiveMeta = JSON.stringify({
    __archive: true,
    show_date: slot.version.show_date,
    venue: slot.version.venue,
    archive_org_url: slot.version.archive_org_url,
    rating: slot.version.rating,
  });
  return archiveMeta + (userNotes ? `\n${userNotes}` : "");
};

interface CollaboratorInfo {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
}

export const useSetlist = (user: User | null, setlistId?: string | null) => {
  const [setlist, setSetlist] = useState<SetlistRow | null>(null);
  const [slots, setSlots] = useState<SetlistSlotData[]>([]);
  const [collaborators, setCollaborators] = useState<CollaboratorInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const songsCache = useRef<Map<string, Song>>(new Map());
  const versionsCache = useRef<Map<string, NotableVersion>>(new Map());

  // Create a new setlist
  const createSetlist = useCallback(async (title: string, eraId?: string | null) => {
    if (!user) return null;
    const shareToken = crypto.randomUUID();
    const { data, error } = await supabase
      .from("setlists")
      .insert({
        creator_id: user.id,
        title,
        era_id: eraId || null,
        share_token: shareToken,
        is_public: true,
        is_collaborative: false,
      })
      .select()
      .single();
    if (error) {
      console.error("Failed to create setlist:", error);
      toast.error("Failed to create setlist");
      return null;
    }
    setSetlist(data);
    return data;
  }, [user]);

  // Load existing setlist
  const loadSetlist = useCallback(async (id: string) => {
    const { data: setlistData, error: setlistErr } = await supabase
      .from("setlists")
      .select("*")
      .eq("id", id)
      .single();
    if (setlistErr) console.error("[useSetlist] setlist fetch error:", setlistErr);
    if (!setlistData) return;
    setSetlist(setlistData);

    // Load slots with song and version data
    const { data: slotsData, error: slotsErr } = await supabase
      .from("setlist_slots")
      .select("*")
      .eq("setlist_id", id)
      .order("set_number")
      .order("position");
    if (slotsErr) console.error("[useSetlist] slots fetch error:", slotsErr);

    if (slotsData && slotsData.length > 0) {
      // Fetch all songs and versions for these slots
      const songIds = [...new Set(slotsData.map((s) => s.song_id))];
      const versionIds = slotsData
        .filter((s) => s.notable_version_id)
        .map((s) => s.notable_version_id!);

      const [songsRes, versionsRes] = await Promise.all([
        supabase.from("songs").select("*").in("id", songIds),
        versionIds.length > 0
          ? supabase.from("notable_versions").select("*").in("id", versionIds)
          : Promise.resolve({ data: [] as NotableVersion[] }),
      ]);

      if (songsRes.error) console.error("[useSetlist] songs fetch error:", songsRes.error);
      const songsMap = new Map((songsRes.data || []).map((s) => [s.id, s]));
      const versionsMap = new Map((versionsRes.data || []).map((v) => [v.id, v]));
      songsMap.forEach((v, k) => songsCache.current.set(k, v));
      versionsMap.forEach((v, k) => versionsCache.current.set(k, v));

      const loadedSlots: SetlistSlotData[] = slotsData
        .map((slot) => {
          const song = songsMap.get(slot.song_id);
          if (!song) return null;

          let version = slot.notable_version_id ? versionsMap.get(slot.notable_version_id) || null : null;
          let notes = slot.notes || "";

          // Reconstruct synthetic archive version from stored metadata
          if (!version && notes.startsWith("{\"__archive\":true")) {
            try {
              const nlIndex = notes.indexOf("\n");
              const metaStr = nlIndex > -1 ? notes.substring(0, nlIndex) : notes;
              const meta = JSON.parse(metaStr);
              if (meta.__archive) {
                version = {
                  id: `archive-reconstructed-${slot.id}`,
                  song_id: slot.song_id,
                  show_date: meta.show_date || "",
                  archive_org_url: meta.archive_org_url || null,
                  venue: meta.venue || null,
                  city: null,
                  era_id: null,
                  rating: meta.rating || null,
                  description: null,
                };
                // Strip the metadata line from user-visible notes
                notes = nlIndex > -1 ? notes.substring(nlIndex + 1) : "";
              }
            } catch {
              // Not valid JSON, leave as-is
            }
          }

          return {
            id: slot.id,
            song,
            version,
            setNumber: slot.set_number,
            position: slot.position,
            segueToNext: slot.segue_to_next || false,
            notes,
          };
        })
        .filter(Boolean) as SetlistSlotData[];
      // Defensive: if DB has slot rows but song hydration failed for ALL of them,
      // do NOT overwrite locally-set slots with an empty array — that strands users
      // on an empty UI when songs/versions fetches errored mid-flight.
      if (loadedSlots.length === 0) {
        console.warn(
          `[useSetlist] ${slotsData.length} slot rows present but 0 reconstructed (songs missing). Preserving existing slots.`
        );
      } else {
        setSlots(loadedSlots);
      }
    } else if (slotsData && slotsData.length === 0) {
      // Slot rows truly empty — clear local state so we don't show stale builtSlots
      // from a different setlist. (Safe because the DB is the source of truth here.)
      setSlots([]);
    }

    // Load collaborators
    await loadCollaborators(id);
  }, []);

  const loadCollaborators = async (setlistId: string) => {
    const { data: collabData } = await supabase
      .from("collaborators")
      .select("user_id, role")
      .eq("setlist_id", setlistId);
    if (!collabData || collabData.length === 0) {
      setCollaborators([]);
      return;
    }
    const userIds = collabData.map((c) => c.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", userIds);
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    setCollaborators(
      collabData.map((c) => ({
        userId: c.user_id,
        displayName: profileMap.get(c.user_id)?.display_name || "Unknown",
        avatarUrl: profileMap.get(c.user_id)?.avatar_url || null,
        role: c.role,
      }))
    );
  };

  // Save slot to DB (debounced)
  const persistSlot = useCallback(async (slot: SetlistSlotData, setlistId: string) => {
    if (!user) return;

    // Synthetic archive versions (from the Vault browser) have IDs like "archive-..."
    // These aren't real DB records, so we must NOT use them as FK values.
    // Instead, store the archive metadata in the notes field so we can reconstruct on reload.
    const isSyntheticVersion = slot.version?.id?.startsWith("archive-");
    const notableVersionId = isSyntheticVersion ? null : (slot.version?.id || null);

    let notes = slot.notes || "";
    if (isSyntheticVersion && slot.version) {
      const archiveMeta = JSON.stringify({
        __archive: true,
        show_date: slot.version.show_date,
        venue: slot.version.venue,
        archive_org_url: slot.version.archive_org_url,
        rating: slot.version.rating,
      });
      // Prepend metadata as a hidden JSON line, keep user notes after
      notes = archiveMeta + (notes ? "\n" + notes : "");
    }

    const { error } = await supabase.from("setlist_slots").upsert({
      id: slot.id,
      setlist_id: setlistId,
      set_number: slot.setNumber,
      position: slot.position,
      song_id: slot.song.id,
      notable_version_id: notableVersionId,
      added_by_user_id: user.id,
      notes,
      segue_to_next: slot.segueToNext,
    });
    if (error) {
      console.error("Failed to persist slot:", error);
    }
  }, [user]);

  const addSlot = useCallback(async (slot: SetlistSlotData) => {
    setSlots((prev) => [...prev, slot]);
    if (setlist) {
      await persistSlot(slot, setlist.id);
      // Cache song/version for realtime reconstruction
      songsCache.current.set(slot.song.id, slot.song);
      if (slot.version) versionsCache.current.set(slot.version.id, slot.version);
    }
  }, [setlist, persistSlot]);

  const removeSlot = useCallback(async (id: string) => {
    setSlots((prev) => prev.filter((s) => s.id !== id));
    if (setlist) {
      await supabase.from("setlist_slots").delete().eq("id", id);
    }
  }, [setlist]);

  const updateSlot = useCallback(async (id: string, updates: Partial<SetlistSlotData>) => {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
    if (setlist) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        const slot = slots.find((s) => s.id === id);
        if (!slot) return;
        const merged = { ...slot, ...updates };

        // Preserve archive metadata prefix in notes for synthetic versions
        let notesToSave = merged.notes || "";
        const isSyntheticVersion = merged.version?.id?.startsWith("archive-");
        if (isSyntheticVersion && merged.version) {
          const archiveMeta = JSON.stringify({
            __archive: true,
            show_date: merged.version.show_date,
            venue: merged.version.venue,
            archive_org_url: merged.version.archive_org_url,
            rating: merged.version.rating,
          });
          notesToSave = archiveMeta + (notesToSave ? "\n" + notesToSave : "");
        }

        await supabase.from("setlist_slots").update({
          notes: notesToSave,
          segue_to_next: merged.segueToNext,
          position: merged.position,
          set_number: merged.setNumber,
        }).eq("id", id);
      }, 500);
    }
  }, [setlist, slots]);

  const updateTitle = useCallback(async (newTitle: string) => {
    if (!setlist) return;
    await supabase.from("setlists").update({ title: newTitle }).eq("id", setlist.id);
    setSetlist((prev) => prev ? { ...prev, title: newTitle } : prev);
  }, [setlist]);

  const togglePublic = useCallback(async () => {
    if (!setlist) return;
    const newVal = !setlist.is_public;
    const { error } = await supabase.from("setlists").update({ is_public: newVal }).eq("id", setlist.id);
    if (error) {
      console.error("Failed to update setlist visibility:", error);
      toast.error("Could not update setlist visibility");
      return null;
    }

    const updatedSetlist = { ...setlist, is_public: newVal };
    setSetlist(updatedSetlist);
    toast.success(newVal ? "Setlist is now public" : "Setlist is now private");
    return updatedSetlist;
  }, [setlist]);

  // Generate share link
  const getShareLink = useCallback(() => {
    if (!setlist?.share_token) return "";
    return `${window.location.origin}/join/${setlist.share_token}`;
  }, [setlist]);

  // Subscribe to realtime changes on slots
  useEffect(() => {
    if (!setlist) return;

    const channel = supabase
      .channel(`setlist-${setlist.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "setlist_slots",
          filter: `setlist_id=eq.${setlist.id}`,
        },
        async (payload) => {
          const newRow = payload.new as Database["public"]["Tables"]["setlist_slots"]["Row"];
          // Skip if we already have it (our own insert)
          setSlots((prev) => {
            if (prev.some((s) => s.id === newRow.id)) return prev;
            // Need to reconstruct the slot with song data
            const song = songsCache.current.get(newRow.song_id);
            if (!song) {
              // Fetch song async and update
              supabase.from("songs").select("*").eq("id", newRow.song_id).single().then(({ data }) => {
                if (data) {
                  songsCache.current.set(data.id, data);
                  const versionPromise = newRow.notable_version_id
                    ? supabase.from("notable_versions").select("*").eq("id", newRow.notable_version_id).single()
                    : Promise.resolve({ data: null });
                  versionPromise.then(({ data: vData }) => {
                    if (vData) versionsCache.current.set(vData.id, vData);
                    setSlots((p) => {
                      if (p.some((s) => s.id === newRow.id)) return p;
                      return [...p, {
                        id: newRow.id,
                        song: data,
                        version: vData || null,
                        setNumber: newRow.set_number,
                        position: newRow.position,
                        segueToNext: newRow.segue_to_next || false,
                        notes: newRow.notes || "",
                      }];
                    });
                  });
                }
              });
              return prev;
            }
            const version = newRow.notable_version_id ? versionsCache.current.get(newRow.notable_version_id) || null : null;
            return [...prev, {
              id: newRow.id,
              song,
              version,
              setNumber: newRow.set_number,
              position: newRow.position,
              segueToNext: newRow.segue_to_next || false,
              notes: newRow.notes || "",
            }];
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "setlist_slots",
          filter: `setlist_id=eq.${setlist.id}`,
        },
        (payload) => {
          const oldRow = payload.old as { id: string };
          setSlots((prev) => prev.filter((s) => s.id !== oldRow.id));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "setlist_slots",
          filter: `setlist_id=eq.${setlist.id}`,
        },
        (payload) => {
          const updated = payload.new as Database["public"]["Tables"]["setlist_slots"]["Row"];
          setSlots((prev) =>
            prev.map((s) =>
              s.id === updated.id
                ? { ...s, notes: updated.notes || "", segueToNext: updated.segue_to_next || false, position: updated.position, setNumber: updated.set_number }
                : s
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "collaborators",
          filter: `setlist_id=eq.${setlist.id}`,
        },
        () => {
          loadCollaborators(setlist.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [setlist?.id]);

  // Load setlist on mount if ID provided
  useEffect(() => {
    if (setlistId) {
      loadSetlist(setlistId);
    }
  }, [setlistId, loadSetlist]);

  return {
    setlist,
    slots,
    collaborators,
    saving,
    createSetlist,
    loadSetlist,
    addSlot,
    removeSlot,
    updateSlot,
    updateTitle,
    togglePublic,
    getShareLink,
    setSlots,
  };
};
