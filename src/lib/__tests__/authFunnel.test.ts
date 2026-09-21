import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackAuthEvent, buildAuthEventRow } from "@/lib/authFunnel";

describe("trackAuthEvent", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("posts with keepalive, so the event survives the OAuth redirect", async () => {
    // The invariant this whole module exists for: oauth_redirect_started fires
    // immediately before the tab navigates away. Without keepalive the request
    // is cancelled and the funnel under-counts starts — which is exactly what
    // happened (42 recorded starts against 56 returns).
    await trackAuthEvent("oauth_redirect_started", { provider: "google" });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.keepalive).toBe(true);
    expect(init.method).toBe("POST");
  });

  it("never throws when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(trackAuthEvent("auth_modal_opened")).resolves.toBeUndefined();
  });

  it("builds a row matching the auth_events columns", () => {
    const row = buildAuthEventRow("oauth_returned", {
      provider: "apple",
      userId: "user-1",
      metadata: { isFreshAccount: true },
    });
    expect(row).toMatchObject({
      event_name: "oauth_returned",
      provider: "apple",
      user_id: "user-1",
      metadata: { isFreshAccount: true },
    });
  });
});
