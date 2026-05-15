import { toast } from "sonner";
import { trackShare } from "./trackShare";
import { supabase } from "@/integrations/supabase/client";

interface ShareSongInput {
  favoriteSongId?: string | null;
  songId?: string | null;
  notableVersionId?: string | null;
  songTitle: string;
  showDate?: string | null;
  venue?: string | null;
  archiveOrgUrl?: string | null;
}

const readArchiveMeta = (notes?: string | null) => {
  if (!notes?.trim().startsWith("{")) return null;
  try {
    const firstLine = notes.split("\n")[0];
    const meta = JSON.parse(firstLine);
    return meta?.__archive ? meta as { show_date?: string; venue?: string; archive_org_url?: string } : null;
  } catch {
    return null;
  }
};

/**
 * Share a favorite song. Always resolves a deep link to a specific
 * recording on archive.org — falling back to the song's top notable
 * version if no version was supplied. If no exact recording exists,
 * the share is blocked instead of falling back to the app home page.
 */
export async function shareSong(input: ShareSongInput): Promise<void> {
  const { favoriteSongId, songId, notableVersionId, songTitle } = input;
  let { showDate, venue, archiveOrgUrl } = input;

  if ((!archiveOrgUrl || !showDate) && favoriteSongId) {
    try {
      const { data: slot } = await (supabase as any)
        .from("setlist_slots")
        .select("notes, notable_version_id")
        .eq("favorite_song_id", favoriteSongId)
        .maybeSingle();

      const meta = readArchiveMeta(slot?.notes);
      if (meta?.archive_org_url) {
        archiveOrgUrl = archiveOrgUrl ?? meta.archive_org_url;
        showDate = showDate ?? meta.show_date ?? null;
        venue = venue ?? meta.venue ?? null;
      } else if (!archiveOrgUrl && slot?.notable_version_id) {
        const { data: version } = await supabase
          .from("notable_versions")
          .select("archive_org_url, show_date, venue")
          .eq("id", slot.notable_version_id)
          .not("archive_org_url", "is", null)
          .maybeSingle();
        if (version?.archive_org_url) {
          archiveOrgUrl = version.archive_org_url;
          showDate = showDate ?? version.show_date ?? null;
          venue = venue ?? version.venue ?? null;
        }
      }
    } catch {
      // continue to the explicit saved version data below
    }
  }

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
        body: { archiveOrgUrl, songTitle, showDate, venue },
      });
      trackUrl = typeof data?.directTrackUrl === "string" ? data.directTrackUrl : null;
    } catch {
      trackUrl = null;
    }
  }

  // Verify: must be a specific archive.org track download URL — never the app/home URL.
  const isArchiveTrackUrl = (u: string | null | undefined): u is string => {
    if (!u) return false;
    try {
      const parsed = new URL(u);
      if (!/(^|\.)archive\.org$/i.test(parsed.hostname)) return false;
      // /download/<identifier>/<file.ext> is a specific track
      const m = parsed.pathname.match(/^\/download\/[^/]+\/[^/]+\.[a-z0-9]+$/i);
      return !!m;
    } catch {
      return false;
    }
  };

  if (!isArchiveTrackUrl(trackUrl)) {
    toast.error("Couldn't resolve a direct archive.org track for this song yet.");
    return;
  }

  const versionLine = showDate
    ? `${showDate}${venue ? ` · ${venue}` : ""}`
    : null;

  const link = trackUrl;

  const title = versionLine
    ? `${songTitle} — ${versionLine}`
    : `${songTitle} on Dead-Set.Org`;

  const text = archiveOrgUrl
    ? versionLine
      ? `🌹 ${songTitle} — ${versionLine}\n\nListen to this version on archive.org. Found via Dead-Set.Org ⚡\n\n${link}`
      : `🌹 ${songTitle}\n\nListen to this recording on archive.org. Found via Dead-Set.Org ⚡\n\n${link}`
    : `🌹 ${songTitle}\n\nListen to this recording on archive.org. Found via Dead-Set.Org ⚡\n\n${link}`;

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
