import { supabase } from "@/integrations/supabase/client";
import { captureEvent, captureException } from "@/lib/posthog";

export type ShareType = "app_link" | "setlist" | "poster" | "songbook";
type ShareChannel =
  | "copy_link"
  | "twitter"
  | "facebook"
  | "tiktok"
  | "instagram"
  | "native_share"
  | "sms"
  | "whatsapp"
  | "email"
  | "download_plate";

interface TrackShareOptions {
  shareType: ShareType;
  channel: ShareChannel;
  setlistId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Pull a setlist id out of a canonical share URL.
 *
 * `share_events.setlist_id` is what ties a share to the thing shared, and
 * therefore to the inbound visitors who later land on `/setlist/<id>`. Without
 * it a share is an unattributable tally mark.
 *
 * This DERIVES the id from the url the sharing component already holds rather
 * than taking it as a prop, because a prop is a thing a caller can forget —
 * and that is exactly what happened: `ShareFlow` passed `setlistId` on every
 * channel while `ShareDropdown` passed it on none, so every share through the
 * dropdown (the one on the save-celebration, the poster and the songbook)
 * logged `setlist_id: null`. Two share surfaces, one instrumented.
 *
 * A url that is not a setlist url (e.g. `/songbook/<slug>`) correctly yields
 * undefined — it is not a setlist and must not be attributed to one.
 */
export const setlistIdFromShareUrl = (url: string): string | undefined => {
  const match = url.match(
    /\/setlist\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i,
  );
  return match ? match[1].toLowerCase() : undefined;
};

/**
 * What kind of thing a share url points at, for `share_events.share_type`.
 *
 * Derived for the same reason as setlistIdFromShareUrl: the dropdown and the
 * DM dialog hard-coded "setlist", so every Songbook issue shared through them
 * was recorded as a setlist share with no setlist. That hid Songbook sharing
 * and read as a tracking bug in the setlist numbers (e.g. /songbook/althea on
 * 2026-10-06).
 */
export const shareTypeFromShareUrl = (url: string): "setlist" | "songbook" =>
  /\/songbook\//i.test(url) ? "songbook" : "setlist";

/** Fire-and-forget share event logger */
export const trackShare = async ({
  shareType,
  channel,
  setlistId,
  metadata,
}: TrackShareOptions) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const visitorId = localStorage.getItem("ds_visitor_id") || undefined;

    await supabase.from("share_events").insert([{
      user_id: user?.id ?? null,
      visitor_id: visitorId ?? null,
      share_type: shareType,
      channel,
      setlist_id: setlistId ?? null,
      metadata: (metadata as Record<string, string>) ?? null,
    }]);

    captureEvent("setlist_shared", {
      share_type: shareType,
      channel,
      setlist_id: setlistId,
    });
  } catch (error) {
    captureException(error, { flow: "share_tracking", channel, share_type: shareType });
    // Silent fail — never block UX for analytics
  }
};
