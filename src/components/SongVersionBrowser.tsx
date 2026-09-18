import { useState, useEffect, useMemo, useRef } from "react";
import { Zap, ExternalLink, Headphones, Star, Loader2, ArrowUpDown, Calendar, TrendingUp, Heart, Share2 } from "lucide-react";
import { shareSong } from "@/lib/shareSong";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { findManyArchiveRecordings, type ArchiveVersion } from "@/lib/archiveOrg";
import {
  ALL_PLAYING_YEARS,
  ALL_YEARS,
  encodeYearWindow,
  eraToYearWindow,
  formatYearWindow,
  parseYearWindow,
  sameYearWindow,
  widenYearWindow,
  type YearWindow,
} from "@/lib/yearWindow";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];
type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];
type Era = Database["public"]["Tables"]["eras"]["Row"];

/** How many in-window versions we ask Charlie to write notes for. */
const NOTE_COUNT = 10;

/** Stable empty map, so a window with no notes yet doesn't churn renders. */
const NO_NOTES: Record<string, string> = {};

interface SongVersionBrowserProps {
  song: Song;
  curatedVersions: NotableVersion[];
  /** Era rows, used to offer named eras alongside single years in the dig-deep control. */
  eras?: Era[];
  /** The era selected in the builder toolbar, if any — seeds the year window. */
  eraId?: string | null;
  onSelectSong: (song: Song, version?: NotableVersion) => void;
  onPlayArchive?: (url: string, songTitle: string, showDate: string, venue?: string | null) => void;
  isFavoriteVersion?: (input: {
    songId: string;
    notableVersionId?: string | null;
    versionShowDate?: string | null;
    versionVenue?: string | null;
    versionArchiveOrgUrl?: string | null;
    versionRating?: number | null;
  }) => boolean;
  onToggleFavoriteVersion?: (input: {
    songId: string;
    notableVersionId?: string | null;
    versionShowDate?: string | null;
    versionVenue?: string | null;
    versionArchiveOrgUrl?: string | null;
    versionRating?: number | null;
  }) => void | Promise<void>;
}

type SortMode = "rating" | "date-asc" | "date-desc";

