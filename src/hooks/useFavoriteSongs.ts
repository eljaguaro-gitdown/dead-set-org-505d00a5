import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface FavoriteSongRow {
  id: string;
  song_id: string;
  notable_version_id: string | null;
  version_show_date: string | null;
  version_venue: string | null;
  version_archive_org_url: string | null;
  version_rating: number | null;
  created_at: string;
}

interface FavoriteSongSetlistLink {
  setlist_id: string;
}

interface ToggleFavoriteSongInput {
  songId: string;
  notableVersionId?: string | null;
  versionShowDate?: string | null;
  versionVenue?: string | null;
  versionArchiveOrgUrl?: string | null;
  versionRating?: number | null;
}

const matchesFavorite = (favorite: FavoriteSongRow, input: ToggleFavoriteSongInput) => {
  const notableVersionId = input.notableVersionId ?? null;
  const versionShowDate = input.versionShowDate ?? null;
  const versionVenue = input.versionVenue ?? null;
  const versionArchiveOrgUrl = input.versionArchiveOrgUrl ?? null;

  return (
    favorite.song_id === input.songId &&
    (favorite.notable_version_id ?? null) === notableVersionId &&
    (favorite.version_show_date ?? null) === versionShowDate &&
    (favorite.version_venue ?? null) === versionVenue &&
    (favorite.version_archive_org_url ?? null) === versionArchiveOrgUrl
  );
};

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
          .select("id, song_id, notable_version_id, version_show_date, version_venue, version_archive_org_url, version_rating, created_at")
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
    (input: ToggleFavoriteSongInput) => {
      return favoriteSongs.some((favorite) => matchesFavorite(favorite, input));
    },
    [favoriteSongs]
  );

  const toggleFavoriteSong = useCallback(
    async ({
      songId,
      notableVersionId = null,
      versionShowDate = null,
      versionVenue = null,
      versionArchiveOrgUrl = null,
      versionRating = null,
    }: ToggleFavoriteSongInput) => {
      if (!user) return { ok: false, requiresAuth: true as const };

      const payload: ToggleFavoriteSongInput = {
        songId,
        notableVersionId,
        versionShowDate,
        versionVenue,
        versionArchiveOrgUrl,
        versionRating,
      };

      const existing = favoriteSongs.find((song) => matchesFavorite(song, payload));

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
        version_show_date: versionShowDate,
        version_venue: versionVenue,
        version_archive_org_url: versionArchiveOrgUrl,
        version_rating: versionRating,
        created_at: new Date().toISOString(),
      };

      setFavoriteSongs((prev) => [optimistic, ...prev.filter((song) => song.id !== optimistic.id)]);

      const { data, error } = await (supabase as any)
        .from("favorite_songs")
        .insert({
          user_id: user.id,
          song_id: songId,
          notable_version_id: notableVersionId,
          version_show_date: versionShowDate,
          version_venue: versionVenue,
          version_archive_org_url: versionArchiveOrgUrl,
          version_rating: versionRating,
        })
        .select("id, song_id, notable_version_id, version_show_date, version_venue, version_archive_org_url, version_rating, created_at")
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