import { useState, useEffect, useMemo } from "react";
import { Zap, ExternalLink, Headphones, Star, Loader2, ArrowUpDown, Calendar, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { findManyArchiveRecordings, type ArchiveVersion } from "@/lib/archiveOrg";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];
type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];

interface SongVersionBrowserProps {
  song: Song;
  curatedVersions: NotableVersion[];
  onSelectSong: (song: Song, version?: NotableVersion) => void;
  onPlayArchive?: (url: string, songTitle: string, showDate: string, venue?: string | null) => void;
}

type SortMode = "rating" | "date-asc" | "date-desc";

const SongVersionBrowser = ({ song, curatedVersions, onSelectSong, onPlayArchive }: SongVersionBrowserProps) => {
  const [archiveVersions, setArchiveVersions] = useState<ArchiveVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("rating");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    findManyArchiveRecordings(song.title, 50).then((results) => {
      if (!cancelled) {
        setArchiveVersions(results);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [song.id, song.title]);

  // Merge: curated versions first (highlighted), then archive versions (deduped by date)
  const curatedDates = new Set(curatedVersions.map((v) => v.show_date));

  const sortedVersions = useMemo(() => {
    const filtered = archiveVersions.filter((av) => !curatedDates.has(av.date || ""));
    return [...filtered].sort((a, b) => {
      if (sortMode === "rating") return (b.avgRating || 0) - (a.avgRating || 0);
      if (sortMode === "date-asc") return (a.date || "").localeCompare(b.date || "");
      return (b.date || "").localeCompare(a.date || "");
    });
  }, [archiveVersions, curatedDates, sortMode]);

  const handleSelectArchiveVersion = (av: ArchiveVersion) => {
    // Create a synthetic NotableVersion so the builder can use it
    const syntheticVersion: NotableVersion = {
      id: `archive-${av.identifier}`,
      song_id: song.id,
      show_date: av.date || "",
      archive_org_url: av.url,
      venue: av.venue,
      city: null,
      era_id: null,
      rating: av.avgRating ? Math.min(5, Math.round(av.avgRating)) : null,
      description: null,
    };
    onSelectSong(song, syntheticVersion);
  };

  return (
    <div className="p-3 ml-2 border-l-2 border-primary/30 space-y-2 max-h-[400px] overflow-y-auto">
      <button
        onClick={() => onSelectSong(song)}
        className="w-full text-left p-2 rounded bg-muted/50 hover:bg-muted text-sm font-body text-foreground transition-colors"
      >
        + Add song (no specific version)
      </button>

      {/* Curated picks from the database */}
      {curatedVersions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-accent font-body flex items-center gap-1">
            <Star className="w-3 h-3" /> Curated Picks
          </p>
          {curatedVersions.map((v) => (
            <CuratedVersionCard
              key={v.id}
              version={v}
              songTitle={song.title}
              onSelect={() => onSelectSong(song, v)}
              onPlayArchive={onPlayArchive}
            />
          ))}
        </div>
      )}

      {/* Archive.org versions */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-body">Searching the tapes…</span>
        </div>
      ) : archiveVersions.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">
              From the Archive · {archiveVersions.filter((av) => !curatedDates.has(av.date || "")).length} recordings
            </p>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setSortMode("rating")}
                className={`p-1 rounded transition-colors ${sortMode === "rating" ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}
                title="Sort by rating"
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSortMode("date-asc")}
                className={`p-1 rounded transition-colors ${sortMode === "date-asc" ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}
                title="Oldest first"
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSortMode("date-desc")}
                className={`p-1 rounded transition-colors ${sortMode === "date-desc" ? "text-accent" : "text-muted-foreground hover:text-foreground"}`}
                title="Newest first"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {sortedVersions.map((av) => (
              <ArchiveVersionCard
                key={av.identifier}
                version={av}
                songTitle={song.title}
                onSelect={() => handleSelectArchiveVersion(av)}
                onPlayArchive={onPlayArchive}
              />
            ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground font-body px-2">No recordings found on the Archive</p>
      )}
    </div>
  );
};

/* --- Sub-components --- */

function CuratedVersionCard({
  version: v,
  songTitle,
  onSelect,
  onPlayArchive,
}: {
  version: NotableVersion;
  songTitle: string;
  onSelect: () => void;
  onPlayArchive?: (url: string, songTitle: string, showDate: string, venue?: string | null) => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-2 rounded bg-accent/10 border border-accent/30 hover:border-accent/60 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-body text-foreground">{v.show_date}</span>
        <div className="flex items-center gap-1">
          {Array.from({ length: v.rating || 0 }).map((_, i) => (
            <Zap key={i} className="w-3 h-3 text-accent fill-accent" />
          ))}
          {v.archive_org_url && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlayArchive?.(v.archive_org_url!, songTitle, v.show_date, v.venue);
                }}
                className="ml-1"
                title="Preview audio"
              >
                <Headphones className="w-3 h-3 text-accent hover:text-primary transition-colors" />
              </button>
              <a
                href={v.archive_org_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="ml-1"
              >
                <ExternalLink className="w-3 h-3 text-secondary" />
              </a>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground font-body mt-0.5">{v.venue}{v.city ? `, ${v.city}` : ""}</p>
      {v.description && (
        <p className="text-xs text-muted-foreground/70 font-body mt-0.5 italic">{v.description}</p>
      )}
    </button>
  );
}

function ArchiveVersionCard({
  version: av,
  songTitle,
  onSelect,
  onPlayArchive,
}: {
  version: ArchiveVersion;
  songTitle: string;
  onSelect: () => void;
  onPlayArchive?: (url: string, songTitle: string, showDate: string, venue?: string | null) => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-2 rounded bg-card border border-border hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-body text-foreground">{av.date || "Unknown date"}</span>
        <div className="flex items-center gap-1">
          {av.avgRating != null && av.avgRating > 0 && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 border-accent/30 text-accent">
              ★ {av.avgRating.toFixed(1)}
            </Badge>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlayArchive?.(av.url, songTitle, av.date || "", av.venue);
            }}
            className="ml-1"
            title="Preview audio"
          >
            <Headphones className="w-3 h-3 text-accent hover:text-primary transition-colors" />
          </button>
          <a
            href={av.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-1"
          >
            <ExternalLink className="w-3 h-3 text-secondary" />
          </a>
        </div>
      </div>
      {av.venue && (
        <p className="text-xs text-muted-foreground font-body mt-0.5">{av.venue}</p>
      )}
    </button>
  );
}

export default SongVersionBrowser;
