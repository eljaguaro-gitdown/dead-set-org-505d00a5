import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Music, ArrowLeft, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

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
  const { playSingle } = useAudioPlayer();
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
    if (autoPlayed || !song) return;
    setAutoPlayed(true);
    playSingle({
      id: `share-${song.id}-${version?.id ?? "base"}`,
      song: { id: song.id, title: song.title },
      version: version
        ? {
            ...version,
            song_id: version.song_id ?? song.id,
            show_date: version.show_date ?? "",
          } as any
        : null,
      setNumber: 1,
      position: 0,
      segueToNext: false,
    });
  }, [song, version, autoPlayed, playSingle]);

  return (
    <PageLayout>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to Dead-Set.Org
        </Link>

        {loading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : !song ? (
          <div className="text-muted-foreground">Song not found.</div>
        ) : (
          <article className="space-y-6">
            <div className="flex items-center gap-3 text-primary">
              <Music className="w-5 h-5" />
              <span className="text-xs uppercase tracking-[0.2em]">Now Spinning</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight">{song.title}</h1>
            {version && (
              <p className="text-lg text-muted-foreground">
                {version.show_date}
                {version.venue ? ` · ${version.venue}` : ""}
                {version.city ? `, ${version.city}` : ""}
              </p>
            )}
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
            <p className="text-sm text-muted-foreground">
              Open Dead-Set.Org to explore more versions, build setlists, and follow the band's history.
            </p>
          </article>
        )}
      </main>
    </PageLayout>
  );
};

export default SongPage;
