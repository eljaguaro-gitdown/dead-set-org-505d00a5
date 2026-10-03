import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Play, Loader2, Share2, ListMusic, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { songbookDb } from "@/lib/songbookDb";
import { useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { useAuth } from "@/hooks/useAuth";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";
import { findRecordingForDate } from "@/lib/archiveOrg";
import { songSlug } from "@/lib/songSlug";
import {
  isSleeper as isSleeperVersion,
  leaderVotes,
  sleeperCutoff,
  sleepers as sleeperList,
  votePercent,
  hasVoteData,
  METHOD_LINE,
  NO_VOTES_LINE,
} from "@/lib/sleeperMath";
import {
  buildMilestones,
  milestonePlace,
  MILESTONE_LABEL,
  MILESTONE_SHORT,
  NO_TAPE_LINE,
  type MilestoneEntry,
  type MilestoneTape,
} from "@/lib/firstLastPlayed";
import { buildGuideSongs } from "@/lib/listeningGuide";
import { captureEvent } from "@/lib/posthog";

/**
 * PROTOTYPE — the version picker as a page rather than a step inside a modal.
 *
 * Three things this is testing:
 *  1. The picker result has a URL, so it can be linked, shared, returned to
 *     and indexed. In the dialog it lived in React state and was destroyed on
 *     save, which is why a guide could never be traced back to its results.
 *  2. The rare-gem logic explains itself, quietly, and admits when there is no
 *     poll behind a song rather than implying one.
 *  3. The whole proposition — pick a song, read the notes, hear the versions,
 *     keep it as a guide, send it to someone — fits on one screen's journey.
 *
 * Only two songs in the catalog have the vote data this page is built on
 * (Shakedown Street and Crazy Fingers). Every other song renders the honest
 * no-poll state, which is the state worth looking at hardest.
 */

interface PickerVersion {
  id: string;
  show_date: string | null;
  venue: string | null;
  city: string | null;
  era_id: string | null;
  votes: number | null;
  vote_source: string | null;
  source_url: string | null;
  blurb: string | null;
  is_benchmark: boolean | null;
  archive_org_url: string | null;
}

interface PickerSong {
  id: string;
  title: string;
  times_played: number | null;
  first_played: string | null;
  last_played: string | null;
}

const fmtDate = (iso: string | null) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
};

