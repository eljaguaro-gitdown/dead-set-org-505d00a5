import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface FavoriteSongRow {
  id: string;
  song_id: string;
  created_at: string;
}

interface FavoriteSongSetlistLink {
  setlist_id: string;
}

export const useFavoriteSongs = () => {
  const { user } = useAuth();
  const [favoriteSongs, setFavoriteSongs] = useState<FavoriteSongRow[]>([]);
  const [favoriteSetlistId, setFavoriteSetlistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setFavoriteSongs([]);
      setFavoriteSetlistId(null);
      return;
    }

    const fetchFavorites = async () => {
      setLoading(true);
      const [{ data: favoriteData }, { data: linkData }] = await Promise.all([
        (supabase as any)
          .from("favorite_songs")
          .select("id, song_id, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("favorite_song_setlists")
          .select("setlist_id")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      setFavoriteSongs((favoriteData || []) as FavoriteSongRow[]);
      setFavoriteSetlistId((linkData as FavoriteSongSetlistLink | null)?.setlist_id || null);
      setLoading(false);
    };

    fetchFavorites();
  }, [user]);

  const favoriteSongIds = useMemo(
    () => new Set(favoriteSongs.map((song) => song.song_id)),
    [favoriteSongs]
  );

  const isFavoriteSong = useCallback(
    (songId: string) => favoriteSongIds.has(songId),
    [favoriteSongIds]
  );

  const toggleFavoriteSong = useCallback(
    async (songId: string) => {
      if (!user) return { ok: false, requiresAuth: true as const };

      const existing = favoriteSongs.find((song) => song.song_id === songId);

      if (existing) {
        setFavoriteSongs((prev) => prev.filter((song) => song.song_id !== songId));

        const { error } = await supabase
          as any
          .from("favorite_songs")
          .delete()
          .eq("id", existing.id);

        if (error) {
          setFavoriteSongs((prev) => [existing, ...prev]);
          return { ok: false, requiresAuth: false as const };
        }

        const { data: linkData } = await (supabase as any)
          .from("favorite_song_setlists")
          .select("setlist_id")
          .eq("user_id", user.id)
          .maybeSingle();

        setFavoriteSetlistId((linkData as FavoriteSongSetlistLink | null)?.setlist_id || null);
        return { ok: true, requiresAuth: false as const, favorited: false as const };
      }

      const optimistic: FavoriteSongRow = {
        id: `optimistic-${songId}`,
        song_id: songId,
        created_at: new Date().toISOString(),
      };

      setFavoriteSongs((prev) => [optimistic, ...prev.filter((song) => song.song_id !== songId)]);

      const { data, error } = await (supabase as any)
          .from("favorite_songs")
        .insert({ user_id: user.id, song_id: songId })
        .select("id, song_id, created_at")
        .single();

      if (error) {
        setFavoriteSongs((prev) => prev.filter((song) => song.song_id !== songId));
        return { ok: false, requiresAuth: false as const };
      }

      setFavoriteSongs((prev) => [data as FavoriteSongRow, ...prev.filter((song) => song.song_id !== songId)]);
      const { data: linkData } = await (supabase as any)
        .from("favorite_song_setlists")
        .select("setlist_id")
        .eq("user_id", user.id)
        .maybeSingle();

      setFavoriteSetlistId((linkData as FavoriteSongSetlistLink | null)?.setlist_id || null);
      return { ok: true, requiresAuth: false as const, favorited: true as const };
    },
    [user, favoriteSongs]
  );

  return {
    favoriteSongs,
    favoriteSongIds,
    favoriteSetlistId,
    isFavoriteSong,
    toggleFavoriteSong,
    loading,
    isAuthenticated: !!user,
  };
};