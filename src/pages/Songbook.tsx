import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { songbookDb } from "@/lib/songbookDb";
import PageLayout from "@/components/PageLayout";
import { songSlug } from "@/lib/songSlug";
import SiteHeader from "@/components/SiteHeader";
import { captureEvent } from "@/lib/posthog";

/**
 * The Songbook — one song a week, forever.
 *
 * The Dead's live repertoire runs to roughly 523 songs (189 originals and 334
 * covers, per the GD Lyric & Song Finder). At one a week that is a decade of
 * issues. This page is the spine of the series: the current issue up top, the
 * back issues below, and an honest count of how far in we are.
 */

/**
 * A song whose first listening guide came from a reader. The editorial series
 * runs a song a week; the repertoire is ~523 songs, so the series alone is a
 * decade of Sundays and 232 of the 234 songs in the catalog have nothing. This
 * is the shelf filling from the other end.
 */
interface CommunityRow {
  id: string;
  created_at: string;
  setlist_id: string;
  creator_id: string;
  songs: { title: string } | null;
  /** Filled by a second query — see the note on the fetch below. */
  creatorName?: string | null;
}

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

/** The week an issue went out, in the archive's own plain register. */
const fmtWeek = (d: string | null) => {
  if (!d) return "";
  const parsed = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
};

