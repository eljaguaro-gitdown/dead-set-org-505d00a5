import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { summarizePresence } from "@/lib/presenceSummary";

/**
 * Shared presence channel singleton.
 *
 * All consumers (broadcaster + listeners) MUST use this single channel
 * instance. Supabase JS will collapse multiple `supabase.channel(name)` calls
 * into separate channel objects that fight over the same socket subscription —
 * that breaks presence sync. We avoid this by sharing one channel across the app.
 */

const CHANNEL_NAME = "online_visitors";
const VISITOR_ID_KEY = "ds_visitor_id";

export interface PresencePayload {
  visitor_id: string;
  user_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  page: string;
  joined_at: string;
  /** Stamped on every 30 s re-track. Lets readers tell a live tab from a ghost. */
  beat_at?: string;
}

let channel: RealtimeChannel | null = null;
let currentPayload: PresencePayload | null = null;
// Set while reconnectPresenceChannel is tearing a channel down. Anything that
// wants to track waits for it, because until removeChannel finishes the
// realtime client still has the topic registered and supabase.channel() hands
// back the DYING channel instead of a new one.
let teardown: Promise<void> | null = null;
const superseded = new WeakSet<RealtimeChannel>();
const syncListeners = new Set<() => void>();

export type PresenceStatus =
  | "IDLE"
  | "SUBSCRIBING"
  | "SUBSCRIBED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "CLOSED";

interface DebugSnapshot {
  status: PresenceStatus;
  lastSyncAt: number | null;
  lastEvent: "sync" | "join" | "leave" | null;
  trackedCount: number;
  liveCount: number;
  staleCount: number;
  visitorCount: number;
  subscribedAt: number | null;
}

let debug: DebugSnapshot = {
  status: "IDLE",
  lastSyncAt: null,
  lastEvent: null,
  trackedCount: 0,
  liveCount: 0,
  staleCount: 0,
  visitorCount: 0,
  subscribedAt: null,
};

const debugListeners = new Set<(s: DebugSnapshot) => void>();

const setDebug = (patch: Partial<DebugSnapshot>) => {
  debug = { ...debug, ...patch };
  debugListeners.forEach((cb) => {
    try {
      cb(debug);
    } catch (e) {
      console.error("[presenceChannel] debug listener error", e);
    }
  });
};

export const getDebugSnapshot = (): DebugSnapshot => debug;

export const subscribeToDebug = (cb: (s: DebugSnapshot) => void): (() => void) => {
  debugListeners.add(cb);
  cb(debug);
  return () => {
    debugListeners.delete(cb);
  };
};

const recomputeCounts = () => {
  if (!channel) return { trackedCount: 0, liveCount: 0, staleCount: 0, visitorCount: 0 };
  const state = channel.presenceState<PresencePayload>() as unknown as Record<string, PresencePayload[]>;
  let trackedCount = 0;
  Object.values(state).forEach((arr) => {
    trackedCount += arr.length;
  });
  const s = summarizePresence(state);
  return {
    trackedCount,
    liveCount: s.live,
    staleCount: s.stale,
    visitorCount: s.visitors.length,
  };
};

/** Recount without waiting for a channel event: ghosts age out on the clock. */
export const refreshPresenceCounts = () => setDebug(recomputeCounts());

export const getOrCreateVisitorId = (): string => {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
};

const notifySync = (event: "sync" | "join" | "leave") => {
  setDebug({
    lastSyncAt: Date.now(),
    lastEvent: event,
    ...recomputeCounts(),
  });
  syncListeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error("[presenceChannel] sync listener error", e);
    }
  });
};

