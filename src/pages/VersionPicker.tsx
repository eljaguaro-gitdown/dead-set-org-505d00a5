import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Loader2, Share2, ListMusic, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { SignInInvite } from "@/components/SignInInvite";
import { shareVersionsCopy, lifespanLine } from "@/lib/shareCopy";
import { renderVersionsCard, loadCardFonts } from "@/lib/versionsShareCard";
import { shareToInstagram } from "@/lib/instagramShare";
import {
  contributeToSongbook,
  SONGBOOK_ADDED_TITLE,
  SONGBOOK_ADDED_BODY,
} from "@/lib/songbookContribution";
import type { InviteIntent } from "@/lib/signInInviteCopy";
import { supabase } from "@/integrations/supabase/client";
import { songbookDb } from "@/lib/songbookDb";
import { useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";
import { useAuth } from "@/hooks/useAuth";
import PageLayout from "@/components/PageLayout";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SYNTHETIC_VERSION_DEFAULTS } from "@/lib/syntheticVersion";
import { findRecordingForDate, findManyArchiveRecordings } from "@/lib/archiveOrg";
import {
  scoreRecordings,
  quietGems,
  hasRegardData,
  quietGemReason,
  QUIET_GEM_CHIP,
  REGARD_METHOD_LINE,
} from "@/lib/regardVsAttention";
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
  NO_TAPE_LINE,
  type MilestoneEntry,
  type MilestoneTape,
} from "@/lib/firstLastPlayed";
import { buildGuideSongs } from "@/lib/listeningGuide";
import { captureEvent } from "@/lib/posthog";

/** Which control started the audio — one per play path on this page. */
type PlayOrigin =
  | "hero_debut"
  | "hero_top"
  | "hero_fallback"
  | "milestone_first"
  | "milestone_last"
  | "version"
  | "play_all";

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