const Songbook = () => {
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [community, setCommunity] = useState<CommunityRow[]>([]);
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

      // Separate query, and deliberately after the issues are on screen: the
      // community shelf is additive, so a failure here must leave the
      // editorial series rendering exactly as it does today.
      try {
        // NOT `profiles(display_name)` as an embed. songbook_entries.creator_id
        // references auth.users, not profiles, so PostgREST has no relationship
        // to traverse and rejects the whole select — the shelf would have come
        // back null and rendered empty forever, silently, because the catch
        // below swallows it. Every other page (Browse, MySetlists) resolves
        // names with a second query by user_id; this does the same.
        const { data: entries } = await songbookDb
          .from("songbook_entries")
          .select("id, created_at, setlist_id, creator_id, songs(title)")
          .order("created_at", { ascending: false })
          .limit(60);

        const rows = (entries ?? []) as CommunityRow[];
        const creatorIds = [...new Set(rows.map((r) => r.creator_id).filter(Boolean))];
        if (creatorIds.length) {
          const { data: profiles } = await songbookDb
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", creatorIds);
          const names = new Map(
            ((profiles ?? []) as { user_id: string; display_name: string | null }[]).map(
              (p) => [p.user_id, p.display_name],
            ),
          );
          for (const r of rows) r.creatorName = names.get(r.creator_id) ?? null;
        }
        if (!cancelled) setCommunity(rows);
      } catch (e) {
        console.error("[songbook] community shelf failed", e);
      }
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
          <p className="font-ticket text-[10px] uppercase tracking-[0.24em] text-[hsl(var(--dead-gold))] mb-3">
            One song a week · forever
          </p>
          {/*
            Sancreek, not UnifrakturMaguntia. DESIGN.md §2 assigns the
            blackletter to "titles and logos", and read literally that put it
            here — but it made the masthead the only blackletter on a page
            whose every issue title is Sancreek, and at 60px the dense gothic
            is genuinely hard to read. The table's intent is ornate-over-
            utilitarian, which Sancreek satisfies; the outlier was the
            inconsistency, not the rule. DESIGN.md's row should say so.
          */}
          <h1 className="font-header text-4xl md:text-6xl text-foreground leading-none mb-4">
            The Songbook
          </h1>
          <p className="font-body text-sm md:text-base text-foreground/85 max-w-[54ch] mx-auto">
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
                <span className="font-ticket text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--dead-gold))]">This week</span>
                <span className="flex-1 h-px bg-primary/25" />
              </div>

              <Link
                to={`/songbook/${current.slug}`}
                onClick={() => captureEvent("songbook_issue_opened", {
                  issue_number: current.issue_number,
                  placement: "current",
                })}
                className="block bg-card text-card-foreground rounded-sm p-6 md:p-9 border border-border hover:border-primary/50 transition-colors group"
              >
                <p className="font-ticket text-[10px] uppercase tracking-[0.18em] text-dead-dark mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-dead-gold text-dead-dark">
                    Vol. {current.issue_number ?? 1}
                  </span>
                  {current.week_of && <span className="text-dead-dark/75">{fmtWeek(current.week_of)}</span>}
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
                  <span className="ml-auto font-ticket text-[11px] uppercase tracking-[0.12em] text-dead-dark self-end">
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

                {/*
                  A back issue is the same object as the current one — it is
                  just older. It used to render as a title and a year range in
                  a three-up grid beside a full-dress current issue, which read
                  as an afterthought rather than an archive. Two up, with the
                  headline, the dek and the same stamped meta row, so the shelf
                  looks like a run of issues worth reading back through.
                */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {back.map((f) => (
                    <Link
                      key={f.id}
                      to={`/songbook/${f.slug}`}
                      onClick={() => captureEvent("songbook_issue_opened", {
                        issue_number: f.issue_number,
                        placement: "archive",
                      })}
                      className="flex flex-col bg-card text-card-foreground rounded-sm p-5 border border-border hover:border-primary/50 transition-colors group"
                    >
                      <p className="font-ticket text-[9px] uppercase tracking-[0.16em] text-dead-dark mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-dead-gold text-dead-dark">
                          Vol. {f.issue_number ?? 0}
                        </span>
                        {f.week_of && <span className="text-dead-dark/75">{fmtWeek(f.week_of)}</span>}
                      </p>

                      <h3 className="font-header text-2xl leading-tight mb-2 group-hover:text-primary transition-colors">
                        {f.title}
                      </h3>

                      {f.headline && (
                        <p className="font-hand text-xl text-[hsl(var(--dead-blue))] leading-tight mb-2.5">
                          {f.headline}
                        </p>
                      )}
                      {f.dek && (
                        <p className="font-body text-[13px] text-muted-foreground leading-relaxed mb-4 line-clamp-3">
                          {f.dek}
                        </p>
                      )}

                      {/* mt-auto so every card's rule sits on the same line
                          however long the dek above it runs. */}
                      <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 pt-3 border-t-2 border-dashed border-border">
                        <Meta k="First played" v={f.ftp_date ?? "—"} />
                        <Meta k="Last played" v={f.ltp_date ?? "—"} />
                        <Meta k="Times played" v={f.times_played != null ? String(f.times_played) : "—"} />
                        <span className="ml-auto font-ticket text-[10px] uppercase tracking-[0.12em] text-dead-dark self-end">
                          Read &rarr;
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ── THE RUNWAY ── */}
        {/* ── FROM THE COMMUNITY ──
            Not issues, and never labelled as them. An issue is written and
            sourced; these are the nights a head mapped first. Same shelf,
            different tier, and the difference is stated rather than blurred. */}
        {community.length > 0 && (
          <section className="mt-14">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="font-ticket text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--dead-gold))]">
                From the community
              </span>
              <span className="flex-1 h-px bg-[hsl(var(--dead-gold)/0.3)]" />
            </div>
            <p className="font-body text-sm text-foreground/85 max-w-[62ch] mb-5">
              Songs the series hasn't reached yet, mapped by the people who got there first.
              Build a listening guide for a song nobody has covered and it lands here under your name.
            </p>

            <ul className="grid gap-px bg-border rounded-sm overflow-hidden sm:grid-cols-2">
              {community.map((c) => (
                <li key={c.id}>
                  {/* Points at the issue, not the raw guide: a community entry
                      now gets the same page the editorial issues get, at the
                      same /songbook/<slug> url, which is what makes it
                      shareable as an issue. The guide is one click on from
                      there. */}
                  <Link
                    to={`/songbook/${songSlug(c.songs?.title ?? "")}`}
                    onClick={() => captureEvent("songbook_community_opened", { entry_id: c.id })}
                    className="block bg-card text-card-foreground p-4 md:p-5 hover:bg-card/80 transition-colors group h-full"
                  >
                    <h3 className="font-header text-xl md:text-2xl leading-tight group-hover:text-primary transition-colors">
                      {c.songs?.title ?? "A song"}
                    </h3>
                    <div className="flex items-end justify-between gap-3 mt-1.5">
                      <p className="font-ticket text-[12px] text-card-foreground/70">
                        first mapped by{" "}
                        <span className="text-card-foreground">
                          {c.creatorName ?? "a Deadhead"}
                        </span>
                      </p>
                      {/* The same promise the curated card makes, because it now
                          leads to the same kind of page. */}
                      <span className="font-ticket text-[11px] uppercase tracking-[0.12em] text-primary shrink-0">
                        Read →
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-14 p-5 md:p-6 rounded-r-sm border-l-[3px] border-[hsl(var(--dead-blue))] bg-[hsl(var(--dead-blue)/0.08)]">
          {/* Gold, like its sibling eyebrows: blue on this maroon panel is
              2.71:1 at 10px. Gold on maroon measures 5.25:1. */}
          <h3 className="font-ticket text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--dead-gold))] mb-2">
            How long can this possibly run
          </h3>
          <p className="font-body text-sm text-foreground/85 max-w-[64ch] mb-2">
            The Grateful Dead's live repertoire is roughly <strong className="text-foreground">523 songs</strong> —
            189 originals and 334 covers. Around <strong className="text-foreground">450</strong> were played
            in front of an audience more than once. At one issue a week, that is close to a decade before we
            repeat ourselves.
          </p>
          <p className="font-body text-sm text-foreground/85 max-w-[64ch]">
            Not every song earns a full issue — a lot of those covers were played once, at a soundcheck, or
            with a guest. Songs the band actually lived with, the ones that changed shape across eras, are
            where the series spends its time. When a song has only one version worth naming, we will say so
            rather than pad it.
          </p>
          <p className="font-mono text-[11px] text-foreground/80 mt-3">
            Counts:{" "}
            <a href="http://deadessays.blogspot.com/2011/07/grateful-dead-song-graph.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              GD Lyric &amp; Song Finder, via Grateful Dead Guide
            </a>
          </p>
        </section>

        <p className="font-ticket text-[11px] uppercase tracking-[0.1em] text-foreground/85 text-center mt-12">
          Built on the shoulders of the tapers, the traders &amp; the Internet Archive
        </p>
      </main>
    </PageLayout>
  );
};

const Stat = ({ n, label }: { n: string; label: string }) => (
  <div className="bg-card text-card-foreground py-3 px-2">
    {/* 20px is not "large text" under WCAG (that needs 18.66px BOLD or 24px),
        so text-primary's 4.06:1 on the cream stat tile does not pass. */}
    <div className="font-header text-xl md:text-2xl text-dead-dark leading-none">{n}</div>
    <div className="font-ticket text-[9px] uppercase tracking-[0.1em] text-muted-foreground mt-1.5 leading-snug">
      {label}
    </div>
  </div>
);

const Meta = ({ k, v }: { k: string; v: string }) => (
  <span className="block">
    {/* dead-dark, not gold: these render inside the issue card, and gold on
        the cream card is 2.58:1. Gold stays correct on the maroon page — the
        community header above is 5.30:1 — but this is the other surface. */}
    <span className="block font-ticket text-[9px] uppercase tracking-[0.14em] text-dead-dark/85">{k}</span>
    <span className="block font-hand text-lg text-card-foreground leading-tight">{v}</span>
  </span>
);

export default Songbook;
