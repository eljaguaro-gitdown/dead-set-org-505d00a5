import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];
type Era = Database["public"]["Tables"]["eras"]["Row"];
type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];

export const useSongs = (eraId?: string | null) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [eras, setEras] = useState<Era[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEras = async () => {
      const { data } = await supabase.from("eras").select("*").order("year_start");
      if (data) setEras(data);
    };
    fetchEras();
  }, []);

  useEffect(() => {
    const fetchSongs = async () => {
      setLoading(true);
      const { data } = await supabase.from("songs").select("*").order("title");
      if (data) setSongs(data);
      setLoading(false);
    };
    fetchSongs();
  }, []);

  const getNotableVersions = async (songId: string, filterEraId?: string | null) => {
    let query = supabase.from("notable_versions").select("*").eq("song_id", songId);
    if (filterEraId) query = query.eq("era_id", filterEraId);
    const { data } = await query.order("rating", { ascending: false });
    return data as NotableVersion[] | null;
  };

  return { songs, eras, loading, getNotableVersions };
};
