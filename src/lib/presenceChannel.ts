import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
}

let channel: RealtimeChannel | null = null;
let currentPayload: PresencePayload | null = null;
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
  subscribedAt: number | null;
}

let debug: DebugSnapshot = {
  status: "IDLE",
  lastSyncAt: null,
  lastEvent: null,
  trackedCount: 0,
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

const recomputeTrackedCount = () => {
  if (!channel) return 0;
  const state = channel.presenceState();
  let n = 0;
  Object.values(state).forEach((arr) => {
    n += (arr as unknown[]).length;
  });
  return n;
};

export const getOrCreateVisitorId = (): string => {
  let id = localStorage.getItem(VISITOR_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, id);
  }
  return id;
};

const notifySync = () => {
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
  channel = supabase.channel(CHANNEL_NAME, {
    config: { presence: { key: visitorId } },
  });

  channel
    .on("presence", { event: "sync" }, notifySync)
    .on("presence", { event: "join" }, notifySync)
    .on("presence", { event: "leave" }, notifySync)
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED" && currentPayload) {
        await channel!.track(currentPayload);
        notifySync();
      }
    });

  return channel;
};

/** Update or set the local presence payload broadcast to others. */
export const trackPresence = async (payload: PresencePayload): Promise<void> => {
  currentPayload = payload;
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