const VersionPicker = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playSingle, playSetlist, unlockAudio, playingSlot } = useAudioPlayer();

  const [song, setSong] = useState<PickerSong | null>(null);
  const [versions, setVersions] = useState<PickerVersion[]>([]);
  const [eraNames, setEraNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sleepersOnly, setSleepersOnly] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<MilestoneEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      const [{ data: songs }, { data: eras }] = await Promise.all([
        supabase.from("songs").select("id, title, times_played, first_played, last_played"),
        supabase.from("eras").select("id, name"),
      ]);
      if (cancelled) return;

      const match = (songs ?? []).find((s) => songSlug(s.title) === slug);
      if (!match) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setEraNames(new Map((eras ?? []).map((e) => [e.id, e.name])));
      setSong(match as PickerSong);

      const { data: v } = await songbookDb
        .from("notable_versions")
        .select("id, show_date, venue, city, era_id, votes, vote_source, source_url, blurb, is_benchmark, archive_org_url")
        .eq("song_id", match.id)
        .order("votes", { ascending: false, nullsFirst: false });
      if (cancelled) return;
      setVersions((v ?? []) as PickerVersion[]);
      setLoading(false);
      captureEvent("version_picker_viewed", { song_id: match.id, song_title: match.title });
    })();
    return () => { cancelled = true; };
  }, [slug]);

  // First/last played, resolved once the versions are in — same rule the
  // listening guide uses, so the page and the saved guide agree.
  useEffect(() => {
    if (!song) return;
    let cancelled = false;
    (async () => {
      const dates = [song.first_played, song.last_played].filter((d): d is string => !!d);
      const needed = dates.filter(
        (d) => !versions.some((v) => v.show_date?.slice(0, 10) === d.slice(0, 10)),
      );
      const found = await Promise.all(
        Array.from(new Set(needed)).map(async (d) => {
          const tape = await findRecordingForDate(song.title, d);
          return [d, tape as MilestoneTape | null] as const;
        }),
      );
      if (cancelled) return;
      setMilestones(
        buildMilestones(
          song,
          versions.map((v) => ({
            showDate: v.show_date ?? "",
            venue: v.venue,
            city: v.city,
            archiveUrl: v.archive_org_url,
          })),
          new Map(found),
        ),
      );
    })();
    return () => { cancelled = true; };
  }, [song, versions]);

  const voted = hasVoteData(versions);
  const leader = leaderVotes(versions);
  const cutoff = sleeperCutoff(versions);
  const theSleepers = useMemo(() => sleeperList(versions), [versions]);
  const shown = sleepersOnly ? theSleepers : versions;
  const source = versions.find((v) => v.source_url);

  /**
   * Play one version. Most ranked versions carry no archive_org_url — the
   * research recorded the night, not the tape — so the recording is resolved
   * by date on demand rather than making the page wait for 15 lookups.
   */
  const playVersion = async (v: PickerVersion) => {
    if (!song || !v.show_date) return;
    unlockAudio();
    let url = v.archive_org_url;
    if (!url) {
      setResolving(v.id);
      const tape = await findRecordingForDate(song.title, v.show_date);
      setResolving(null);
      if (!tape?.url) {
        toast.info("No tape of this night circulates yet");
        return;
      }
      url = tape.url;
    }
    playSingle({
      id: `picker-${song.id}-${v.id}`,
      song: { id: song.id, title: song.title },
      version: {
        ...SYNTHETIC_VERSION_DEFAULTS,
        id: `archive-picker-${v.id}`,
        song_id: song.id,
        show_date: v.show_date,
        venue: v.venue,
        city: v.city,
        era_id: v.era_id,
        votes: v.votes,
        blurb: v.blurb,
        is_benchmark: v.is_benchmark,
        archive_org_url: url,
      },
      setNumber: 1,
      position: 0,
      segueToNext: false,
    } as PlayableSlot);
  };

  /** Everything on screen, in order, as one queue. */
  const playAll = async () => {
    if (!song) return;
    unlockAudio();
    const withTape = shown.filter((v) => v.archive_org_url && v.show_date);
    if (withTape.length === 0) {
      toast.info("Nothing here has a tape attached yet — play one to go find it");
      return;
    }
    await playSetlist(
      withTape.map((v, i) => ({
        id: `picker-${song.id}-${v.id}`,
        song: { id: song.id, title: song.title },
        version: {
          ...SYNTHETIC_VERSION_DEFAULTS,
          id: `archive-picker-${v.id}`,
          song_id: song.id,
          show_date: v.show_date ?? "",
          venue: v.venue,
          city: v.city,
          archive_org_url: v.archive_org_url,
        },
        setNumber: 1,
        position: i,
        segueToNext: false,
      })) as PlayableSlot[],
    );
  };

  /** Keep what's on screen as a listening guide, bound tape by tape. */
  const saveAsGuide = async () => {
    if (!song) return;
    if (!user) {
      toast.info("Sign in to keep this guide");
      navigate(`/auth?redirect=${encodeURIComponent(`/versions/${slug}`)}`);
      return;
    }
    setSaving(true);
    try {
      const guideSongs = buildGuideSongs(
        song.id,
        song.title,
        shown.map((v) => ({
          showDate: v.show_date ?? "",
          venue: v.venue,
          archiveUrl: v.archive_org_url,
          rating: null,
          whyThisVersion: v.blurb ?? "",
        })),
        milestones,
      );

      const shareToken = crypto.randomUUID();
      const { data: created, error } = await supabase
        .from("setlists")
        .insert({
          creator_id: user.id,
          title: `${song.title} — Listening Guide`,
          share_token: shareToken,
          is_public: true,
          is_collaborative: false,
          description: voted
            ? `${theSleepers.length} of these ${versions.length} poll under 30% of the leader. ${METHOD_LINE}`
            : NO_VOTES_LINE,
        })
        .select()
        .single();
      if (error || !created) throw error ?? new Error("no setlist");

      await supabase.from("setlist_slots").insert(
        guideSongs.map((g) => ({
          id: crypto.randomUUID(),
          setlist_id: created.id,
          set_number: 1,
          position: g.position,
          song_id: g.songId,
          added_by_user_id: user.id,
          notes: g.notes,
          segue_to_next: false,
        })),
      );

      captureEvent("version_picker_guide_saved", {
        song_id: song.id,
        song_title: song.title,
        slot_count: guideSongs.length,
        sleepers_only: sleepersOnly,
      });
      toast.success("Guide saved");
      navigate(`/setlist/${created.id}`);
    } catch (e) {
      console.error("[VersionPicker] save failed", e);
      toast.error("Couldn't keep that guide");
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/versions/${slug}`;
    try {
      if (navigator.share) await navigator.share({ title: `${song?.title} — the versions`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
      captureEvent("version_picker_shared", { song_title: song?.title });
    } catch {
      /* dismissed */
    }
  };

  if (loading) {
    return (
      <PageLayout>
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl px-5 py-16">
          <p className="font-ticket text-xs text-foreground/60 text-center">Reading the archive…</p>
        </main>
      </PageLayout>
    );
  }

  if (notFound || !song) {
    return (
      <PageLayout>
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl px-5 py-16 text-center">
          <h1 className="font-header text-2xl text-card-foreground mb-2">No song by that name</h1>
          <Link to="/" className="font-ticket text-xs text-primary underline underline-offset-4">
            Back to the front
          </Link>
        </main>
      </PageLayout>
    );
  }

  const milestoneFor = (v: PickerVersion) =>
    milestones.find((m) => m.date.slice(0, 10) === v.show_date?.slice(0, 10)) || null;
  const standalone = milestones.filter((m) => m.listIndex === null);

  return (
    <PageLayout>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-8 pb-32">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 font-ticket text-[11px] uppercase tracking-[0.12em] text-foreground/60 hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>

        {/* ── The song ─────────────────────────────────────────────── */}
        <header className="mb-7">
          <p className="font-ticket text-[10px] uppercase tracking-[0.18em] text-primary mb-1">
            Every version worth knowing
          </p>
          <h1 className="font-title text-4xl md:text-5xl text-card-foreground leading-tight mb-2">
            {song.title}
          </h1>
          <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
            {song.times_played ? `${song.times_played} times played` : "Play count unknown"}
            {song.first_played && ` · ${fmtDate(song.first_played)} – ${fmtDate(song.last_played)}`}
          </p>
        </header>

        {/* ── Why these — the quiet disclosure ──────────────────────── */}
        <section className="mb-7 border-l-[3px] border-[hsl(var(--dead-blue))] bg-[hsl(var(--dead-blue)/0.06)] rounded-r-sm p-3.5">
          <p className="font-body text-[13px] leading-relaxed text-card-foreground/85">
            {voted ? METHOD_LINE : NO_VOTES_LINE}
          </p>
          {voted && (
            <>
              <button
                type="button"
                onClick={() => setMethodOpen((o) => !o)}
                aria-expanded={methodOpen}
                className="mt-1.5 inline-flex items-center gap-1 font-ticket text-[10px] uppercase tracking-[0.14em] text-[hsl(var(--dead-blue))] hover:opacity-80 transition-opacity"
              >
                the arithmetic
                <ChevronDown className={`w-3 h-3 transition-transform ${methodOpen ? "rotate-180" : ""}`} />
              </button>
              {methodOpen && (
                <div className="mt-2.5 pt-2.5 border-t border-dashed border-[hsl(var(--dead-blue)/0.3)] space-y-2">
                  <p className="font-body text-[13px] leading-relaxed text-muted-foreground max-w-[62ch]">
                    <strong className="text-card-foreground font-medium">★ Era benchmark</strong> — the
                    highest-voted version inside its era.{" "}
                    <strong className="text-card-foreground font-medium">◆ Sleeper</strong> — ranked on the
                    all-time list but polling under 30% of the leader
                    {leader > 0 && <> (fewer than {Math.ceil(cutoff)} votes against {leader})</>}.
                  </p>
                  <p className="font-body text-[13px] leading-relaxed text-muted-foreground max-w-[62ch]">
                    Arithmetic on public vote counts, not an opinion we invented. Where no data exists, this
                    page shows the gap rather than filling it with adjectives.
                    {source && (
                      <>
                        {" "}Rankings from{" "}
                        <a
                          href={source.source_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-2"
                        >
                          {source.vote_source ?? "source"}
                        </a>.
                      </>
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        {/* ── The pitch + filter ───────────────────────────────────── */}
        {theSleepers.length > 0 && (
          <section className="mb-6 p-4 rounded-sm border border-primary/40 bg-gradient-to-b from-primary/[0.13] to-primary/[0.05]">
            <p className="font-ticket text-[10px] uppercase tracking-[0.18em] text-primary mb-1">
              Why you're really here
            </p>
            <h2 className="font-header text-xl md:text-2xl text-card-foreground leading-tight mb-2">
              {theSleepers.length} you probably haven't heard
            </h2>
            <p className="font-body text-sm text-muted-foreground max-w-[52ch] mb-3">
              Real regard, almost no attention. Enough heads voted these onto the all-time list that they
              aren't random picks — they just never became the ones everybody names.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => { setSleepersOnly(true); void playAll(); }}
                className="font-ticket text-[11px] uppercase tracking-[0.1em] px-4 py-2.5 rounded-sm bg-primary text-primary-foreground hover:opacity-90 active:opacity-80 transition-opacity"
              >
                ▶ Play the {theSleepers.length} sleepers
              </button>
              <button
                type="button"
                onClick={() => setSleepersOnly(false)}
                aria-pressed={!sleepersOnly}
                className={`font-ticket text-[11px] uppercase tracking-[0.1em] px-3 py-2.5 rounded-sm transition-colors ${
                  !sleepersOnly
                    ? "border border-border bg-muted/50 text-card-foreground"
                    : "text-muted-foreground underline underline-offset-4 hover:text-card-foreground"
                }`}
              >
                Show all {versions.length}
              </button>
            </div>
          </section>
        )}

        {/* ── The versions ─────────────────────────────────────────── */}
        {versions.length === 0 ? (
          <div className="border border-dashed border-border rounded-sm p-5 text-center">
            <p className="font-ticket text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
              Nothing ranked yet
            </p>
            <p className="font-body text-sm text-muted-foreground">
              Nobody has mapped {song.title} across the eras. That gap is the work.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {standalone
              .filter((m) => m.kind === "ftp")
              .map((m) => <MilestoneRow key={m.kind} milestone={m} />)}

            {shown.map((v) => {
              const sleeper = isSleeperVersion(v, versions);
              const m = milestoneFor(v);
              const pct = votePercent(v, versions);
              const playing = playingSlot?.version?.show_date === v.show_date;
              return (
                <article
                  key={v.id}
                  className={`rounded-sm border px-3.5 py-3 transition-colors ${
                    playing ? "bg-primary/10 border-primary/45" : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`font-hand text-2xl leading-tight ${playing ? "text-primary" : "text-[hsl(var(--dead-blue))]"}`}>
                        {fmtDate(v.show_date)}
                      </p>
                      <p className="font-ticket text-[11px] text-muted-foreground mt-0.5">
                        {v.venue}{v.city ? ` · ${v.city}` : ""}
                      </p>
                    </div>
                    {v.votes != null && (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-mono text-[13px] font-medium text-card-foreground tabular-nums leading-none">
                          {v.votes}
                          <span className="font-ticket text-[9px] uppercase tracking-[0.1em] text-muted-foreground ml-1 font-normal">
                            votes
                          </span>
                        </span>
                        <span className="block w-[84px] h-[3px] rounded-sm bg-muted-foreground/30 overflow-hidden">
                          <span className="block h-full rounded-sm bg-primary" style={{ width: `${pct}%` }} />
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {v.era_id && eraNames.get(v.era_id) && (
                      <Chip tone="era">{eraNames.get(v.era_id)}</Chip>
                    )}
                    {v.is_benchmark && <Chip tone="canon">★ Era benchmark</Chip>}
                    {sleeper && <Chip tone="sleep">◆ Sleeper</Chip>}
                    {m && <Chip tone="milestone">{MILESTONE_SHORT[m.kind]} {MILESTONE_LABEL[m.kind]}</Chip>}
                  </div>

                  {v.blurb && (
                    <p className="font-body text-[13px] leading-relaxed text-muted-foreground mt-2 max-w-[62ch]">
                      {v.blurb}
                    </p>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resolving === v.id}
                    onClick={() => void playVersion(v)}
                    className="h-7 mt-2.5 text-xs font-body gap-1 border-primary/30 text-dead-gold hover:bg-primary/10"
                  >
                    {resolving === v.id ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> Looking for the tape…</>
                    ) : (
                      <><Play className="w-3 h-3 fill-current" /> Play this version</>
                    )}
                  </Button>
                </article>
              );
            })}

            {standalone
              .filter((m) => m.kind === "ltp")
              .map((m) => <MilestoneRow key={m.kind} milestone={m} />)}
          </div>
        )}
      </main>

      {/* ── Keep it / send it ──────────────────────────────────────── */}
      {versions.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur px-5 py-3">
          <div className="mx-auto max-w-3xl flex items-center gap-2">
            <Button
              onClick={() => void saveAsGuide()}
              disabled={saving}
              className="flex-1 bg-primary text-primary-foreground font-ticket text-[11px] uppercase tracking-[0.1em] gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListMusic className="w-3.5 h-3.5" />}
              Keep as a listening guide
            </Button>
            <Button
              variant="outline"
              onClick={() => void share()}
              className="border-border font-ticket text-[11px] uppercase tracking-[0.1em] gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </Button>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

const MilestoneRow = ({ milestone: m }: { milestone: MilestoneEntry }) => (
  <article className="rounded-sm border border-dashed border-primary/40 bg-primary/[0.04] px-3.5 py-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-hand text-2xl leading-tight text-[hsl(var(--dead-blue))]">{fmtDate(m.date)}</p>
        {milestonePlace(m) && (
          <p className="font-ticket text-[11px] text-muted-foreground mt-0.5">{milestonePlace(m)}</p>
        )}
      </div>
      <Chip tone="milestone">{MILESTONE_SHORT[m.kind]} {MILESTONE_LABEL[m.kind]}</Chip>
    </div>
    {!m.tapeFound && (
      <p className="font-body text-[13px] leading-relaxed text-muted-foreground mt-2 italic">{NO_TAPE_LINE}</p>
    )}
  </article>
);

const Chip = ({ tone, children }: { tone: "canon" | "sleep" | "era" | "milestone"; children: React.ReactNode }) => {
  const tones = {
    canon: "text-[hsl(var(--dead-gold))] border-[hsl(var(--dead-gold)/0.6)] bg-[hsl(var(--dead-gold)/0.1)]",
    sleep: "text-[hsl(var(--dead-green))] border-[hsl(var(--dead-green)/0.6)] bg-[hsl(var(--dead-green)/0.1)]",
    era: "text-muted-foreground border-border bg-muted/40",
    milestone: "text-primary border-primary/50 bg-primary/10",
  } as const;
  return (
    <span className={`font-ticket text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-[2px] border whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
};

export default VersionPicker;
