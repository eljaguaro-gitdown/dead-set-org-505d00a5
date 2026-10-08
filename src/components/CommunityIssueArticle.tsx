import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { shareSongbookCopy } from "@/lib/shareCopy";
import PlayAllNights from "@/components/PlayAllNights";
import SongbookFooterCta from "@/components/SongbookFooterCta";
import ShareDropdown from "@/components/ShareDropdown";
import SafetyMenu from "@/components/SafetyMenu";
import { useAuth } from "@/hooks/useAuth";
import {
  communityPlaylist,
  communityFindings,
  communitySlot,
  communityShareText,
  type CommunityIssue,
} from "@/lib/communityIssue";

/**
 * A Songbook issue the community wrote, presented as the editorial issues are.
 *
 * Deliberately shares the curated issue's class strings rather than inventing a
 * second look: the point of the shelf is that a guide somebody built sits
 * beside Vol. 1, not in a lesser frame. What differs is only what is honestly
 * different — the eyebrow credits the author instead of an issue number, and
 * the body is the nights they chose rather than an essay nobody wrote.
 */

/** `1978-08-31` -> `Aug 31, 1978`, matching how the curated issues read. */
/**
 * A display name is whatever someone typed, and some of them end in a period
 * ("Rosalie M."). Appending another gives "Rosalie M..", on a page that is
 * mostly a credit to that person.
 */
export const sentenceEnd = (name: string): string =>
  /[.!?]$/.test(name.trim()) ? "" : ".";

