import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface FavoriteSongRow {
  id: string;
  song_id: string;
  notable_version_id: string | null;
  created_at: string;
}

interface FavoriteSongSetlistLink {
  setlist_id: string;
}

interface ToggleFavoriteSongInput {
  songId: string;
  notableVersionId?: string | null;
}

export const useFavoriteSongs = () => {
  const { user } = useAuth();
  const [favoriteSongs, setFavoriteSongs] = useState<FavoriteSongRow[]>([]);
  const [favoriteSetlistId, setFavoriteSetlistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshFavoriteSetlistLink = useCallback(async (userId: string) => {
    const { data } = await (supabase as any)
      .from("favorite_song_setlists")
      .select("setlist_id")
      .eq("user_id", userId)
      .maybeSingle();

    setFavoriteSetlistId((data as FavoriteSongSetlistLink | null)?.setlist_id || null);
  }, []);

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
          .select("id, song_id, notable_version_id, created_at")
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

  const favoriteVersionIds = useMemo(
    () => new Set(favoriteSongs.map((song) => song.notable_version_id).filter(Boolean) as string[]),
    [favoriteSongs]
  );

  const isFavoriteSong = useCallback(
    (songId: string) => favoriteSongIds.has(songId),
    [favoriteSongIds]
  );

  const isFavoriteVersion = useCallback(
    (songId: string, notableVersionId?: string | null) => {
      if (!notableVersionId) return false;
      return favoriteSongs.some(
        (favorite) => favorite.song_id === songId && favorite.notable_version_id === notableVersionId
      );
    },
    [favoriteSongs]
  );

  const toggleFavoriteSong = useCallback(
    async ({ songId, notableVersionId = null }: ToggleFavoriteSongInput) => {
      if (!user) return { ok: false, requiresAuth: true as const };

      const existing = favoriteSongs.find(
        (song) => song.song_id === songId && (song.notable_version_id || null) === notableVersionId
      );

      if (existing) {
        setFavoriteSongs((prev) => prev.filter((song) => song.id !== existing.id));

        const { error } = await (supabase as any)
          .from("favorite_songs")
          .delete()
          .eq("id", existing.id);

        if (error) {
          setFavoriteSongs((prev) => [existing, ...prev.filter((song) => song.id !== existing.id)]);
          return { ok: false, requiresAuth: false as const };
        }

        await refreshFavoriteSetlistLink(user.id);
        return { ok: true, requiresAuth: false as const, favorited: false as const };
      }

      const optimistic: FavoriteSongRow = {
        id: `optimistic-${songId}-${notableVersionId || "base"}`,
        song_id: songId,
        notable_version_id: notableVersionId,
        created_at: new Date().toISOString(),
      };

      setFavoriteSongs((prev) => [optimistic, ...prev.filter((song) => song.id !== optimistic.id)]);

      const { data, error } = await (supabase as any)
        .from("favorite_songs")
        .insert({ user_id: user.id, song_id: songId, notable_version_id: notableVersionId })
        .select("id, song_id, notable_version_id, created_at")
        .single();

      if (error) {
        setFavoriteSongs((prev) => prev.filter((song) => song.id !== optimistic.id));
        return { ok: false, requiresAuth: false as const };
      }

      setFavoriteSongs((prev) => [data as FavoriteSongRow, ...prev.filter((song) => song.id !== optimistic.id)]);
      await refreshFavoriteSetlistLink(user.id);
      return { ok: true, requiresAuth: false as const, favorited: true as const };
    },
    [user, favoriteSongs, refreshFavoriteSetlistLink]
  );

  return {
    favoriteSongs,
    favoriteSongIds,
    favoriteVersionIds,
    favoriteSetlistId,
    isFavoriteSong,
    isFavoriteVersion,
    toggleFavoriteSong,
    loading,
    isAuthenticated: !!user,
  };
};