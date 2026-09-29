import { describe, it, expect, vi, beforeEach } from "vitest";

const { captureEvent, getUser, insert } = vi.hoisted(() => ({
  captureEvent: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({ captureEvent }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser },
    from: () => ({ insert }),
  },
}));

import { trackCtaClick } from "@/lib/trackCtaClick";

describe("trackCtaClick", () => {
  beforeEach(() => {
    captureEvent.mockReset();
    getUser.mockReset().mockResolvedValue({ data: { user: null } });
    insert.mockReset().mockResolvedValue({ error: null });
  });

  it("captures landing_cta_clicked synchronously, before the Supabase round-trip", () => {
    // Callers navigate on the same click. The PostHog event has to be queued
    // before the first await, or a fast navigation drops it.
    void trackCtaClick("hero_build_setlist_guest", "/builder");

    expect(captureEvent).toHaveBeenCalledTimes(1);
    expect(captureEvent).toHaveBeenCalledWith("landing_cta_clicked", {
      cta_id: "hero_build_setlist_guest",
      destination: "/builder",
      page: window.location.pathname,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("still writes the share_events cta_click row", async () => {
    await trackCtaClick("hero_browse_community", "/browse");

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ share_type: "cta_click", channel: "hero_browse_community" }),
    );
  });

  it("never throws when PostHog or Supabase fail", async () => {
    captureEvent.mockImplementation(() => {
      throw new Error("posthog down");
    });
    getUser.mockRejectedValue(new Error("offline"));

    await expect(trackCtaClick("hero_songbook_play", "audio")).resolves.toBeUndefined();
  });
});
