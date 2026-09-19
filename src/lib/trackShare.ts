import { supabase } from "@/integrations/supabase/client";
import { captureEvent, captureException } from "@/lib/posthog";

type ShareType = "app_link" | "setlist" | "poster";
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