export const formatIssueDate = (iso: string | null): string => {
  if (!iso) return "—";
  // Noon UTC, so a date-only value cannot slip a day in a western timezone.
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

const CommunityIssueArticle = ({ issue }: { issue: CommunityIssue }) => {
  const { playSingle, playSetlist, playingSlot } = useAudioPlayer();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwner = !!user && user.id === issue.creatorId;
  /**
   * Resolving a guide takes seconds, and with nothing on screen people tap
   * again — which abandons the run in flight and restarts the wait. The label
   * stays a constant width and only the 12px icon swaps, because a busy state
   * that grows a control has pushed things off a 320px screen here before.
   */
  const [cueing, setCueing] = useState(false);
  const shareUrl = `https://dead-set.org/songbook/${issue.slug}`;
  /**
   * Oldest first, matching communityPlaylist — the song walking forward
   * through the years, which is how the curated ladder reads too.
   *
   * These were rendered in the author's slot order while the queue sorted by
   * date, so Play all played the nights in a different order from the one on
   * screen: Eyes lists Jun 15 1993 above Jun 17 1991 and would have played
   * them the other way round. Found by rendering the page, not by reading it.
   */
  const dated = issue.nights
    .filter((n) => n.showDate)
    .sort((a, b) => (a.showDate ?? "").localeCompare(b.showDate ?? ""));
  /**
   * The queue IS the count — see PlayAllNights. Built once here so the button,
   * the tap handler and the label can never describe different sets.
   */
  const playQueue = useMemo(() => communityPlaylist(issue), [issue]);
  /** Derived from the picks, never written for them — see communityFindings. */
  const findings = useMemo(() => communityFindings(issue), [issue]);

  const playAll = async () => {
    if (cueing) return;
    setCueing(true);
    try {
      const slots = playQueue;
      if (slots.length === 0) {
        toast.info("No tape of these nights circulates yet");
        return;
      }
      await playSetlist(slots);
    } catch {
      // "Could not ask the Archive" is an admission about the network, not an
      // answer about the music. The two must not collapse into one message.
      toast.error("Couldn't reach the Archive — try again");
    } finally {
      setCueing(false);
    }
  };

  /**
   * The first and last nights a song was ever played are DATES, and a date is
   * all the resolver needs — it looks the night up on the Archive. We printed
   * both and offered neither, which is the one thing a Songbook page should
   * never do: name a night and then make you go find it yourself.
   */
  const playByDate = async (date: string | null, label: string, which: "ftp" | "ltp") => {
    if (!date) return;
    try {
      await playSingle(
        communitySlot(
          issue,
          {
            // DISTINCT per control. communitySlot derives the id from the
            // position, so giving both buttons the same one made them the same
            // slot to the player — and playSingle's SUCCESS path is guarded by
            // slot id, not by sequence. Tap first-played, tap last-played
            // before it resolves, and the late first-played result was applied
            // to the last-played tap: the wrong night, from the right-looking
            // button. The window is one Archive resolve, and the two controls
            // sit side by side on a phone.
            position: which === "ftp" ? -1 : -2,
            showDate: date,
            venue: label || null,
            archiveUrl: null,
            note: "",
          },
        ),
      );
    } catch {
      toast.error("Couldn't reach the Archive — try again");
    }
  };

  const playNight = async (night: (typeof issue.nights)[number]) => {
    // Only a night we can neither find nor name is refused here. Saying "no
    // tape circulates" about a night nobody has looked up yet is an answer we
    // have not earned — the resolver asks the Archive, and its two failure
    // modes are kept apart in the catch below.
    if (!night.archiveUrl && !night.showDate) {
      toast.info("No tape of this night circulates yet");
      return;
    }
    try {
      await playSingle(communitySlot(issue, night));
    } catch {
      toast.error("Couldn't reach the Archive — try again");
    }
  };

  /**
   * Parity with the curated issue, which sets these too. Honest caveat: a
   * crawler does not run JS, so this does NOT give a rich unfurl — that needs
   * the og-image function to serve meta for /songbook/:slug server-side, which
   * neither page has. What it does do is give the in-app and OS share sheets,
   * which read the live DOM, the issue's own title rather than the app's.
   */
  useEffect(() => {
    const title = `${issue.title} — The Songbook · Dead Set`;
    const desc = communityShareText(issue);
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
    set("description", desc);
    set("og:title", title);
    set("og:description", desc);
    set("og:url", shareUrl);
    set("twitter:title", title);
    set("twitter:description", desc);
  }, [issue, shareUrl]);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 md:px-6 py-8 md:py-12">
      <div className="flex items-center justify-between gap-3 mb-7">
        <Link
          to="/songbook"
          className="inline-flex items-center gap-2 text-sm text-foreground/75 hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> The Songbook
        </Link>
        <div className="flex items-center gap-1">
          {/* App Store guideline 1.2: this page publishes what a fan wrote (their
              name, their note on each night), so it carries the same report and
              block as the setlist it came from. The shelf used to open
              /setlist/:id, which has them; when it started opening this page
              instead, the controls stayed behind. Signed-out visitors see it
              too, because a reviewer starts signed out; submitting a report or
              a block then tells them to sign in, as on /setlist/:id. */}
          {!isOwner && (
            <SafetyMenu
              contentType="setlist"
              contentId={issue.setlistId}
              reportLabel="this guide"
              ownerId={issue.creatorId}
              ownerName={issue.mappedBy}
              // Blocking hides the guide from the blocker, so this page would
              // stop resolving under them. Back to the shelf instead.
              onBlocked={() => navigate("/songbook")}
              className="min-h-[44px] min-w-[44px]"
            />
          )}
          <ShareDropdown
            url={shareUrl}
            title={`${issue.title} — The Songbook`}
            share={shareSongbookCopy({
              songTitle: issue.title,
              url: shareUrl,
              mappedBy: issue.mappedBy,
              nightCount: dated.length,
              timesPlayed: issue.timesPlayed,
              firstPlayed: issue.firstPlayed,
              lastPlayed: issue.lastPlayed,
            })}
          />
        </div>
      </div>

      <article className="bg-card text-card-foreground rounded-sm border border-border p-5 md:p-10">
        <header className="pb-6 border-b-2 border-dashed border-primary/35 mb-7">
          <p className="font-ticket text-[10px] uppercase tracking-[0.2em] text-primary mb-3">
            The Songbook · From the community
          </p>
          <h1 className="font-header text-4xl md:text-6xl leading-none mb-4">{issue.title}</h1>
          <p className="font-hand text-2xl md:text-4xl text-[hsl(var(--dead-blue))] leading-tight">
            First mapped by {issue.mappedBy}{sentenceEnd(issue.mappedBy)}
          </p>

          <PlayAllNights slots={playQueue} cueing={cueing} onPlay={playAll} />
        </header>

        {/* The same lifespan block as a curated issue. Venue and city are absent
            on purpose — songs carries dates only, and a guessed venue beside a
            real date is worse than no venue. */}
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-6 mb-8 pb-7 border-b border-dashed border-border">
          <div>
            <span className="block font-ticket text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--dead-gold))]">
              First played <em className="not-italic text-muted-foreground">(FTP)</em>
            </span>
            <button
              type="button"
              onClick={() => playByDate(issue.firstPlayed, issue.firstPlayedVenue ?? "", "ftp")}
              disabled={!issue.firstPlayed}
              className="group mt-0.5 flex items-center gap-2 text-left disabled:cursor-default"
              /* Not "Play <title>, …": that prefix belongs to the night rows, and a
                 shared prefix makes both unselectable in a test and ambiguous aloud. */
              aria-label={
                issue.firstPlayed
                  ? `First played ${formatIssueDate(issue.firstPlayed)} — play this night`
                  : "First played — not known"
              }
            >
              {issue.firstPlayed && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dead-dark/40 text-dead-dark transition-colors group-hover:bg-dead-dark group-hover:text-dead-cream">
                  <Play className="h-2.5 w-2.5" />
                </span>
              )}
              <span className="font-hand text-2xl md:text-3xl leading-tight">
                {formatIssueDate(issue.firstPlayed)}
              </span>
            </button>
            {issue.firstPlayedVenue && (
              <span className="block font-ticket text-[11px] text-muted-foreground leading-relaxed">
                {issue.firstPlayedVenue}
              </span>
            )}
          </div>

          <div className="flex md:flex-col items-center justify-center gap-3 md:gap-1 md:px-6 md:border-x border-dashed border-border py-3 md:py-0">
            <span className="font-mono text-3xl md:text-4xl text-primary tabular-nums leading-none">
              {issue.timesPlayed ?? "—"}
            </span>
            <span className="font-ticket text-[9px] uppercase tracking-[0.1em] text-muted-foreground md:text-center leading-snug">
              times played
            </span>
          </div>

          <div className="md:text-right">
            <span className="block font-ticket text-[9px] uppercase tracking-[0.16em] text-[hsl(var(--dead-gold))]">
              Last played <em className="not-italic text-muted-foreground">(LTP)</em>
            </span>
            <button
              type="button"
              onClick={() => playByDate(issue.lastPlayed, issue.lastPlayedVenue ?? "", "ltp")}
              disabled={!issue.lastPlayed}
              className="group mt-0.5 flex items-center gap-2 text-left md:ml-auto md:flex-row-reverse disabled:cursor-default"
              aria-label={
                issue.lastPlayed
                  ? `Last played ${formatIssueDate(issue.lastPlayed)} — play this night`
                  : "Last played — not known"
              }
            >
              {issue.lastPlayed && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-dead-dark/40 text-dead-dark transition-colors group-hover:bg-dead-dark group-hover:text-dead-cream">
                  <Play className="h-2.5 w-2.5" />
                </span>
              )}
              <span className="font-hand text-2xl md:text-3xl leading-tight">
                {formatIssueDate(issue.lastPlayed)}
              </span>
            </button>
            {issue.lastPlayedVenue && (
              <span className="block font-ticket text-[11px] text-muted-foreground leading-relaxed">
                {issue.lastPlayedVenue}
              </span>
            )}
          </div>
        </div>

        {/* The body of a community issue is the guide itself. */}
        <p className="font-body text-[15px] md:text-base leading-[1.75] text-card-foreground/85 mb-6 max-w-[66ch]">
          {dated.length > 0 ? (
            <>
              {issue.mappedBy} mapped {issue.title} across{" "}
              <strong className="text-card-foreground font-medium">
                {dated.length} {dated.length === 1 ? "night" : "nights"}
              </strong>
              . These are the ones they picked.
              {findings && <> {findings}</>}
            </>
          ) : (
            <>
              {issue.mappedBy} was the first to map {issue.title}. The guide is on
              the shelf; the nights are listed on it.
            </>
          )}
        </p>

        {dated.length > 0 && (
          <ol className="space-y-4 mb-8">
            {dated.map((night) => (
              <li
                key={`${night.position}-${night.showDate ?? "undated"}`}
                className="pl-4 border-l-2 border-dashed border-primary/35"
              >
                <button
                  type="button"
                  onClick={() => playNight(night)}
                  className="group flex w-full items-start gap-2.5 text-left"
                  aria-label={`Play ${issue.title}, ${formatIssueDate(night.showDate)}`}
                >
                  <span
                    className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      playingSlot?.version?.show_date === night.showDate
                        ? "border-dead-dark bg-dead-dark text-dead-cream"
                        : "border-dead-dark/40 text-dead-dark group-hover:bg-dead-dark group-hover:text-dead-cream"
                    }`}
                  >
                    <Play className="h-3 w-3" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-hand text-xl md:text-2xl leading-tight text-card-foreground">
                      {formatIssueDate(night.showDate)}
                    </span>
                    {night.venue && (
                      <span className="block font-ticket text-[11px] text-muted-foreground leading-relaxed">
                        {night.venue}
                      </span>
                    )}
                  </span>
                </button>
                {night.note && (
                  <p className="font-body text-[15px] leading-[1.7] text-card-foreground/85 mt-1 ml-[38px] max-w-[66ch]">
                    {night.note}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}

        <div className="mt-10 pt-8 border-t-2 border-dashed border-primary/35">
          <p className="font-ticket text-[11px] text-muted-foreground mt-4 leading-relaxed">
            The tapes are on the Internet Archive, put there by tapers and
            traders. The map through them is {issue.mappedBy}'s.
          </p>
        </div>
      </article>

      <SongbookFooterCta />
    </main>
  );
};

export default CommunityIssueArticle;