const SongVersionBrowser = ({ song, curatedVersions, eras, eraId, onSelectSong, onPlayArchive, isFavoriteVersion, onToggleFavoriteVersion }: SongVersionBrowserProps) => {
  const { user } = useAuth();
  const [archiveVersions, setArchiveVersions] = useState<ArchiveVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("rating");
  const [notesByWindow, setNotesByWindow] = useState<Record<string, Record<string, string>>>({});
  const [loadingDescriptions, setLoadingDescriptions] = useState(false);
  /** Which window the loaded recordings belong to — "" until the first load. */
  const [loadedWindowKey, setLoadedWindowKey] = useState("");

  // Seed the window from whatever era the builder toolbar already has selected,
  // so expanding a song inside "Europe '72" digs into those years by default.
  const seededWindow = useMemo(() => {
    const era = eras?.find((e) => e.id === eraId);
    return era ? eraToYearWindow(era) : null;
  }, [eras, eraId]);

  const [yearWindow, setYearWindow] = useState<YearWindow | null>(seededWindow);

  /**
   * Charlie now weighs each night against the rest of the window, so a note is
   * only true of the window it was written for: the standout of 1974-76 is not
   * the same claim as the standout of every year. Notes are therefore kept per
   * window rather than per identifier.
   */
  const windowKey = yearWindow ? encodeYearWindow(yearWindow) : ALL_YEARS;
  const descriptions = notesByWindow[windowKey] ?? NO_NOTES;

  /** Named eras that map cleanly onto a year span, for the dig-deep control. */
  const eraWindows = useMemo(
    () =>
      (eras ?? [])
        .map((e) => ({ id: e.id, name: e.name, window: eraToYearWindow(e) }))
        .filter((e): e is { id: string; name: string; window: YearWindow } => e.window !== null),
    [eras],
  );

  // Follow the toolbar when the user changes era while a song is open. Compared
  // by value, not identity: eraToYearWindow builds a fresh object each time, so
  // an identity check would stomp the user's own window on any re-render.
  const lastSeeded = useRef(seededWindow);
  useEffect(() => {
    if (!sameYearWindow(lastSeeded.current, seededWindow)) {
      lastSeeded.current = seededWindow;
      setYearWindow(seededWindow);
    }
  }, [seededWindow]);

  // Narrow at the query so a tight window still returns the best of *that* span,
  // not whatever survives from a global top-50.
  const windowStart = yearWindow?.start;
  const windowEnd = yearWindow?.end;
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Same shape as encodeYearWindow, built from the primitives the dependency
    // array already tracks so the effect doesn't hang off the window object.
    const key = windowStart && windowEnd ? `${windowStart}-${windowEnd}` : ALL_YEARS;
    findManyArchiveRecordings(song.title, 50, windowStart, windowEnd).then((results) => {
      if (!cancelled) {
        setArchiveVersions(results);
        setLoadedWindowKey(key);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [song.id, song.title, windowStart, windowEnd]);

  // Merge: curated versions first (highlighted), then archive versions (deduped by date)
  const curatedDateKey = curatedVersions.map((v) => v.show_date).join("|");
  const curatedDates = useMemo(
    () => new Set(curatedVersions.map((v) => v.show_date)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [curatedDateKey],
  );

  /** In-window archive versions, minus anything already shown as a curated pick. */
  const windowVersions = useMemo(
    () => archiveVersions.filter((av) => !curatedDates.has(av.date || "")),
    [archiveVersions, curatedDates],
  );

  const sortedVersions = useMemo(() => {
    return [...windowVersions].sort((a, b) => {
      if (sortMode === "rating") return (b.avgRating || 0) - (a.avgRating || 0);
      if (sortMode === "date-asc") return (a.date || "").localeCompare(b.date || "");
      return (b.date || "").localeCompare(a.date || "");
    });
  }, [windowVersions, sortMode]);

  /**
   * The versions Charlie writes notes for: the best of what's *in the window*.
   * Derived from the unsorted in-window set so flipping the sort buttons never
   * re-asks for notes, and so a narrow window still gets described — the old
   * code sliced the global top 10, which could contain nothing in range at all.
   */
  const noteTargets = useMemo(
    () =>
      [...windowVersions]
        .sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0))
        .slice(0, NOTE_COUNT),
    [windowVersions],
  );

  /**
   * What the start select displays. Once the end is widened the window no
   * longer matches any single option, so fall back to the start year — without
   * this the trigger renders blank for every range that isn't exactly an era.
   */
  const startSelectValue = useMemo(() => {
    if (!yearWindow) return ALL_YEARS;
    const era = eraWindows.find((e) => sameYearWindow(e.window, yearWindow));
    if (era) return encodeYearWindow(era.window);
    return `${yearWindow.start}-${yearWindow.start}`;
  }, [yearWindow, eraWindows]);

  const noteTargetKey = noteTargets.map((v) => v.identifier).join(",");

  /** How many of the in-window picks already carry a note. */
  const describedCount = useMemo(
    () => noteTargets.filter((v) => descriptions[v.identifier]).length,
    [noteTargets, descriptions],
  );

  /** The era's own name, when the window lines up with one — Charlie can use it. */
  const eraName = useMemo(() => {
    if (!yearWindow) return null;
    return eraWindows.find((e) => sameYearWindow(e.window, yearWindow))?.name ?? null;
  }, [eraWindows, yearWindow]);

  useEffect(() => {
    if (loading || noteTargets.length === 0) return;
    // Between choosing a window and its recordings arriving, `loading` has not
    // flipped yet — without this the notes would be written about the window
    // the visitor just left.
    if (loadedWindowKey !== windowKey) return;
    // Charlie's notes come from an authenticated endpoint; for signed-out
    // visitors we show the invitation below instead of firing a doomed request.
    if (!user) return;

    // Only ask about versions we haven't already got a note for — windows
    // overlap, and the notes are keyed by identifier.
    const pending = noteTargets.filter((v) => !descriptions[v.identifier]);
    if (pending.length === 0) return;

    let cancelled = false;
    setLoadingDescriptions(true);

    supabase.functions.invoke("describe-versions", {
      body: {
        songTitle: song.title,
        versions: pending.map((v) => ({
          identifier: v.identifier,
          date: v.date,
          venue: v.venue,
          rating: v.avgRating,
        })),
        // Lets Charlie weigh each night against the rest of the window rather
        // than against the song's whole history.
        yearRange: yearWindow ? { ...yearWindow, eraName } : null,
      },
    }).then(({ data, error }) => {
      if (!cancelled && data?.descriptions) {
        setNotesByWindow((prev) => ({
          ...prev,
          [windowKey]: { ...prev[windowKey], ...data.descriptions },
        }));
      }
      // Never surface the raw error to the room — it is written for us, not fans.
      if (error) console.warn("Failed to fetch version notes:", error);
      if (!cancelled) setLoadingDescriptions(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteTargetKey, loading, song.title, user, windowKey, loadedWindowKey, eraName]);

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

  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // On expand, scroll into view so users see results immediately on mobile.
    requestAnimationFrame(() => {
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className="p-3 ml-2 border-l-2 border-primary/30 space-y-2 md:max-h-[400px] md:overflow-y-auto"
    >
      <button
        onClick={() => onSelectSong(song)}
        className="w-full text-left p-2 rounded bg-muted/50 hover:bg-muted text-sm font-body text-card-foreground transition-colors"
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
              isFavorite={isFavoriteVersion?.({ songId: song.id, notableVersionId: v.id }) || false}
              onToggleFavorite={() => onToggleFavoriteVersion?.({ songId: song.id, notableVersionId: v.id })}
            />
          ))}
        </div>
      )}

      {/* Dig deep — narrow the hunt to a year or a span of years.
          The first control picks the start (or a whole era in one tap); the
          second widens it into a range, so "1974" and "1974–76" both fall out
          of the same pair without a third mode. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[10px] uppercase tracking-wider text-foreground/75 font-body shrink-0">
          Dig deep
        </span>
        <Select value={startSelectValue} onValueChange={(v) => setYearWindow(parseYearWindow(v))}>
          <SelectTrigger
            className={`h-8 w-auto min-w-[96px] max-w-[170px] bg-card border-border font-body text-xs ${
              yearWindow ? "text-primary border-primary/50" : "text-card-foreground"
            }`}
            aria-label={`Narrow ${song.title} versions to a year, era, or the start of a range`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border max-h-[280px]">
            <SelectItem value={ALL_YEARS} className="font-body text-xs">
              All years
            </SelectItem>
            {eraWindows.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[10px] uppercase tracking-wider text-foreground/75 font-body">
                  Eras
                </SelectLabel>
                {eraWindows.map(({ id, name, window }) => (
                  <SelectItem key={id} value={encodeYearWindow(window)} className="font-body text-xs">
                    {name} ({formatYearWindow(window)})
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            <SelectGroup>
              <SelectLabel className="text-[10px] uppercase tracking-wider text-foreground/75 font-body">
                Years
              </SelectLabel>
              {ALL_PLAYING_YEARS.map((year) => (
                <SelectItem key={year} value={`${year}-${year}`} className="font-body text-xs">
                  {year}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {yearWindow && (
          <>
            <span className="text-xs text-foreground/75 font-body" aria-hidden="true">
              {"–"}
            </span>
            <Select
              value={String(yearWindow.end)}
              onValueChange={(v) => {
                const end = Number(v);
                setYearWindow((w) => (w ? widenYearWindow(w, end) : w));
              }}
            >
              <SelectTrigger
                className="h-8 w-auto min-w-[74px] bg-card border-border border-primary/50 text-primary font-body text-xs"
                aria-label={`Last year to include for ${song.title}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border max-h-[280px]">
                {ALL_PLAYING_YEARS.filter((y) => y >= yearWindow.start).map((year) => (
                  <SelectItem key={year} value={String(year)} className="font-body text-xs">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {/* Archive.org versions */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 justify-center text-foreground/75">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-body">
            {yearWindow ? `Searching the ${formatYearWindow(yearWindow)} tapes…` : "Searching the tapes…"}
          </span>
        </div>
      ) : windowVersions.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-wider text-foreground/75 font-body">
              From the Archive · {windowVersions.length} circulating
              {yearWindow ? ` · ${formatYearWindow(yearWindow)}` : ""}
            </p>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setSortMode("rating")}
                className={`p-1 rounded transition-colors ${sortMode === "rating" ? "text-accent" : "text-foreground/75 hover:text-foreground"}`}
                title="Sort by rating"
              >
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSortMode("date-asc")}
                className={`p-1 rounded transition-colors ${sortMode === "date-asc" ? "text-accent" : "text-foreground/75 hover:text-foreground"}`}
                title="Oldest first"
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setSortMode("date-desc")}
                className={`p-1 rounded transition-colors ${sortMode === "date-desc" ? "text-accent" : "text-foreground/75 hover:text-foreground"}`}
                title="Newest first"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Charlie's notes: in flight, or an invitation for signed-out visitors.
              The notes endpoint is behind sign-in, so rather than letting them
              silently vanish we say who is missing from the conversation. */}
          {user && loadingDescriptions && describedCount === 0 && (
            <p className="text-[11px] font-body text-foreground/75 italic px-0.5">
              Cosmic Charlie is pulling these off the shelf…
            </p>
          )}
          {!user && (
            <p className="text-[11px] font-body text-foreground/75 italic px-0.5">
              Sign in and Cosmic Charlie will tell you what makes each of these worth the hunt.
            </p>
          )}

          {sortedVersions.map((av) => (
              <ArchiveVersionCard
                key={av.identifier}
                version={av}
                songTitle={song.title}
                description={descriptions[av.identifier]}
                onSelect={() => handleSelectArchiveVersion(av)}
                onPlayArchive={onPlayArchive}
                isFavorite={isFavoriteVersion?.({
                  songId: song.id,
                  versionShowDate: av.date || null,
                  versionVenue: av.venue || null,
                  versionArchiveOrgUrl: av.url,
                  versionRating: av.avgRating ? Math.min(5, Math.round(av.avgRating)) : null,
                }) || false}
                onToggleFavorite={() => onToggleFavoriteVersion?.({
                  songId: song.id,
                  versionShowDate: av.date || null,
                  versionVenue: av.venue || null,
                  versionArchiveOrgUrl: av.url,
                  versionRating: av.avgRating ? Math.min(5, Math.round(av.avgRating)) : null,
                })}
              />
            ))}
        </div>
      ) : yearWindow ? (
        <div className="px-2 py-3 space-y-2">
          <p className="text-xs text-foreground/75 font-body">
            Nothing from {formatYearWindow(yearWindow)} circulating for {song.title}. Widen the
            years and see what turns up.
          </p>
          <button
            onClick={() => setYearWindow(null)}
            className="text-xs font-body text-primary hover:underline"
          >
            Open it back up to all years
          </button>
        </div>
      ) : (
        <p className="text-xs text-foreground/75 font-body px-2">No recordings found on the Archive</p>
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
  isFavorite,
  onToggleFavorite,
}: {
  version: NotableVersion;
  songTitle: string;
  onSelect: () => void;
  onPlayArchive?: (url: string, songTitle: string, showDate: string, venue?: string | null) => void;
  isFavorite: boolean;
  onToggleFavorite?: () => void | Promise<void>;
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
          <button
            onClick={(e) => {
              e.stopPropagation();
              void onToggleFavorite?.();
            }}
            className="ml-1"
            title={isFavorite ? "Remove version from favorites" : "Add version to favorites"}
          >
            <Heart className={`w-3 h-3 transition-colors ${isFavorite ? "text-primary fill-primary" : "text-muted-foreground hover:text-primary"}`} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void shareSong({
                songTitle,
                showDate: v.show_date,
                venue: v.venue,
                archiveOrgUrl: v.archive_org_url,
              });
            }}
            className="ml-1"
            title={`Share ${songTitle}`}
          >
            <Share2 className="w-3 h-3 text-muted-foreground hover:text-primary transition-colors" />
          </button>
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
      <p className="text-xs text-foreground/75 font-body mt-0.5">{v.venue}{v.city ? `, ${v.city}` : ""}</p>
      {v.description && (
        <p className="text-xs text-foreground/60 font-body mt-0.5 italic">{v.description}</p>
      )}
    </button>
  );
}

