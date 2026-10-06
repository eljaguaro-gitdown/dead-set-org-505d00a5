import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trackShare } from "./trackShare";
import { shareSongCopy } from "./shareCopy";

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

async function getSenderName(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();
    return (data as { display_name?: string | null } | null)?.display_name?.trim() || null;
  } catch {
    return null;
  }
}

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

  const senderName = await getSenderName();

  const params = new URLSearchParams();
  if (notableVersionId) params.set("v", notableVersionId);
  if (showDate) params.set("d", showDate);
  if (venue) params.set("venue", venue);
  if (senderName) params.set("from", senderName);

  const link = `${SITE_ORIGIN}/song/${songId}${params.toString() ? `?${params.toString()}` : ""}`;

  // The copy lives in @/lib/shareCopy, not here — see the rule at the top of
  // that module. Every share surface sells what it is through the same builder.
  const { title, text } = shareSongCopy({
    songTitle,
    url: link,
    senderName,
    showDate,
    venue,
  });

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
