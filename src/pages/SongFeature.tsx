import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { songbookDb } from "@/lib/songbookDb";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
import ShareDropdown from "@/components/ShareDropdown";
import SongEraLadder, { type LadderVersion } from "@/components/SongEraLadder";

/**
 * One issue of The Songbook — the long-form discussion of a single song,
 * with its era ladder underneath. This is the "more complete, robust"
 * destination that the cut-down surfaces (email, socials, in-app) point at.
 */

interface FeatureRow {
  id: string;
  song_id: string | null;
  slug: string;
  title: string;
  week_of: string;
  issue_number: number | null;
  headline: string | null;
  dek: string | null;
  body: string | null;
  ftp_date: string | null; ftp_venue: string | null; ftp_city: string | null;
  ltp_date: string | null; ltp_venue: string | null; ltp_city: string | null;
  ltp_note: string | null;
  times_played: number | null;
  stats_source_name: string | null;
  stats_source_url: string | null;
}

/** Minimal prose renderer: paragraphs, **bold**, *italic*. No HTML injection. */
const Prose = ({ text }: { text: string }) => (
  <>
    {text.split(/\n{2,}/).map((para, i) => {
      const parts = para.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
      return (
        <p key={i} className="font-body text-[15px] md:text-base leading-[1.75] text-card-foreground/85 mb-5 max-w-[66ch]">
          {parts.map((p, j) => {
            if (p.startsWith("**") && p.endsWith("**")) {
              return <strong key={j} className="text-card-foreground font-medium">{p.slice(2, -2)}</strong>;
            }
            if (p.startsWith("*") && p.endsWith("*")) {
              return <em key={j} className="text-card-foreground/95">{p.slice(1, -1)}</em>;
            }
            return <span key={j}>{p}</span>;
          })}
        </p>
      );
    })}
  </>
);