/** The Songbook issue for this song, when one has been written. */
interface PickerFeature {
  slug: string;
  issue_number: number | null;
  headline: string | null;
  dek: string | null;
  ftp_venue: string | null; ftp_city: string | null;
  ltp_venue: string | null; ltp_city: string | null;
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
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [feature, setFeature] = useState<PickerFeature | null>(null);
  // Charlie's picks, for the songs nobody has ranked yet.
  const [charlie, setCharlie] = useState<{ linerNotes: string } | null>(null);
  const [charlieLoading, setCharlieLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Which sign-in invite is open, if any. Null means nothing is in the way. */
  const [invite, setInvite] = useState<InviteIntent | null>(null);
  /** Set when this guide was the first to map its song. Holds the setlist id. */
  const [contributed, setContributed] = useState<string | null>(null);
  /** Quiet gems by night (YYYY-MM-DD), with the evidence line for each. */
  const [gems, setGems] = useState<Map<string, string | null>>(new Map());
  /** The sharer's own name, so a share can say who it came from. */
  const [profileName, setProfileName] = useState<string | null>(null);

  /**
   * How far to lift the Keep bar so the global player does not bury it.
   *
   * Both are `fixed bottom-0 z-40` and GlobalAudioPlayer renders after
   * <Routes>, so it painted on top: the moment someone pressed play — exactly
   * when they might want to keep the thing they are hearing — the save and
   * sign-in call to action disappeared for the rest of the session.
   *
   * z-index cannot fix this. PageLayout wraps every page in
   * `relative z-10`, which opens a stacking context, so any z-index set in
   * here is scoped inside it and the whole context still loses to the
   * player's root-level z-40. Moving the bar is the only thing that works,
   * and the player is draggable, so its height is not a number anyone can
   * hardcode — measure it.
   */
  const [playerHeight, setPlayerHeight] = useState(0);

  useEffect(() => {
    const el = document.querySelector("[data-global-player]");
    if (!el) { setPlayerHeight(0); return; }

    /**
     * The player's own box is not the whole obstruction. Its error banner
     * ("That song isn't on this tape") is `absolute -top-12`, so it hangs ~48px
     * ABOVE the root and getBoundingClientRect().height does not see it — it
     * covered the Keep button whenever a tape turned out not to contain the
     * song. Measure from the highest edge anything in the player reaches.
     */
    const measure = () => {
      let top = el.getBoundingClientRect().top;
      for (const child of el.querySelectorAll("*")) {
        const r = child.getBoundingClientRect();
        if (r.height > 0 && r.top < top) top = r.top;
      }
      setPlayerHeight(Math.max(0, window.innerHeight - top));
    };
    measure();

    // Size alone is not enough: the banner is an absolutely-positioned child,
    // so it appears without changing the root's height. Watch the subtree too.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [playingSlot]);

  useEffect(() => {
    if (!user) { setProfileName(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled) setProfileName((data as { display_name?: string | null } | null)?.display_name?.trim() || null);
      } catch {
        // A share without a name still reads fine.
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  /**
   * The quiet gems, for the songs no poll covers.
   *
   * sleeperMath needs fan votes and two songs in the catalog have them, so for
   * everyone else this page could rank nothing. archive.org publishes both
   * halves of a usable answer for every recording — how highly it is rated and
   * how often it is pulled — so a tape held high and rarely taken is findable
   * without a poll, a partner or a key.
   *
   * Only fetched when there is no poll to read, because for the two songs that
   * have one the votes are the better signal and this would be a second lookup
   * for nothing. Runs after the page has rendered: the versions are already on
   * screen and the chips arrive when they arrive.
   */
  useEffect(() => {
    // hasVoteData rather than `voted`, which is derived further down the
    // component — same predicate, available here.
    if (!song || hasVoteData(versions) || versions.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const tapes = await findManyArchiveRecordings(song.title, 50);
        if (cancelled || tapes.length === 0) return;

        // One row per NIGHT, not per upload — several transfers of one show
        // would otherwise compete with each other and the quieter copies of a
        // famous tape would look overlooked.
        const bestPerNight = new Map<string, (typeof tapes)[number]>();
        for (const t of tapes) {
          const night = t.date?.slice(0, 10);
          if (!night) continue;
          const held = bestPerNight.get(night);
          if (!held || (t.downloads ?? 0) > (held.downloads ?? 0)) bestPerNight.set(night, t);
        }

        const cohort = [...bestPerNight.values()].map((t) => ({
          identifier: t.date!.slice(0, 10),
          avgRating: t.avgRating,
          reviews: t.reviews,
          downloads: t.downloads,
        }));
        if (!hasRegardData(cohort)) return;

        setGems(
          new Map(
            quietGems(scoreRecordings(cohort)).map((g) => [g.identifier, quietGemReason(g)] as const),
          ),
        );
      } catch (e) {
        // Chips are a bonus on this page, never the content. A failed lookup
        // must leave the versions exactly as they are.
        console.error("[VersionPicker] gem lookup failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [song, versions]);

  /**
   * Finish what they came back for.
   *
   * /auth returns to `?then=share` or `?then=save`. Without this the reader
   * signs in, lands back on the page, and nothing happens — they have to find
   * the button again, which is a small letdown at the end of a flow built
   * entirely on momentum. The param is consumed immediately so a refresh or a
   * back-button does not re-fire it.
   */
  useEffect(() => {
    const then = searchParams.get("then");
    if (!then || !user || !song) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("then");
        return next;
      },
      { replace: true },
    );
    if (then === "share") void sendIt();
    if (then === "save") void saveAsGuide();
    // sendIt/saveAsGuide are stable for this purpose; re-running on their
    // identity would re-fire the action on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user, song]);

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
      const catalog = (v ?? []) as PickerVersion[];
      setVersions(catalog);
      setLoading(false);

      // Only 2 of 234 songs have a ranked version list. For every other song
      // the catalog is silent, and a silent page is a dead end on the one
      // surface meant to send people into the music. Charlie knows the tapes
      // even where the poll has nothing to say — labelled as his picks, never
      // dressed up as the vote.
      if (catalog.length === 0) {
        setCharlieLoading(true);
        try {
          const { data: ex } = await supabase.functions.invoke("ai-deadhead", {
            body: { mode: "explore", songTitle: match.title, songId: match.id, eraIds: null },
          });
          if (cancelled) return;
          const picked = (ex?.versions ?? []) as {
            showDate: string; venue: string | null; city: string | null;
            eraName: string | null; archiveUrl: string | null; whyThisVersion: string;
          }[];
          if (picked.length > 0) {
            setVersions(
              picked.map((pv, i) => ({
                id: `charlie-${i}-${pv.showDate}`,
                show_date: pv.showDate,
                venue: pv.venue,
                city: pv.city,
                era_id: null,
                votes: null,
                vote_source: null,
                source_url: null,
                blurb: pv.whyThisVersion,
                is_benchmark: false,
                archive_org_url: pv.archiveUrl,
              })),
            );
            setCharlie({ linerNotes: ex?.linerNotes ?? "" });
          }
        } catch (e) {
          console.error("[VersionPicker] Charlie fallback failed", e);
        } finally {
          if (!cancelled) setCharlieLoading(false);
        }
      }

      // The Songbook issue, where one exists — the best writing we have about
      // this song. Enrichment only: if it fails, the versions still render.
      try {
        const { data: f } = await songbookDb
          .from("song_features")
          .select("slug, issue_number, headline, dek, ftp_venue, ftp_city, ltp_venue, ltp_city")
          .eq("song_id", match.id)
          .maybeSingle();
        if (!cancelled) setFeature((f ?? null) as PickerFeature | null);
      } catch {
        if (!cancelled) setFeature(null);
      }
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
  /** Highest-voted night — the fallback when the debut has no tape. */
  const topVersion = versions[0] ?? null;
  const ftp = milestones.find((m) => m.kind === "ftp") ?? null;
  /**
   * The big button leads with the first time they ever played it. The debut is
   * the thing every head wants to hear and the catalog knows it for 200 of 234
   * songs, so it beats "highest voted" as an opening offer. If no tape of that
   * night circulates the tap still plays — it falls through to the top pick and
   * says why.
   */
  const heroDate = song?.first_played ?? topVersion?.show_date ?? null;
  const heroIsDebut = !!song?.first_played;
  const heroVenue = heroIsDebut
    ? (ftp?.venue ?? versions.find((v) => v.show_date?.slice(0, 10) === song?.first_played?.slice(0, 10))?.venue ?? null)
    : (topVersion?.venue ?? null);
  const heroCity = heroIsDebut ? (ftp?.city ?? null) : (topVersion?.city ?? null);
  const [heroResolving, setHeroResolving] = useState(false);

  /**
   * Every way a visitor can start audio on this page reports the same event.
   *
   * Until 2026-10-05 only ONE of the four play paths captured anything — the
   * hero's debut-tape branch — so a visitor who tapped any other night, or
   * landed on a song whose debut has no tape, recorded as "did not play".
   * `version_picker_played_debut` is the numerator of the ratio the front-door
   * experiment turns on, and it was counting a fraction of the plays.
   *
   * That event is left exactly as it was, so its history stays comparable.
   * This one is the honest "pressed play" count. `origin` says which control
   * was used, which `audio_play_started` cannot answer — it carries no song
   * and no origin, so it cannot be attributed to the picker on its own.
   */
  const capturePlayed = (origin: PlayOrigin, isDebut: boolean, queued?: number) => {
    if (!song) return;
    captureEvent("version_picker_played", {
      song_id: song.id,
      song_title: song.title,
      origin,
      is_debut: isDebut,
      ...(queued === undefined ? {} : { queued_count: queued }),
    });
  };

  /** Play the debut; fall through to the top pick when no tape of it exists. */
  const playHero = async () => {
    if (!song) return;
    if (!heroIsDebut || !song.first_played) {
      if (topVersion) await playVersion(topVersion, "hero_top");
      return;
    }
    unlockAudio();
    setHeroResolving(true);
    try {
      // Keep the whole recording, not just its address. findRecordingForDate
      // has already located the track inside it; taking only `.url` threw that
      // away and left the player to re-fetch the same metadata before it could
      // make a sound — seconds of silence after the tap on a phone, and a
      // second chance to fail.
      const tape =
        (ftp?.archiveUrl
          ? { url: ftp.archiveUrl, directTrackUrl: ftp.directTrackUrl ?? null }
          : null) ??
        (await findRecordingForDate(song.title, song.first_played));
      const url = tape?.url ?? null;
      if (url) {
        playSingle({
          id: `picker-ftp-${song.id}`,
          song: { id: song.id, title: song.title },
          version: {
            ...SYNTHETIC_VERSION_DEFAULTS,
            id: `archive-ftp-${song.first_played}`,
            song_id: song.id,
            show_date: song.first_played,
            venue: heroVenue,
            city: heroCity,
            archive_org_url: url,
            description: MILESTONE_LABEL.ftp,
          },
          setNumber: 1,
          position: 0,
          segueToNext: false,
          directTrackUrl: tape?.directTrackUrl ?? null,
        } as PlayableSlot);
        captureEvent("version_picker_played_debut", { song_id: song.id, song_title: song.title });
        capturePlayed("hero_debut", true);
        return;
      }
      if (topVersion) {
        toast.info("No tape of the debut circulates — starting with the next best thing");
        await playVersion(topVersion, "hero_fallback");
      } else {
        toast.info("No tape of this night circulates yet");
      }
    } finally {
      setHeroResolving(false);
    }
  };

  /**
   * Every ranked night placed on the song's own lifespan. Three decades of a
   * song compressed into one line is the fastest way to show that it kept
   * changing — and each dot is playable, so looking is one gesture from
   * listening.
   */
  const arc = useMemo(() => {
    const dated = versions.filter((v) => v.show_date);
    if (dated.length < 2) return null;
    const years = dated.map((v) => Number(v.show_date!.slice(0, 4)));
    const startYear = Math.min(...years, song?.first_played ? Number(song.first_played.slice(0, 4)) : Infinity);
    const endYear = Math.max(...years, song?.last_played ? Number(song.last_played.slice(0, 4)) : -Infinity);
    const span = Math.max(1, endYear - startYear);
    const lead = leaderVotes(versions);
    // Every decade boundary inside the span, so the empty stretches between
    // a debut and a farewell are legible instead of blank.
    const decades: { year: number; pct: number }[] = [];
    for (let y = Math.ceil(startYear / 10) * 10; y <= endYear; y += 10) {
      const pct = 3 + ((y - startYear) / span) * 94;
      if (pct > 8 && pct < 92) decades.push({ year: y, pct });
    }

    return {
      startYear,
      endYear,
      decades,
      points: dated.map((v) => ({
        v,
        // Inset so the end dots are not half off the rail.
        pct: 3 + ((Number(v.show_date!.slice(0, 4)) - startYear) / span) * 94,
        sleeper: isSleeperVersion(v, versions),
        lead: v.votes != null && v.votes === lead,
      })),
    };
  }, [versions, song]);

  /**
   * Play a milestone night — the debut or the last time — when the explorer
   * did not already list it. buildMilestones has resolved the tape by then, so
   * the url is in hand and there is nothing to look up.
   */
  const playMilestone = (m: MilestoneEntry) => {
    if (!song || !m.archiveUrl) return;
    unlockAudio();
    playSingle({
      id: `picker-${song.id}-${m.kind}`,
      song: { id: song.id, title: song.title },
      version: {
        ...SYNTHETIC_VERSION_DEFAULTS,
        id: `archive-picker-${m.kind}`,
        song_id: song.id,
        show_date: m.date,
        venue: m.venue,
        city: m.city,
        archive_org_url: m.archiveUrl,
      },
      setNumber: 1,
      position: 0,
      segueToNext: false,
      directTrackUrl: m.directTrackUrl ?? null,
    } as PlayableSlot);
    capturePlayed(m.kind === "ftp" ? "milestone_first" : "milestone_last", m.kind === "ftp");
  };

  /**
   * Play one version. Most ranked versions carry no archive_org_url — the
   * research recorded the night, not the tape — so the recording is resolved
   * by date on demand rather than making the page wait for 15 lookups.
   */
  const playVersion = async (v: PickerVersion, origin: PlayOrigin = "version") => {
    if (!song || !v.show_date) return;
    unlockAudio();
    let url = v.archive_org_url;
    let directTrackUrl: string | null = null;
    if (!url) {
      setResolving(v.id);
      const tape = await findRecordingForDate(song.title, v.show_date);
      setResolving(null);
      if (!tape?.url) {
        toast.info("No tape of this night circulates yet");
        return;
      }
      url = tape.url;
      directTrackUrl = tape.directTrackUrl ?? null;
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
      directTrackUrl,
    } as PlayableSlot);
    capturePlayed(origin, false);
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
    capturePlayed("play_all", false, withTape.length);
  };

  /** Keep what's on screen as a listening guide, bound tape by tape. */
  const saveAsGuide = async () => {
    if (!song) return;
    if (!user) {
      setInvite("save");
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
      // If nobody had mapped this song yet, the guide becomes its Songbook
      // entry. The database decides — song_id is UNIQUE, so the first guide in
      // wins and a second one is a quiet no-op rather than an error.
      const contribution = await contributeToSongbook({
        songId: song.id,
        setlistId: created.id,
        creatorId: user.id,
      });

      if (contribution.outcome === "added") {
        captureEvent("songbook_entry_contributed", {
          song_id: song.id,
          song_title: song.title,
        });
        // Worth stopping for. Everything else navigates straight on.
        setContributed(created.id);
        return;
      }

      toast.success("Guide saved");
      navigate(`/setlist/${created.id}`);
    } catch (e) {
      console.error("[VersionPicker] save failed", e);
      toast.error("Couldn't keep that guide");
    } finally {
      setSaving(false);
    }
  };

  /** Where /auth sends the reader back to, carrying what they were trying to do. */
  const authHref = (then: InviteIntent) =>
    `/auth?redirect=${encodeURIComponent(`/versions/${slug ?? ""}?then=${then}`)}`;

  /** The share itself, with no gate in front of it. */
  const sendIt = async () => {
    try {
      const url = `${window.location.origin}/versions/${slug ?? ""}`;

      // A share names what is being passed on. It used to go out as
      // "<song> — the versions" with no body at all, so Franklin's Tower
      // arrived looking exactly like every other song on the site.
      const { title, text } = shareVersionsCopy({
        songTitle: song?.title ?? "Dead Set",
        url,
        senderName: profileName,
        timesPlayed: song?.times_played,
        firstPlayed: song?.first_played,
        lastPlayed: song?.last_played,
      });

      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success("Link copied");
      } else {
        toast.info(url);
      }
      captureEvent("version_picker_shared", { song_title: song?.title });
    } catch (e) {
      // AbortError is the reader closing the sheet; anything else is worth a word.
      if ((e as DOMException)?.name !== "AbortError") {
        console.error("[VersionPicker] share failed", e);
        toast.error("Couldn't open the share sheet");
      }
    }
  };

  /** Post the song's card to Instagram, caption and all. */
  const postToInstagram = async () => {
    if (!song) return;
    setInvite(null);
    // Canvas will silently fall back to Times if the faces are not already
    // loaded, so wait for them before drawing.
    await loadCardFonts();
    const imageDataUrl = renderVersionsCard({
      songTitle: song.title,
      timesPlayed: song.times_played,
      firstPlayed: song.first_played,
      lastPlayed: song.last_played,
      nights: shown
        .filter((v) => v.show_date)
        .map((v) => ({ date: v.show_date!, venue: v.venue, city: v.city })),
    }) ?? undefined;
    await shareToInstagram({
      context: "versions",
      songTitle: song.title,
      lifespan: lifespanLine({
        timesPlayed: song.times_played,
        firstPlayed: song.first_played,
        lastPlayed: song.last_played,
      }),
      pageUrl: `${window.location.origin}/versions/${slug ?? ""}`,
      imageDataUrl,
    });
    captureEvent("version_picker_instagram", { song_title: song.title });
  };

  /**
   * Share, gated gently. Signed in, this is a straight pass-through — the
   * people who already joined get no extra tap.
   */
  const share = () => {
    if (!user) {
      setInvite("share");
      return;
    }
    void sendIt();
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
      <main className="mx-auto w-full max-w-3xl px-5 py-8 pb-40">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 font-ticket text-[11px] uppercase tracking-[0.12em] text-foreground/75 hover:text-foreground transition-colors mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Link>

        {/* The cream sheet every reading surface in the app uses. Without it the
            card-surface tokens below render dark text on the maroon ground. */}
        <article className="bg-card text-card-foreground rounded-sm border border-border p-5 md:p-7">

        {/* ── The song, and a way to hear it before reading a word ──── */}
        <header className="mb-7">
          <p className="font-ticket text-[10px] uppercase tracking-[0.18em] text-dead-dark mb-1.5">
            Every version worth knowing
          </p>
          {/* font-header, not font-title: the blackletter is the logo's face and
              is close to unreadable at a song title's size on a phone. */}
          <div className="flex items-start gap-3 mb-3">
            <h1 className="font-header text-[2.1rem] leading-[1.05] md:text-5xl text-card-foreground flex-1 min-w-0">
              {song.title}
            </h1>
            {/* Share lives here, with its name on it. It used to be a bare icon
                circle by the hero date with a second, labelled copy in the
                fixed bottom bar — so the one people actually hit was the one
                sitting under a scrolling thumb. One button, one place, labelled. */}
            <button
              type="button"
              onClick={share}
              className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-full border border-primary/50 bg-primary/10 text-dead-dark hover:bg-primary/20 active:bg-primary/25 transition-colors font-ticket text-[11px] uppercase tracking-[0.1em]"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          </div>

          {/* The life of the song, in three numbers, before anything is asked
              of the reader. */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-5 mb-7 pb-6 border-b border-border">
            {song.times_played != null && (
              <div>
                <dt className="font-ticket text-[10px] uppercase tracking-[0.14em] text-card-foreground/70 mb-0.5">Played</dt>
                <dd className="font-mono text-[1.9rem] font-medium text-card-foreground tabular-nums leading-none">
                  {song.times_played}
                  <span className="font-ticket text-[11px] uppercase tracking-[0.1em] text-card-foreground/70 ml-1.5 align-baseline">times</span>
                </dd>
              </div>
            )}
            {song.first_played && (
              <div>
                <dt className="font-ticket text-[10px] uppercase tracking-[0.14em] text-card-foreground/70 mb-0.5">First played</dt>
                <dd className="font-mono text-[1.9rem] font-medium text-card-foreground tabular-nums leading-none">
                  {song.first_played.slice(0, 4)}
                </dd>
              </div>
            )}
            {song.last_played && (
              <div>
                <dt className="font-ticket text-[10px] uppercase tracking-[0.14em] text-card-foreground/70 mb-0.5">Last played</dt>
                <dd className="font-mono text-[1.9rem] font-medium text-card-foreground tabular-nums leading-none">
                  {song.last_played.slice(0, 4)}
                </dd>
              </div>
            )}
            {versions.length > 0 && (
              <div>
                <dt className="font-ticket text-[10px] uppercase tracking-[0.14em] text-card-foreground/70 mb-0.5">
                  {voted ? "Ranked" : "On this page"}
                </dt>
                <dd className="font-mono text-[1.9rem] font-medium text-card-foreground tabular-nums leading-none">
                  {versions.length}
                </dd>
              </div>
            )}
          </dl>

          {/* One tap, no scrolling, no reading. The whole pitch is that the
              music is one gesture away. */}
          {heroDate && (
            <div className="flex items-center gap-3.5 p-3 rounded-sm bg-gradient-to-r from-primary/[0.14] to-transparent border border-primary/30">
              <button
                type="button"
                onClick={() => void playHero()}
                disabled={heroResolving}
                aria-label={`Play ${song.title}, ${fmtDate(heroDate)}`}
                className="shrink-0 w-[68px] h-[68px] rounded-full grid place-items-center text-[hsl(var(--dead-dark))] shadow-lg transition-transform active:scale-95 disabled:opacity-70"
                style={{ background: "radial-gradient(circle at 34% 30%, hsl(var(--dead-gold)), hsl(38 62% 42%))" }}
              >
                {heroResolving
                  ? <Loader2 className="w-7 h-7 animate-spin" />
                  : <Play className="w-8 h-8 fill-current translate-x-[2px]" />}
              </button>
              <div className="min-w-0">
                <p className="font-ticket text-[10px] uppercase tracking-[0.14em] text-dead-dark mb-0.5">
                  {heroResolving
                  ? "Finding the tape…"
                  : heroIsDebut
                    ? "The very first time they played it"
                    : voted
                      ? "Start with the one they all name"
                      : "Start here"}
                </p>
                <p className="font-hand text-2xl leading-none text-[hsl(var(--dead-blue))]">
                  {fmtDate(heroDate)}
                </p>
                {(heroVenue || heroCity) && (
                  <p className="font-ticket text-[11px] text-muted-foreground mt-0.5 truncate">
                    {heroVenue}{heroVenue && heroCity ? " · " : ""}{heroCity}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Thirty years on one line — where every ranked night actually sits. */}
          {arc && (
            <figure className="mt-7">
              <figcaption className="font-ticket text-[11px] uppercase tracking-[0.14em] text-card-foreground/70 mb-4">
                First played to last played · {voted ? "every ranked night between" : "every night Charlie pulled"}
              </figcaption>

              {/* The two dates every head reaches for, given the ends of the
                  line and their actual size. They used to be two 9px pills at
                  the far corners with the dates in 10px underneath, which made
                  the most-loved thing on the page the quietest. */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <p className="font-ticket text-[11px] uppercase tracking-[0.14em] text-dead-dark">
                    First time played
                  </p>
                  <p className="font-hand text-[1.9rem] leading-none text-[hsl(var(--dead-blue))] mt-1">
                    {song.first_played ? fmtDate(song.first_played) : arc.startYear}
                  </p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="font-ticket text-[11px] uppercase tracking-[0.14em] text-dead-dark">
                    Last time played
                  </p>
                  <p className="font-hand text-[1.9rem] leading-none text-[hsl(var(--dead-blue))] mt-1">
                    {song.last_played ? fmtDate(song.last_played) : arc.endYear}
                  </p>
                </div>
              </div>

              <div className="relative h-12">
                <span className="absolute left-0 right-0 top-[22px] h-px bg-card-foreground/25" />
                {/* The bookends themselves — taller ticks at each end. */}
                <span className="absolute left-0 top-[13px] w-[3px] h-5 rounded-sm bg-primary" />
                <span className="absolute right-0 top-[13px] w-[3px] h-5 rounded-sm bg-primary" />

                {/* Decade marks. The rail was mostly empty between a 1973 debut
                    and a 1995 farewell, and that emptiness said nothing. Now
                    the gap is scaled: you can see which decade a night sits in
                    without counting pixels. */}
                {arc.decades.map((d) => (
                  <span key={d.year} className="absolute" style={{ left: `${d.pct}%` }}>
                    <span className="block w-px h-2.5 bg-card-foreground/25 absolute top-[18px] -translate-x-1/2" />
                    <span className="absolute top-[32px] -translate-x-1/2 font-mono text-[11px] text-card-foreground/75 tabular-nums">
                      {d.year}
                    </span>
                  </span>
                ))}

                {arc.points.map((pt) => (
                  <button
                    key={pt.v.id}
                    type="button"
                    onClick={() => void playVersion(pt.v)}
                    title={`${fmtDate(pt.v.show_date)} — ${pt.v.venue ?? ""}`}
                    aria-label={`Play ${fmtDate(pt.v.show_date)}`}
                    className="absolute top-[22px] -translate-y-1/2 -translate-x-1/2 grid place-items-center w-11 h-11 rounded-full"
                    style={{ left: `${pt.pct}%` }}
                  >
                    <span
                      className="block rounded-full transition-transform hover:scale-125"
                      style={{
                        width: pt.lead ? 16 : pt.sleeper ? 12 : 14,
                        height: pt.lead ? 16 : pt.sleeper ? 12 : 14,
                        background: pt.sleeper
                          ? "hsl(var(--dead-green))"
                          : pt.v.is_benchmark
                            ? "hsl(var(--dead-gold))"
                            : "hsl(var(--dead-blue))",
                        outline: pt.lead ? "2px solid hsl(var(--dead-gold))" : undefined,
                        outlineOffset: 2,
                      }}
                    />
                  </button>
                ))}
              </div>
            </figure>
          )}
        </header>

        {/* ── The Songbook, when this song has an issue ─────────────── */}
        {feature && (feature.headline || feature.dek) && (
          <section className="mb-6 p-4 rounded-sm border-l-[3px] border-[hsl(var(--dead-gold))] bg-[hsl(var(--dead-gold)/0.08)]">
            <p className="font-ticket text-[10px] uppercase tracking-[0.18em] text-dead-dark mb-1.5">
              The Songbook{feature.issue_number != null && ` · Issue ${String(feature.issue_number).padStart(3, "0")}`}
            </p>
            {feature.headline && (
              <h2 className="font-header text-xl leading-tight text-card-foreground mb-1.5">{feature.headline}</h2>
            )}
            {feature.dek && (
              <p className="font-body text-sm leading-relaxed text-muted-foreground max-w-[58ch]">{feature.dek}</p>
            )}
            <Link
              to={`/songbook/${feature.slug}`}
              className="inline-block mt-2.5 font-ticket text-[11px] uppercase tracking-[0.12em] text-dead-dark underline underline-offset-4"
            >
              Read the whole issue →
            </Link>
          </section>
        )}

        {/* ── Charlie, where the poll has nothing ───────────────────── */}
        {!feature && charlie?.linerNotes && (
          <section className="mb-6 p-4 rounded-sm border-l-[3px] border-[hsl(var(--dead-gold))] bg-[hsl(var(--dead-gold)/0.08)]">
            <p className="font-ticket text-[10px] uppercase tracking-[0.18em] text-dead-dark mb-1.5">
              Cosmic Charlie went digging
            </p>
            <p className="font-body text-sm leading-relaxed text-card-foreground/85 max-w-[62ch] whitespace-pre-line">
              {charlie.linerNotes}
            </p>
          </section>
        )}

        {/* ── Why these — the quiet disclosure ──────────────────────── */}
        <section className="mb-7 border-l-[3px] border-[hsl(var(--dead-blue))] bg-[hsl(var(--dead-blue)/0.06)] rounded-r-sm p-3.5">
          <p className="font-body text-[13px] leading-relaxed text-card-foreground/85">
            {voted ? METHOD_LINE : gems.size > 0 ? REGARD_METHOD_LINE : NO_VOTES_LINE}
          </p>
          {voted && (
            <>
              <button
                type="button"
                onClick={() => setMethodOpen((o) => !o)}
                aria-expanded={methodOpen}
                className="mt-1.5 inline-flex items-center gap-1 font-ticket text-[10px] uppercase tracking-[0.14em] text-dead-dark hover:opacity-80 transition-opacity"
              >
                the arithmetic
                <ChevronDown className={`w-3 h-3 transition-transform ${methodOpen ? "rotate-180" : ""}`} />
              </button>
              {methodOpen && (
                <div className="mt-2.5 pt-2.5 border-t border-dashed border-[hsl(var(--dead-blue)/0.3)] space-y-2">
                  <p className="font-body text-[13px] leading-relaxed text-card-foreground/85 max-w-[62ch]">
                    <strong className="text-card-foreground font-medium">★ Era benchmark</strong> — the
                    highest-voted version inside its era.{" "}
                    <strong className="text-card-foreground font-medium">◆ Sleeper</strong> — ranked on the
                    all-time list but polling under 30% of the leader
                    {leader > 0 && <> (fewer than {Math.ceil(cutoff)} votes against {leader})</>}.
                  </p>
                  <p className="font-body text-[13px] leading-relaxed text-card-foreground/85 max-w-[62ch]">
                    Arithmetic on public vote counts, not an opinion we invented. Where no data exists, this
                    page shows the gap rather than filling it with adjectives.
                    {source && (
                      <>
                        {" "}Rankings from{" "}
                        <a
                          href={source.source_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-dead-dark underline underline-offset-2"
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
            <p className="font-ticket text-[10px] uppercase tracking-[0.18em] text-dead-dark mb-1">
              Why you're really here
            </p>
            <h2 className="font-header text-xl md:text-2xl text-card-foreground leading-tight mb-2">
              {theSleepers.length} you probably haven't heard
            </h2>
            <p className="font-body text-sm text-card-foreground/85 max-w-[52ch] mb-3">
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
        {charlieLoading ? (
          <div className="border border-dashed border-border rounded-sm p-6 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
            <p className="font-ticket text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Charlie's going through the crates
            </p>
          </div>
        ) : versions.length === 0 ? (
          <div className="border border-dashed border-border rounded-sm p-5 text-center">
            <p className="font-ticket text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
              Nothing on this one yet
            </p>
            <p className="font-body text-sm text-muted-foreground">
              Nobody has mapped {song.title} across the eras. That gap is the work.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {standalone
              .filter((m) => m.kind === "ftp")
              .map((m) => <MilestoneRow key={m.kind} milestone={m} onPlay={playMilestone} />)}

            {shown.map((v) => {
              const sleeper = isSleeperVersion(v, versions);
              const m = milestoneFor(v);
              const pct = votePercent(v, versions);
              const playing = playingSlot?.version?.show_date === v.show_date;
              return (
                <article
                  key={v.id}
                  className={`rounded-sm border px-4 py-4 sm:px-5 sm:py-5 transition-colors ${
                    playing ? "bg-primary/10 border-primary/45" : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  {/* Play moved to the right of the row and became a disc.
                      It used to be a small outline button stacked underneath,
                      which left the whole right half of every card empty while
                      the date — the thing people are actually here to read —
                      sat at 24px. The night gets the width; the tap gets the
                      corner it can be reached in. */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className={`font-hand text-[2.4rem] sm:text-[2.9rem] leading-[0.95] ${playing ? "text-primary" : "text-[hsl(var(--dead-blue))]"}`}>
                        {fmtDate(v.show_date)}
                      </p>
                      {(v.venue || v.city) && (
                        <p className="font-ticket text-[14px] leading-snug text-card-foreground/80 mt-1.5">
                          {v.venue}{v.city ? ` · ${v.city}` : ""}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={resolving === v.id}
                      onClick={() => void playVersion(v)}
                      aria-label={`Play this version — ${fmtDate(v.show_date)}`}
                      className={`shrink-0 grid place-items-center w-14 h-14 sm:w-16 sm:h-16 rounded-full transition-transform hover:scale-105 active:scale-95 disabled:opacity-60 ${
                        playing
                          ? "bg-primary text-primary-foreground"
                          : "bg-[hsl(var(--dead-gold))] text-dead-dark"
                      }`}
                    >
                      {resolving === v.id ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <Play className="w-6 h-6 fill-current translate-x-[1px]" />
                      )}
                    </button>
                  </div>

                  {v.votes != null && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="block flex-1 max-w-[180px] h-[4px] rounded-sm bg-card-foreground/15 overflow-hidden">
                        <span className="block h-full rounded-sm bg-primary" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="font-mono text-[13px] font-medium text-card-foreground tabular-nums leading-none">
                        {v.votes}
                        <span className="font-ticket text-[10px] uppercase tracking-[0.1em] text-card-foreground/70 ml-1 font-normal">
                          votes
                        </span>
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 flex-wrap mt-3">
                    {v.era_id && eraNames.get(v.era_id) && (
                      <Chip tone="era">{eraNames.get(v.era_id)}</Chip>
                    )}
                    {v.is_benchmark && <Chip tone="canon">★ Era benchmark</Chip>}
                    {sleeper && <Chip tone="sleep">◆ Sleeper</Chip>}
                    {m && <Chip tone="milestone">{MILESTONE_LABEL[m.kind]}</Chip>}
                    {gems.has(v.show_date?.slice(0, 10) ?? "") && (
                      <Chip tone="canon">◆ {QUIET_GEM_CHIP}</Chip>
                    )}
                  </div>

                  {/* card-foreground, not dead-gold: gold on the cream card is
                      2.58:1 — the exact measurement banked in CLAUDE.md after it
                      shipped once. The chip carries the gold, the line carries
                      the evidence. */}
                  {gems.get(v.show_date?.slice(0, 10) ?? "") && (
                    <p className="font-body text-[14px] leading-relaxed text-card-foreground/85 mt-2">
                      {gems.get(v.show_date!.slice(0, 10))}
                    </p>
                  )}

                  {v.blurb && (
                    <p className="font-body text-[15px] leading-relaxed text-card-foreground/85 mt-3 max-w-[62ch]">
                      {v.blurb}
                    </p>
                  )}

                  {resolving === v.id && (
                    <p className="font-ticket text-[12px] text-card-foreground/70 mt-2">Looking for the tape…</p>
                  )}
                </article>
              );
            })}

            {standalone
              .filter((m) => m.kind === "ltp")
              .map((m) => <MilestoneRow key={m.kind} milestone={m} onPlay={playMilestone} />)}
          </div>
        )}
        </article>
      </main>

      {/* ── Keep it / send it ──────────────────────────────────────── */}
      {versions.length > 0 && (
        <div
          className="fixed inset-x-0 z-50 border-t border-border bg-background/95 backdrop-blur px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-[bottom] duration-200"
          style={{ bottom: playerHeight }}
        >
          <div className="mx-auto max-w-3xl flex items-center gap-2">
            <Button
              onClick={() => void saveAsGuide()}
              disabled={saving}
              className="w-full min-h-[48px] bg-primary text-primary-foreground font-ticket text-[11px] uppercase tracking-[0.1em] gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListMusic className="w-3.5 h-3.5" />}
              Keep as a listening guide
            </Button>
          </div>
        </div>
      )}

      {/*
        The Songbook moment. A toast would be wrong here: "Guide saved" is
        bookkeeping, but "a song nobody had written about now has an entry, and
        it is yours" is the whole reason the shelf fills at all. It gets the
        screen for as long as they want it.
      */}
      <Sheet open={contributed !== null} onOpenChange={(open) => {
        if (!open && contributed) navigate(`/setlist/${contributed}`);
      }}>
        <SheetContent
          side="bottom"
          className="bg-card text-card-foreground border-t border-border rounded-t-sm px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <div className="mx-auto w-full max-w-md">
            <SheetHeader className="text-left space-y-2">
              <p className="font-ticket text-[10px] uppercase tracking-[0.18em] text-dead-dark">
                The Songbook · a new entry
              </p>
              <SheetTitle className="font-header text-[1.75rem] leading-tight text-card-foreground">
                {SONGBOOK_ADDED_TITLE}
              </SheetTitle>
              <SheetDescription className="font-body text-[15px] leading-relaxed text-card-foreground/85">
                {SONGBOOK_ADDED_BODY}
              </SheetDescription>
            </SheetHeader>
            <p className="font-hand text-[1.9rem] leading-none text-[hsl(var(--dead-blue))] mt-5">
              {song.title}
            </p>
            <div className="mt-6 space-y-2">
              <Button
                onClick={() => contributed && navigate(`/setlist/${contributed}`)}
                className="w-full min-h-[48px] bg-primary text-primary-foreground font-ticket text-[11px] uppercase tracking-[0.1em]"
              >
                Open the guide
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate("/songbook")}
                className="w-full min-h-[44px] text-card-foreground/80 hover:text-card-foreground hover:bg-card-foreground/5 font-body text-sm"
              >
                See it on the shelf
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* The gate, as an invitation. The page stays on screen behind it. */}
      <SignInInvite
        intent={invite ?? "share"}
        open={invite !== null}
        onOpenChange={(open) => !open && setInvite(null)}
        onSignIn={() => navigate(authHref(invite ?? "share"))}
        onInstagram={invite === "share" ? () => void postToInstagram() : undefined}
        onPlainLink={
          invite === "share"
            ? () => {
                setInvite(null);
                void sendIt();
              }
            : undefined
        }
      />
    </PageLayout>
  );
};

/**
 * A milestone night that is not already in the list — the debut or the last
 * time, when the explorer did not choose it.
 *
 * It used to render the date and stop. If a tape HAD been found it offered no
 * way to hear it, so "July 9, 1995 · Soldier Field" sat there as a dead end on
 * a page whose whole promise is press play — the last time they ever played
 * the song, and no button. Now the tape plays when there is one, and when
 * there isn't the row says so instead of staying silent.
 */
const MilestoneRow = ({
  milestone: m,
  onPlay,
}: {
  milestone: MilestoneEntry;
  onPlay?: (m: MilestoneEntry) => void;
}) => (
  <article className="rounded-sm border border-dashed border-primary/40 bg-primary/[0.04] px-4 py-4 sm:px-5 sm:py-5">
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Chip tone="milestone">{MILESTONE_LABEL[m.kind]}</Chip>
        <p className="font-hand text-[2.4rem] sm:text-[2.9rem] leading-[0.95] text-[hsl(var(--dead-blue))] mt-2">
          {fmtDate(m.date)}
        </p>
        {milestonePlace(m) && (
          <p className="font-ticket text-[14px] leading-snug text-card-foreground/80 mt-1.5">
            {milestonePlace(m)}
          </p>
        )}
      </div>
      {m.tapeFound && onPlay && (
        <button
          type="button"
          onClick={() => onPlay(m)}
          aria-label={`Play this version — ${fmtDate(m.date)}`}
          className="shrink-0 grid place-items-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[hsl(var(--dead-gold))] text-dead-dark transition-transform hover:scale-105 active:scale-95"
        >
          <Play className="w-6 h-6 fill-current translate-x-[1px]" />
        </button>
      )}
    </div>
    {!m.tapeFound && (
      <p className="font-body text-[15px] leading-relaxed text-card-foreground/85 mt-3 italic">{NO_TAPE_LINE}</p>
    )}
  </article>
);

const Chip = ({ tone, children }: { tone: "canon" | "sleep" | "era" | "milestone"; children: React.ReactNode }) => {
  const tones = {
    // Every tone's TEXT is dead-dark (13.66:1 on the cream card). The colour
    // lives in the border and the fill. Gold text here measured 2.58:1, green
    // 3.69:1 and primary 4.09:1 — all under the 4.5:1 bar, all on 11px type
    // with no large-text exemption to lean on.
    canon: "text-dead-dark border-[hsl(var(--dead-gold)/0.7)] bg-[hsl(var(--dead-gold)/0.22)]",
    sleep: "text-dead-dark border-[hsl(var(--dead-green)/0.7)] bg-[hsl(var(--dead-green)/0.22)]",
    era: "text-dead-dark/80 border-border bg-muted/50",
    milestone: "text-dead-dark border-primary/60 bg-primary/15",
  } as const;
  return (
    <span className={`font-ticket text-[11px] uppercase tracking-[0.1em] px-2 py-1 rounded-[2px] border whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
};

export default VersionPicker;