function ArchiveVersionCard({
  version: av,
  songTitle,
  description,
  onSelect,
  onPlayArchive,
  isFavorite,
  onToggleFavorite,
}: {
  version: ArchiveVersion;
  songTitle: string;
  description?: string;
  onSelect: () => void;
  onPlayArchive?: (url: string, songTitle: string, showDate: string, venue?: string | null) => void;
  isFavorite: boolean;
  onToggleFavorite?: () => void | Promise<void>;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-2 rounded bg-card border border-border hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-body text-card-foreground">{av.date || "Unknown date"}</span>
        <div className="flex items-center gap-1">
          {av.avgRating != null && av.avgRating > 0 && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 border-accent/30 text-accent-foreground">
              ★ {av.avgRating.toFixed(1)}
            </Badge>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              void onToggleFavorite?.();
            }}
            className="ml-1"
            title={isFavorite ? "Remove version from favorites" : "Add version to favorites"}
          >
            <Heart className={`w-3 h-3 transition-colors ${isFavorite ? "text-primary fill-primary" : "text-muted-foreground hover:text-primary"}`} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              void shareSong({
                songTitle,
                showDate: av.date || null,
                venue: av.venue,
                archiveOrgUrl: av.url,
              });
            }}
            className="ml-1"
            title={`Share ${songTitle}`}
          >
            <Share2 className="w-3 h-3 text-muted-foreground hover:text-primary transition-colors" />
          </button>
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
      {description && (
        <p className="text-xs text-accent-foreground font-body mt-1 italic">"{description}"</p>
      )}
    </button>
  );
}

export default SongVersionBrowser;
