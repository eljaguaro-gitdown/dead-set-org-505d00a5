import { toast } from "sonner";
import { trackShare } from "./trackShare";

interface ShareSongInput {
  songTitle: string;
  showDate?: string | null;
  venue?: string | null;
  archiveOrgUrl?: string | null;
}

/**
 * Share a favorite song (optionally tied to a specific live version).
 * Uses the native share sheet when available, otherwise copies a
 * pre-formatted message to the clipboard.
 */
export async function shareSong(input: ShareSongInput): Promise<void> {
  const { songTitle, showDate, venue, archiveOrgUrl } = input;

  const versionLine = showDate
    ? `${showDate}${venue ? ` · ${venue}` : ""}`
    : null;

  const link = archiveOrgUrl || "https://dead-set.org";

  const title = versionLine
    ? `${songTitle} — ${versionLine}`
    : `${songTitle} on Dead-Set.Org`;

  const text = versionLine
    ? `🌹 ${songTitle} — ${versionLine}\n\nFound this gem on Dead-Set.Org. The music never stops ⚡\n\n${link}`
    : `🌹 ${songTitle} — one of my favorite Dead songs.\n\nBuild your dream show on Dead-Set.Org ⚡\n\n${link}`;

  // Try native share first (mobile)
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text, url: link });
      trackShare({
        shareType: "setlist",
        channel: "native_share",
        metadata: { kind: "favorite_song", song: songTitle, archiveOrgUrl: archiveOrgUrl ?? null },
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
    metadata: { kind: "favorite_song", song: songTitle, archiveOrgUrl: archiveOrgUrl ?? null },
  });

  toast.success("Copied! Paste anywhere to share 🌹");
}