export const getPresenceChannel = (): RealtimeChannel => {
  if (channel) return channel;

  const visitorId = getOrCreateVisitorId();
  // Hold a local reference. The subscribe callback below outlives a
  // reconnect, and if it reads the module-level `channel` it will happily
  // track onto whichever channel replaced it — adding a second presence
  // entry under the same key. Same supersede pattern as playSetlistSeqRef.
  const ch = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: visitorId } },
  });
  channel = ch;

  setDebug({ status: "SUBSCRIBING" });

  ch
    .on("presence", { event: "sync" }, () => notifySync("sync"))
    .on("presence", { event: "join" }, () => notifySync("join"))
    .on("presence", { event: "leave" }, () => notifySync("leave"))
    .subscribe(async (status) => {
      if (channel !== ch || superseded.has(ch)) return; // superseded by a reconnect
      const mapped: PresenceStatus =
        status === "SUBSCRIBED"
          ? "SUBSCRIBED"
          : status === "CHANNEL_ERROR"
            ? "CHANNEL_ERROR"
            : status === "TIMED_OUT"
              ? "TIMED_OUT"
              : status === "CLOSED"
                ? "CLOSED"
                : "SUBSCRIBING";
      setDebug({
        status: mapped,
        subscribedAt: status === "SUBSCRIBED" ? Date.now() : debug.subscribedAt,
      });
      if (status === "SUBSCRIBED" && currentPayload) {
        await ch.track(currentPayload);
        notifySync("sync");
      }
    });

  return ch;
};

/**
 * Tear down the current channel (if any) and rebuild it. Used to recover
 * from CLOSED / CHANNEL_ERROR / TIMED_OUT states — most commonly after iOS
 * Safari suspends the WebSocket when the tab backgrounds or the screen locks.
 * The latest payload is re-tracked automatically once the new channel
 * reaches SUBSCRIBED.
 */
export const reconnectPresenceChannel = async (): Promise<void> => {
  // Focus and visibilitychange fire together when a phone unlocks; both used
  // to start a teardown. One at a time.
  if (teardown) return teardown;

  const dying = channel;
  teardown = (async () => {
    if (dying) {
      // Mark it first so its subscribe callback can no longer re-track, but
      // leave `channel` pointing at it until it is gone: while the topic is
      // still registered, a null here made getPresenceChannel() call
      // supabase.channel(), which returned this same dying channel and
      // subscribed it a second time.
      superseded.add(dying);
      try {
        // untrack first: removeChannel resolves locally, so without an
        // explicit leave the server can still hold our old entry when the
        // replacement tracks under the same key. Bounded, because on a dead
        // socket the push waits out the full channel timeout.
        await Promise.race([
          dying.untrack(),
          new Promise((resolve) => setTimeout(resolve, 3_000)),
        ]);
      } catch (e) {
        console.warn("[presenceChannel] untrack failed", e);
      }
      try {
        await supabase.removeChannel(dying);
      } catch (e) {
        console.warn("[presenceChannel] removeChannel failed", e);
      }
    }
    channel = null;
    setDebug({ status: "IDLE", subscribedAt: null });
  })();

  try {
    await teardown;
  } finally {
    teardown = null;
  }

  if (currentPayload) {
    await trackPresence(currentPayload);
  } else {
    getPresenceChannel();
  }
};

/** Update or set the local presence payload broadcast to others. */
export const trackPresence = async (payload: PresencePayload): Promise<void> => {
  currentPayload = payload;
  if (teardown) {
    // The reconnect re-tracks currentPayload itself once the new channel is up.
    return;
  }
  const ch = getPresenceChannel();
  // track is safe to call before SUBSCRIBED — supabase queues until ready
  try {
    await ch.track(payload);
  } catch (e) {
    console.warn("[presenceChannel] track failed", e);
  }
};

export const subscribeToSync = (cb: () => void): (() => void) => {
  syncListeners.add(cb);
  // Fire immediately so new subscribers get current state
  cb();
  return () => {
    syncListeners.delete(cb);
  };
};

export const getPresenceState = <T = PresencePayload>(): Record<string, T[]> => {
  if (!channel) return {};
  return channel.presenceState<T>() as Record<string, T[]>;
};
