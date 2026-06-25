import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Zap, ChevronDown, ChevronUp, Heart, Share2, Plus } from "lucide-react";
import { shareSong } from "@/lib/shareSong";
import { Input } from "@/components/ui/input";
import SongVersionBrowser from "@/components/SongVersionBrowser";
import { toast } from "sonner";
import { useFavoriteSongs } from "@/hooks/useFavoriteSongs";
import { matchesSongQuery } from "@/lib/songSearch";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];
type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];

const TAG_COLORS: Record<string, string> = {
  rocker: "bg-primary/20 text-primary border-primary/30",
  jam: "bg-secondary/20 text-secondary border-secondary/30",
  ballad: "bg-accent/20 text-accent border-accent/30",
  country: "bg-accent/20 text-accent border-accent/30",
  space: "bg-secondary/20 text-secondary border-secondary/30",
  drum: "bg-muted text-muted-foreground border-border",
  blues: "bg-secondary/20 text-secondary border-secondary/30",
};

interface SongVaultProps {
  songs: Song[];
  eraId?: string | null;
  onSelectSong: (song: Song, version?: NotableVersion) => void;
  getNotableVersions: (songId: string, eraId?: string | null) => Promise<NotableVersion[] | null>;
  onPlayArchive?: (url: string, songTitle: string, showDate: string, venue?: string | null) => void;
}

const SongVault = ({ songs, eraId, onSelectSong, getNotableVersions, onPlayArchive }: SongVaultProps) => {
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<string | null>(null);
  const [expandedSong, setExpandedSong] = useState<string | null>(null);
  const [curatedVersions, setCuratedVersions] = useState<NotableVersion[]>([]);
  const { isFavoriteSong, isFavoriteVersion, toggleFavoriteSong } = useFavoriteSongs();

  const filteredSongs = useMemo(() => {
    return songs.filter((s) => {
      const matchesSearch = matchesSongQuery(s.title, search);
      const matchesTag = !tagFilter || (s.tags && s.tags.includes(tagFilter));
      const matchesPosition = !positionFilter || s.typical_set_position === positionFilter;
      return matchesSearch && matchesTag && matchesPosition;
    });
  }, [songs, search, tagFilter, positionFilter]);

  const handleExpand = async (songId: string) => {
    if (expandedSong === songId) {
      setExpandedSong(null);
      return;
    }
    setExpandedSong(songId);
    const data = await getNotableVersions(songId, eraId);
    setCuratedVersions(data || []);
  };

  const tags = ["rocker", "jam", "ballad", "country", "space", "blues"];
  const positions = ["opener", "early", "mid", "late", "closer", "encore"];

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border space-y-3">
        <h2 className="font-display text-lg text-card-foreground">The Vault</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search songs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border text-card-foreground font-body"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className={`px-2 py-0.5 text-xs rounded-full border font-body transition-colors ${
                tagFilter === tag
                  ? TAG_COLORS[tag]
                  : "border-border text-muted-foreground hover:text-card-foreground"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {positions.map((pos) => (
            <button
              key={pos}
              onClick={() => setPositionFilter(positionFilter === pos ? null : pos)}
              className={`px-2 py-0.5 text-xs rounded-full border font-body transition-colors ${
                positionFilter === pos
                  ? "bg-muted text-card-foreground border-card-foreground/30"
                  : "border-border text-muted-foreground hover:text-card-foreground"
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1 pb-20 md:pb-2">
        {filteredSongs.map((song) => (
          <div key={song.id}>
            <motion.div
              className="p-3 rounded-lg bg-card border border-border hover:border-primary/30 cursor-pointer transition-colors group active:scale-[0.97] md:active:scale-100"
              onClick={() => {
                if (window.innerWidth < 768 && expandedSong !== song.id) {
                  handleExpand(song.id);
                } else {
                  handleExpand(song.id);
                }
              }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {song.is_jam_vehicle && <Zap className="w-3.5 h-3.5 text-accent shrink-0" />}
                  <span className="font-mono text-sm text-card-foreground truncate">{song.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSong(song);
                    }}
                    className="flex items-center gap-1 rounded-md bg-primary/15 text-primary border border-primary/30 px-2.5 min-h-[36px] hover:bg-primary/25 active:scale-95 transition-all"
                    title={`Add ${song.title} to your set`}
                    aria-label={`Add ${song.title} to your set`}
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-xs font-body">Add</span>
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const result = await toggleFavoriteSong({ songId: song.id });
                      if (result.requiresAuth) {
                        toast.error("Sign in to save favorite songs");
                        return;
                      }
                      if (!result.ok) {
                        toast.error("Could not update favorite songs");
                        return;
                      }
                      toast.success(result.favorited ? `${song.title} added to favorite songs` : `${song.title} removed from favorite songs`);
                    }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-colors"
                    title={isFavoriteSong(song.id) ? "Remove from favorite songs" : "Add to favorite songs"}
                  >
                    <Heart className={`w-4 h-4 ${isFavoriteSong(song.id) ? "fill-primary text-primary" : ""}`} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void shareSong({ songId: song.id, songTitle: song.title });
                    }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-colors"
                    title={`Share ${song.title}`}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-muted-foreground font-body">{song.times_played}x</span>
                  {expandedSong === song.id ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="flex gap-1 mt-1.5">
                {song.tags?.map((tag) => (
                  <span key={tag} className={`px-1.5 py-0.5 text-[10px] rounded-full border ${TAG_COLORS[tag] || "border-border text-muted-foreground"}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </motion.div>

            <AnimatePresence>
              {expandedSong === song.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <SongVersionBrowser
                    song={song}
                    curatedVersions={curatedVersions}
                    onSelectSong={onSelectSong}
                    onPlayArchive={onPlayArchive}
                    isFavoriteVersion={isFavoriteVersion}
                    onToggleFavoriteVersion={async (version) => {
                      const result = await toggleFavoriteSong(version);
                      if (result.requiresAuth) {
                        toast.error("Sign in to save favorite versions");
                        return;
                      }
                      if (!result.ok) {
                        toast.error("Could not update favorite versions");
                        return;
                      }
                      toast.success(result.favorited ? `${song.title} version added to favorites` : `${song.title} version removed from favorites`);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SongVault;