const SongFeature = () => {
  const { slug } = useParams<{ slug: string }>();
  const { playSingle } = useAudioPlayer();
  const [feature, setFeature] = useState<FeatureRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await songbookDb
        .from("song_features")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .maybeSingle();
      if (cancelled) return;
      setFeature((data ?? null) as FeatureRow | null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // Dynamic meta so a shared issue unfurls as itself, not as the app.
  useEffect(() => {
    if (!feature) return;
    const title = `${feature.title} — The Songbook · Dead Set`;
    document.title = title;
    const set = (key: string, content: string) => {
      const attr = key.startsWith("og:") ? "property" : "name";
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    set("description", feature.dek ?? "");
    set("og:title", title);
    set("og:description", feature.dek ?? "");
    set("og:url", `https://dead-set.org/songbook/${feature.slug}`);
    set("twitter:title", title);
    set("twitter:description", feature.dek ?? "");
  }, [feature]);

  const handlePlay = (v: LadderVersion) => {
    if (!feature?.song_id) return;
    playSingle({
      id: `songbook-${feature.song_id}-${v.id}`,
      song: { id: feature.song_id, title: feature.title },
      version: {
        id: v.id,
        song_id: feature.song_id,
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

  if (loading) {
    return (
      <PageLayout>
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl px-5 py-16">
          <p className="font-ticket text-xs text-foreground/60 text-center">Pulling the issue…</p>
        </main>
      </PageLayout>
    );
  }

  if (!feature) {
    return (
      <PageLayout>
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl px-5 py-16 text-center">
          <p className="font-header text-2xl text-foreground mb-3">No issue here yet.</p>
          <Link to="/songbook" className="font-ticket text-xs uppercase tracking-[0.12em] text-primary underline underline-offset-4">
            Back to The Songbook
          </Link>
        </main>
      </PageLayout>
    );
  }

  const shareUrl = `https://dead-set.org/songbook/${feature.slug}`;

  return (
    <PageLayout>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 md:px-6 py-8 md:py-12">
        <div className="flex items-center justify-between gap-3 mb-7">
          <Link to="/songbook" className="inline-flex items-center gap-2 text-sm text-foreground/75 hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> The Songbook
          </Link>
          <ShareDropdown
            url={shareUrl}
            title={`${feature.title} — The Songbook`}
            description={feature.dek ?? undefined}
          />
        </div>

        <article className="bg-card text-card-foreground rounded-sm border border-border p-5 md:p-10">
          {/* ── issue masthead ── */}
          <header className="pb-6 border-b-2 border-dashed border-primary/35 mb-7">
            <p className="font-ticket text-[10px] uppercase tracking-[0.2em] text-primary mb-3">
              The Songbook · Issue {String(feature.issue_number ?? 1).padStart(3, "0")}
            </p>
            <h1 className="font-header text-4xl md:text-6xl leading-none mb-4">{feature.title}</h1>
            {feature.headline && (
              <p className="font-hand text-2xl md:text-4xl text-[hsl(var(--dead-blue))] leading-tight">
                {feature.headline}
              </p>
            )}
          </header>

          {/* ── the lifespan: FTP / LTP taught in place ── */}
          <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 mb-8 pb-7 border-b border-dashed border-border">
            <div>
              <span className="block font-ticket text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--dead-gold))]">
                First played <em className="not-italic text-muted-foreground">(FTP)</em>
              </span>
              <span className="block font-hand text-2xl md:text-3xl leading-tight mt-0.5">{feature.ftp_date}</span>
              <span className="block font-ticket text-[11px] text-muted-foreground leading-relaxed">
                {feature.ftp_venue}{feature.ftp_city ? <><br />{feature.ftp_city}</> : null}
              </span>
            </div>

            <div className="flex md:flex-col items-center justify-center gap-3 md:gap-1 md:px-6 md:border-x border-dashed border-border py-3 md:py-0">
              <span className="font-mono text-3xl md:text-4xl text-primary tabular-nums leading-none">
                {feature.times_played ?? "—"}
              </span>
              <span className="font-ticket text-[9px] uppercase tracking-[0.1em] text-muted-foreground md:text-center leading-snug">
                times played
              </span>
            </div>

            <div className="md:text-right">
              <span className="block font-ticket text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--dead-gold))]">
                Last played <em className="not-italic text-muted-foreground">(LTP)</em>
              </span>
              <span className="block font-hand text-2xl md:text-3xl leading-tight mt-0.5">{feature.ltp_date}</span>
              <span className="block font-ticket text-[11px] text-muted-foreground leading-relaxed">
                {feature.ltp_venue}{feature.ltp_city ? <><br />{feature.ltp_city}</> : null}
                {feature.ltp_note && <><br /><span className="text-primary">{feature.ltp_note}</span></>}
              </span>
            </div>
          </div>

          {/* ── the discussion ── */}
          {feature.body && <Prose text={feature.body} />}

          {/* ── the ladder ── */}
          {feature.song_id && (
            <div className="mt-10 pt-8 border-t-2 border-dashed border-primary/35">
              <SongEraLadder
                songId={feature.song_id}
                songTitle={feature.title}
                onPlay={handlePlay}
              />
            </div>
          )}

          {/* ── provenance ── */}
          {feature.stats_source_url && (
            <p className="font-mono text-[11px] text-muted-foreground mt-8 pt-5 border-t border-dashed border-border">
              First played, last played and the play count from{" "}
              <a href={feature.stats_source_url} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                {feature.stats_source_name ?? "source"}
              </a>.
            </p>
          )}
        </article>

        <div className="text-center mt-9">
          <p className="font-ticket text-[11px] uppercase tracking-[0.12em] text-foreground/55 mb-3">
            A new song every week
          </p>
          <Link
            to="/songbook"
            className="inline-block font-ticket text-[11px] uppercase tracking-[0.12em] px-5 py-3 rounded-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Every issue of The Songbook
          </Link>
        </div>
      </main>
    </PageLayout>
  );
};

export default SongFeature;
