import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useFavorites = () => {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }

    const fetchFavorites = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("favorites")
        .select("setlist_id")
        .eq("user_id", user.id);

      if (data) {
        setFavoriteIds(new Set(data.map((f) => f.setlist_id)));
      }
      setLoading(false);
    };

    fetchFavorites();
  }, [user]);

  const toggleFavorite = useCallback(
    async (setlistId: string) => {
      if (!user) return false;

      const isFav = favoriteIds.has(setlistId);

      // Optimistic update
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.delete(setlistId);
        else next.add(setlistId);
        return next;
      });

      if (isFav) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("setlist_id", setlistId);

        if (error) {
          // Revert
          setFavoriteIds((prev) => new Set(prev).add(setlistId));
          return false;
        }
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: user.id, setlist_id: setlistId });

        if (error) {
          // Revert
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(setlistId);
            return next;
          });
          return false;
        }
      }
      return true;
    },
    [user, favoriteIds]
  );

  const isFavorite = useCallback(
    (setlistId: string) => favoriteIds.has(setlistId),
    [favoriteIds]
  );

  return { favoriteIds, isFavorite, toggleFavorite, loading, isAuthenticated: !!user };
};
