import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Music, ArrowLeft, Play, Share2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useFavoriteSongs } from "@/hooks/useFavoriteSongs";
import { useAuth } from "@/hooks/useAuth";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import FavoriteButton from "@/components/FavoriteButton";
import { shareSong } from "@/lib/shareSong";
import SongEraLadder, { type LadderVersion } from "@/components/SongEraLadder";
import { toast } from "sonner";

interface SongRow {
  id: string;
  title: string;
}
interface VersionRow {
  id: string;
  song_id: string;
  show_date: string | null;
  venue: string | null;
  city: string | null;
  archive_org_url: string | null;
  era_id: string | null;
  rating: number | null;
}

const SongPage = () => {
  const { songId } = useParams<{ songId: string }>();
  const [searchParams] = useSearchParams();
  const versionId = searchParams.get("v");
  const fallbackDate = searchParams.get("d");
  const fallbackVenue = searchParams.get("venue");
  const fromName = searchParams.get("from");
  const { playSingle } = useAudioPlayer();
  const { user } = useAuth();
  const { isFavoriteVersion, toggleFavoriteSong } = useFavoriteSongs();
  const [song, setSong] = useState<SongRow | null>(null);
  const [version, setVersion] = useState<VersionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoPlayed, setAutoPlayed] = useState(false);

  useEffect(() => {
    if (!songId) return;
    let cancelled = false;
    (async () => {
      const songP = supabase.from("songs").select("id, title").eq("id", songId).maybeSingle();
      const versionP = versionId
        ? supabase
            .from("notable_versions")
            .select("id, song_id, show_date, venue, city, archive_org_url, era_id, rating")
            .eq("id", versionId)
            .maybeSingle()
        : Promise.resolve({ data: null });
      const [{ data: s }, { data: v }] = await Promise.all([songP, versionP]);
      if (cancelled) return;
      setSong(s as SongRow | null);
      setVersion(v as VersionRow | null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [songId, versionId]);

  useEffect(() => {
    if (autoPlayed || !song || !versionId) return;
    setAutoPlayed(true);
    playSingle({
      id: `share-${song.id}-${version?.id ?? "base"}`,
      song: { id: song.id, title: song.title },
      version: version
        ? ({
            ...version,
            song_id: version.song_id ?? song.id,
            show_date: version.show_date ?? "",
          } as any)
        : null,
      setNumber: 1,
      position: 0,
      segueToNext: false,
    });
  }, [song, version, autoPlayed, playSingle]);

  const displayDate = version?.show_date ?? fallbackDate;
  const displayVenue = version?.venue ?? fallbackVenue;

  const favorited = song
    ? isFavoriteVersion({
        songId: song.id,
        notableVersionId: version?.id ?? null,
        versionShowDate: displayDate ?? null,
        versionVenue: displayVenue ?? null,
        versionArchiveOrgUrl: version?.archive_org_url ?? null,
      })
    : false;

  const handleFavorite = async () => {
    if (!song) return;
    if (!user) {
      toast.info("Sign in to save this to your favorites");
      window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    const res = await toggleFavoriteSong({
      songId: song.id,
      notableVersionId: version?.id ?? null,
      versionShowDate: displayDate ?? null,
      versionVenue: displayVenue ?? null,
      versionArchiveOrgUrl: version?.archive_org_url ?? null,
      versionRating: version?.rating ?? null,
    });
    if (res.ok) {
      toast.success(res.favorited ? "Saved to favorites 🌹" : "Removed from favorites");
    }
  };

  const handleLadderPlay = (v: LadderVersion) => {
    if (!song) return;
    playSingle({
      id: `ladder-${song.id}-${v.id}`,
      song: { id: song.id, title: song.title },
      version: {
        id: v.id,
        song_id: song.id,
        show_date: v.show_date ?? "",
        venue: v.venue,
        city: v.city,
        archive_org_url: v.archive_org_url,
        era_id: v.era_id,
        rating: null,
        description: null,
      } as never,
      setNumber: 1,
      position: 0,
      segueToNext: false,
    });
  };

  const handleShare = () => {
    if (!song) return;
    void shareSong({
      songId: song.id,
      notableVersionId: version?.id ?? null,
      songTitle: song.title,
      showDate: displayDate,
      venue: displayVenue,
      archiveOrgUrl: version?.archive_org_url ?? null,
    });
  };

  return (
    <PageLayout>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 md:px-6 py-8 md:py-10">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-foreground/75 hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dead-Set.Org
        </Link>

        {loading ? (
          <div className="text-foreground/75">Loading…</div>
        ) : !song ? (
          <div className="text-foreground/75">Song not found.</div>
        ) : (
          <article className="space-y-6">
            {fromName && (
              <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <span>
                  <span className="font-semibold text-dead-gold">{fromName}</span>
                  <span className="text-foreground/80"> sent you this song 🌹</span>
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 text-dead-gold">
              <Music className="w-5 h-5" />
              <span className="text-xs uppercase tracking-[0.2em]">Now Spinning</span>
            </div>

            <h1 className="text-4xl md:text-6xl font-semibold leading-[1.05]">{song.title}</h1>

            {(displayDate || displayVenue) && (
              <div className="space-y-1">
                {displayDate && (
                  <p className="text-2xl md:text-3xl font-medium text-foreground">
                    {displayDate}
                  </p>
                )}
                {displayVenue && (
                  <p className="text-lg text-foreground/75">
                    {displayVenue}
                    {version?.city ? `, ${version.city}` : ""}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                size="lg"
                onClick={() =>
                  playSingle({
                    id: `share-${song.id}-${version?.id ?? "base"}`,
                    song: { id: song.id, title: song.title },
                    version: version as any,
                    setNumber: 1,
                    position: 0,
                    segueToNext: false,
                  })
                }
                className="gap-2"
              >
                <Play className="w-4 h-4" /> Play this version
              </Button>

              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium hover:border-primary/50 hover:text-primary transition-colors"
              >
                <Share2 className="w-4 h-4" /> Share
              </button>

              <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-card-foreground">
                <FavoriteButton
                  isFavorite={favorited}
                  onToggle={handleFavorite}
                  size="md"
                />
                <span className="text-sm font-medium pr-1">
                  {favorited ? "Saved" : "Save"}
                </span>
              </div>
            </div>

            <div className="pt-8 mt-2 border-t-2 border-dashed border-primary/30">
              <SongEraLadder
                songId={song.id}
                songTitle={song.title}
                activeVersionId={version?.id ?? null}
                onPlay={handleLadderPlay}
              />
            </div>
          </article>
        )}
      </main>
    </PageLayout>
  );
};

export default SongPage;
