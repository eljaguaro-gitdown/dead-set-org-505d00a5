import { toast } from "sonner";
import { trackShare } from "./trackShare";

interface ShareSongInput {
  favoriteSongId?: string | null;
  songId?: string | null;
  notableVersionId?: string | null;
  songTitle: string;
  showDate?: string | null;
  venue?: string | null;
  archiveOrgUrl?: string | null;
}

const SITE_ORIGIN = "https://dead-set.org";

/**
 * Share a song as a Dead-Set.Org deep link. The /song/:songId route auto-plays
 * the version and gives the recipient a landing page on our site (not archive.org).
 */
export async function shareSong(input: ShareSongInput): Promise<void> {
  const { songId, notableVersionId, songTitle, showDate, venue } = input;

  if (!songId) {
    toast.error("Couldn't build a share link for this song.");
    return;
  }

  const params = new URLSearchParams();
  if (notableVersionId) params.set("v", notableVersionId);
  if (showDate) params.set("d", showDate);
  if (venue) params.set("venue", venue);

  const link = `${SITE_ORIGIN}/song/${songId}${params.toString() ? `?${params.toString()}` : ""}`;

  const versionLine = showDate ? `${showDate}${venue ? ` · ${venue}` : ""}` : null;
  const title = versionLine ? `${songTitle} — ${versionLine}` : `${songTitle} on Dead-Set.Org`;
  const text = versionLine
    ? `🌹 ${songTitle} — ${versionLine}\n\nListen on Dead-Set.Org ⚡\n\n${link}`
    : `🌹 ${songTitle}\n\nListen on Dead-Set.Org ⚡\n\n${link}`;

  // Native share (mobile)
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url: link });
      trackShare({
        shareType: "setlist",
        channel: "native_share",
        metadata: { kind: "favorite_song", song: songTitle, link },
      });
      return;
    } catch {
      // user cancelled — fall through to clipboard
    }
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  trackShare({
    shareType: "setlist",
    channel: "copy_link",
    metadata: { kind: "favorite_song", song: songTitle, link },
  });

  toast.success("Link copied! Paste anywhere to share 🌹");
}
