import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { songbookDb } from "@/lib/songbookDb";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";

/**
 * The Songbook — one song a week, forever.
 *
 * The Dead's live repertoire runs to roughly 523 songs (189 originals and 334
 * covers, per the GD Lyric & Song Finder). At one a week that is a decade of
 * issues. This page is the spine of the series: the current issue up top, the
 * back issues below, and an honest count of how far in we are.
 */

interface FeatureRow {
  id: string;
  slug: string;
  title: string;
  week_of: string;
  issue_number: number | null;
  headline: string | null;
  dek: string | null;
  times_played: number | null;
  ftp_date: string | null;
  ltp_date: string | null;
}

/** Repertoire size — sourced, not estimated. See the note rendered on-page. */
const REPERTOIRE_TOTAL = 523;

const yearOf = (d: string | null) => (d ? d.slice(-4) : "");

const Songbook = () => {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await songbookDb
        .from("song_features")
        .select("id, slug, title, week_of, issue_number, headline, dek, times_played, ftp_date, ltp_date")
        .eq("published", true)
        .order("week_of", { ascending: false });
      if (cancelled) return;
      setFeatures((data ?? []) as FeatureRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const [current, ...back] = features;
  const weeksRemaining = Math.max(0, REPERTOIRE_TOTAL - features.length);
  const yearsRemaining = (weeksRemaining / 52).toFixed(1);

  return (
    <PageLayout>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-5 md:px-6 py-8 md:py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-foreground/75 hover:text-foreground mb-7">
          <ArrowLeft className="w-4 h-4" /> Back to Dead-Set.Org
        </Link>

        {/* ── MASTHEAD ── */}
        <header className="text-center pb-7 border-b border-dashed border-primary/30 mb-8">
          <p className="font-ticket text-[10px] uppercase tracking-[0.24em] text-primary mb-3">
            One song a week · forever
          </p>
          <h1 className="font-title text-4xl md:text-6xl text-foreground leading-none mb-4">
            The Songbook
          </h1>
          <p className="font-body text-sm md:text-base text-foreground/70 max-w-[54ch] mx-auto">
            Every week we take one song and follow it across thirty years — the first time they played it,
            the last time, and every version in between worth your evening. The catalogue is deep enough
            that we will not run out.
          </p>

          <div className="grid grid-cols-3 gap-px mt-7 max-w-lg mx-auto bg-border rounded-sm overflow-hidden">
            <Stat n={String(features.length)} label={features.length === 1 ? "issue published" : "issues published"} />
            <Stat n={String(REPERTOIRE_TOTAL)} label="songs in the repertoire" />
            <Stat n={`${yearsRemaining} yrs`} label="of Sundays left" />
          </div>
        </header>

        {loading ? (
          <p className="font-ticket text-xs text-muted-foreground text-center py-12">Opening the songbook…</p>
        ) : !features.length ? (
          <p className="font-ticket text-xs text-muted-foreground text-center py-12">
            The first issue lands soon.
          </p>
        ) : (
          <>
            {/* ── CURRENT ISSUE ── */}
            <section className="mb-12">
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-ticket text-[10px] uppercase tracking-[0.2em] text-primary">This week</span>
                <span className="flex-1 h-px bg-primary/25" />
              </div>

              <Link
                to={`/songbook/${current.slug}`}
                className="block bg-card text-card-foreground rounded-sm p-6 md:p-9 border border-border hover:border-primary/50 transition-colors group"
              >
                <p className="font-ticket text-[10px] uppercase tracking-[0.18em] text-primary mb-3">
                  Issue {String(current.issue_number ?? 1).padStart(3, "0")}
                </p>
                <h2 className="font-header text-3xl md:text-5xl leading-none mb-3 group-hover:text-primary transition-colors">
                  {current.title}
                </h2>
                {current.headline && (
                  <p className="font-hand text-2xl md:text-3xl text-[hsl(var(--dead-blue))] leading-tight mb-4">
                    {current.headline}
                  </p>
                )}
                {current.dek && (
                  <p className="font-body text-sm md:text-base text-muted-foreground max-w-[62ch] mb-5">
                    {current.dek}
                  </p>
                )}

                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-4 border-t-2 border-dashed border-border">
                  <Meta k="First played" v={current.ftp_date ?? "—"} />
                  <Meta k="Last played" v={current.ltp_date ?? "—"} />
                  <Meta k="Times played" v={current.times_played != null ? String(current.times_played) : "—"} />
                  <span className="ml-auto font-ticket text-[11px] uppercase tracking-[0.12em] text-primary self-end">
                    Read the issue &rarr;
                  </span>
                </div>
              </Link>
            </section>

            {/* ── BACK ISSUES ── */}
            {back.length > 0 && (
              <section>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="font-ticket text-[10px] uppercase tracking-[0.2em] text-foreground/60">
                    Back issues
                  </span>
                  <span className="flex-1 h-px bg-border" />
                  <span className="font-mono text-[11px] text-foreground/50 tabular-nums">{back.length}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {back.map((f) => (
                    <Link
                      key={f.id}
                      to={`/songbook/${f.slug}`}
                      className="block bg-card text-card-foreground rounded-sm p-4 border border-border hover:border-primary/50 transition-colors group"
                    >
                      <p className="font-ticket text-[9px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
                        Issue {String(f.issue_number ?? 0).padStart(3, "0")}
                      </p>
                      <h3 className="font-header text-xl leading-tight mb-1.5 group-hover:text-primary transition-colors">
                        {f.title}
                      </h3>
                      <p className="font-ticket text-[11px] text-muted-foreground">
                        {yearOf(f.ftp_date)}–{yearOf(f.ltp_date)}
                        {f.times_played != null && <> · {f.times_played}×</>}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ── THE RUNWAY ── */}
        <section className="mt-14 p-5 md:p-6 rounded-r-sm border-l-[3px] border-[hsl(var(--dead-blue))] bg-[hsl(var(--dead-blue)/0.08)]">
          <h3 className="font-ticket text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--dead-blue))] mb-2">
            How long can this possibly run
          </h3>
          <p className="font-body text-sm text-foreground/75 max-w-[64ch] mb-2">
            The Grateful Dead's live repertoire is roughly <strong className="text-foreground">523 songs</strong> —
            189 originals and 334 covers. Around <strong className="text-foreground">450</strong> were played
            in front of an audience more than once. At one issue a week, that is close to a decade before we
            repeat ourselves.
          </p>
          <p className="font-body text-sm text-foreground/75 max-w-[64ch]">
            Not every song earns a full issue — a lot of those covers were played once, at a soundcheck, or
            with a guest. Songs the band actually lived with, the ones that changed shape across eras, are
            where the series spends its time. When a song has only one version worth naming, we will say so
            rather than pad it.
          </p>
          <p className="font-mono text-[11px] text-foreground/45 mt-3">
            Counts:{" "}
            <a href="http://deadessays.blogspot.com/2011/07/grateful-dead-song-graph.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              GD Lyric &amp; Song Finder, via Grateful Dead Guide
            </a>
          </p>
        </section>

        <p className="font-ticket text-[11px] uppercase tracking-[0.1em] text-foreground/50 text-center mt-12">
          Built on the shoulders of the tapers, the traders &amp; the Internet Archive
        </p>
      </main>
    </PageLayout>
  );
};

const Stat = ({ n, label }: { n: string; label: string }) => (
  <div className="bg-card text-card-foreground py-3 px-2">
    <div className="font-header text-xl md:text-2xl text-primary leading-none">{n}</div>
    <div className="font-ticket text-[9px] uppercase tracking-[0.1em] text-muted-foreground mt-1.5 leading-snug">
      {label}
    </div>
  </div>
);

const Meta = ({ k, v }: { k: string; v: string }) => (
  <span className="block">
    <span className="block font-ticket text-[9px] uppercase tracking-[0.14em] text-[hsl(var(--dead-gold))]">{k}</span>
    <span className="block font-hand text-lg text-card-foreground leading-tight">{v}</span>
  </span>
);

export default Songbook;
