import { beforeEach, describe, expect, it, vi } from "vitest";

// A realtime client that behaves like realtime-js 2.110: channel(topic) hands
// back the registered channel for a topic until removeChannel deregisters it.
const registry = vi.hoisted(() => ({
  channels: [] as any[],
  made: [] as any[],
  untrackDelay: 0,
}));

vi.mock("@/integrations/supabase/client", () => {
  const makeChannel = (topic: string) => {
    const ch: any = {
      topic,
      subscribeCalls: 0,
      tracked: [] as unknown[],
      on() {
        return ch;
      },
      subscribe(cb: (s: string) => void) {
        ch.subscribeCalls += 1;
        if (ch.subscribeCalls > 1) throw new Error("tried to subscribe multiple times");
        queueMicrotask(() => cb("SUBSCRIBED"));
        return ch;
      },
      track: async (p: unknown) => {
        ch.tracked.push(p);
      },
      untrack: () => new Promise((r) => setTimeout(r, registry.untrackDelay)),
      presenceState: () => ({}),
    };
    return ch;
  };
  return {
    supabase: {
      channel: (name: string) => {
        const topic = `realtime:${name}`;
        const existing = registry.channels.find((c) => c.topic === topic);
        if (existing) return existing;
        const ch = makeChannel(topic);
        registry.channels.push(ch);
        registry.made.push(ch);
        return ch;
      },
      removeChannel: async (ch: any) => {
        registry.channels = registry.channels.filter((c) => c !== ch);
      },
      realtime: { isConnected: () => true },
    },
  };
});

const payload = (page: string) => ({
  visitor_id: "v1",
  user_id: null,
  display_name: null,
  avatar_url: null,
  page,
  joined_at: new Date().toISOString(),
  beat_at: new Date().toISOString(),
});

describe("reconnectPresenceChannel", () => {
  beforeEach(() => {
    vi.resetModules();
    registry.channels = [];
    registry.made = [];
    registry.untrackDelay = 50;
  });

  it("a beat during teardown does not resubscribe the dying channel", async () => {
    const mod = await import("@/lib/presenceChannel");
    await mod.trackPresence(payload("/a"));
    const first = registry.made[0];

    const reconnect = mod.reconnectPresenceChannel();
    // The 30 s heartbeat lands while untrack is still in flight.
    await mod.trackPresence(payload("/b"));
    await reconnect;

    expect(first.subscribeCalls).toBe(1);
    expect(registry.made).toHaveLength(2);
    const second = registry.made[1];
    expect(second).not.toBe(first);
    expect(registry.channels).toEqual([second]);
    expect((second.tracked.at(-1) as { page: string }).page).toBe("/b");
  });

  it("focus and visibilitychange together tear down once", async () => {
    const mod = await import("@/lib/presenceChannel");
    await mod.trackPresence(payload("/a"));
    await Promise.all([mod.reconnectPresenceChannel(), mod.reconnectPresenceChannel()]);
    expect(registry.made).toHaveLength(2);
    expect(registry.channels).toHaveLength(1);
  });
});
