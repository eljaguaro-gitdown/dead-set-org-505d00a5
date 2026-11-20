import type { PresencePayload } from "@/lib/presenceChannel";

/**
 * Pure presence maths, shared by the admin "Live on Site" card and the
 * Presence Channel debug panel so the two can never disagree.
 *
 * A presence entry ("meta") is one open connection: a tab, the iOS app, a
 * Lovable preview. One person can hold several, and a connection whose page
 * has gone to sleep (iOS freezes background tabs) can linger on the server
 * after its heartbeats stop. Every live connection re-tracks every 30 s and
 * stamps `beat_at`, so an entry whose last beat is older than STALE_AFTER_MS
 * is not someone on the site; it is a ghost.
 */

export const STALE_AFTER_MS = 75_000; // two and a half missed 30 s beats

export type PresenceState = Record<string, PresencePayload[]>;

export interface MergedVisitor {
  visitor_id: string;
  user_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  page: string;
  joined_at: string;
  beat_at: string | null;
}

export interface PresenceSummary {
  /** Every entry the channel holds, live or not. */
  connections: number;
  live: number;
  stale: number;
  /** Distinct people among the live entries (signed-in user or device). */
  visitors: MergedVisitor[];
}

const ms = (iso: string | null | undefined) => {
  if (!iso) return NaN;
  return new Date(iso).getTime();
};

/**
 * Entries from clients built before beat_at existed carry no stamp. They are
 * counted live rather than hidden: dropping them would hide real people for
 * as long as an old tab stays open after a deploy.
 */
export const isStale = (p: PresencePayload, now: number) => {
  const beat = ms(p.beat_at);
  if (Number.isNaN(beat)) return false;
  return now - beat > STALE_AFTER_MS;
};

const lastSeen = (p: PresencePayload) => {
  const beat = ms(p.beat_at);
  return Number.isNaN(beat) ? ms(p.joined_at) : beat;
};

export const summarizePresence = (state: PresenceState, now = Date.now()): PresenceSummary => {
  let connections = 0;
  let stale = 0;
  const live: PresencePayload[] = [];

  Object.values(state).forEach((metas) => {
    metas.forEach((p) => {
      if (!p?.visitor_id) return;
      connections += 1;
      if (isStale(p, now)) stale += 1;
      else live.push(p);
    });
  });

  // Step 1: one device. The presence key is the device's visitor_id, so its
  // tabs share it. A tab that signed in and a sibling tab still showing the
  // pre-signup page are the same person: the identity wins, and the page is
  // whichever tab beat most recently.
  const byDevice = new Map<string, PresencePayload[]>();
  live.forEach((p) => {
    const list = byDevice.get(p.visitor_id) ?? [];
    list.push(p);
    byDevice.set(p.visitor_id, list);
  });

  const devices: MergedVisitor[] = [];
  byDevice.forEach((metas, visitorId) => {
    const signedIn = metas.find((m) => m.user_id) ?? null;
    const freshest = metas.reduce((a, b) => (lastSeen(b) > lastSeen(a) ? b : a));
    const earliest = metas.reduce((a, b) => (ms(b.joined_at) < ms(a.joined_at) ? b : a));
    devices.push({
      visitor_id: visitorId,
      user_id: signedIn?.user_id ?? null,
      display_name: signedIn?.display_name ?? freshest.display_name ?? null,
      avatar_url: signedIn?.avatar_url ?? freshest.avatar_url ?? null,
      page: freshest.page,
      joined_at: earliest.joined_at,
      beat_at: freshest.beat_at ?? null,
    });
  });

  // Step 2: one person. A signed-in user on a phone and a laptop is one row.
  const byPerson = new Map<string, MergedVisitor>();
  devices.forEach((d) => {
    const key = d.user_id ? `u:${d.user_id}` : `v:${d.visitor_id}`;
    const current = byPerson.get(key);
    if (!current) {
      byPerson.set(key, d);
      return;
    }
    const fresher = lastSeen(d as PresencePayload) > lastSeen(current as PresencePayload) ? d : current;
    byPerson.set(key, {
      ...fresher,
      joined_at: ms(d.joined_at) < ms(current.joined_at) ? d.joined_at : current.joined_at,
    });
  });

  const visitors = Array.from(byPerson.values()).sort(
    (a, b) => ms(a.joined_at) - ms(b.joined_at),
  );

  return { connections, live: live.length, stale, visitors };
};
