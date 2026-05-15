import { toast } from "sonner";
import { trackShare } from "./trackShare";
import { supabase } from "@/integrations/supabase/client";

interface ShareSongInput {
  songId?: string | null;
  notableVersionId?: string | null;
  songTitle: string;
  showDate?: string | null;
  venue?: string | null;
  archiveOrgUrl?: string | null;
}

/**
 * Share a favorite song. Always resolves a deep link to a specific
 * recording on archive.org — falling back to the song's top notable
 * version if no version was supplied. Only as a last resort do we
 * link to the dead-set.org home page.
 */
export async function shareSong(input: ShareSongInput): Promise<void> {
  const { songId, notableVersionId, songTitle } = input;
  let { showDate, venue, archiveOrgUrl } = input;

  // Resolve the exact saved version first; only use a song-level fallback when no date/version was saved.
  if (!archiveOrgUrl && notableVersionId) {
    try {
      const { data } = await supabase
        .from("notable_versions")
        .select("archive_org_url, show_date, venue")
        .eq("id", notableVersionId)
        .not("archive_org_url", "is", null)
        .maybeSingle();
      if (data?.archive_org_url) {
        archiveOrgUrl = data.archive_org_url;
        showDate = showDate ?? data.show_date ?? null;
        venue = venue ?? data.venue ?? null;
      }
    } catch {
      // ignore — fall through to home link
    }
  }

  if (!archiveOrgUrl && songId && showDate) {
    try {
      let query = supabase
        .from("notable_versions")
        .select("archive_org_url, show_date, venue")
        .eq("song_id", songId)
        .eq("show_date", showDate)
        .not("archive_org_url", "is", null)
        .limit(5);

      if (venue) query = query.ilike("venue", `%${venue}%`);

      const { data } = await query;
      const exact = data?.[0];
      if (exact?.archive_org_url) {
        archiveOrgUrl = exact.archive_org_url;
        venue = venue ?? exact.venue ?? null;
      }
    } catch {
      // ignore — fall through to song-level fallback
    }
  }

  if (!archiveOrgUrl && songId && !showDate && !notableVersionId) {
    try {
      const { data } = await supabase
        .from("notable_versions")
        .select("archive_org_url, show_date, venue")
        .eq("song_id", songId)
        .not("archive_org_url", "is", null)
        .order("show_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.archive_org_url) {
        archiveOrgUrl = data.archive_org_url;
        showDate = data.show_date ?? null;
        venue = data.venue ?? null;
      }
    } catch {
      // ignore — fall through to home link
    }
  }

  let trackUrl: string | null = null;
  if (archiveOrgUrl) {
    try {
      const { data } = await supabase.functions.invoke("resolve-song-share", {
        body: { archiveOrgUrl, songTitle },
      });
      trackUrl = typeof data?.directTrackUrl === "string" ? data.directTrackUrl : null;
    } catch {
      trackUrl = null;
    }
  }

  const versionLine = showDate
    ? `${showDate}${venue ? ` · ${venue}` : ""}`
    : null;

  const link = trackUrl || archiveOrgUrl || "https://dead-set.org";

  const title = versionLine
    ? `${songTitle} — ${versionLine}`
    : `${songTitle} on Dead-Set.Org`;

  const text = archiveOrgUrl
    ? versionLine
      ? `🌹 ${songTitle} — ${versionLine}\n\nListen to this version on archive.org. Found via Dead-Set.Org ⚡\n\n${link}`
      : `🌹 ${songTitle}\n\nListen to this recording on archive.org. Found via Dead-Set.Org ⚡\n\n${link}`
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

  toast.success(archiveOrgUrl ? "Link copied! Paste anywhere to share 🌹" : "Copied! Paste anywhere to share 🌹");
}
