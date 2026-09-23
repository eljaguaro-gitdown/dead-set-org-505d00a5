/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads the `web_releases` log (supabase/migrations/20260923233000_web_releases.sql).
 *
 * Same typing escape hatch as src/lib/songbookDb.ts: types.ts is generated from
 * the live database and does not know this table until it is regenerated. Once
 * it does, drop the cast and query through `supabase` directly.
 */
const db = supabase as unknown as { from: (table: string) => any };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface ReleaseActivity {
  /** Releases in the last seven days. */
  thisWeek: number;
  /** When the most recent release went out, or null if none is recorded. */
  lastReleasedAt: string | null;
}

export async function fetchReleaseActivity(now: number = Date.now()): Promise<ReleaseActivity | null> {
  const since = new Date(now - WEEK_MS).toISOString();
  const [recent, latest] = await Promise.all([
    db.from("web_releases").select("id", { count: "exact", head: true }).gte("published_at", since),
    db.from("web_releases").select("published_at").order("published_at", { ascending: false }).limit(1),
  ]);
  if (recent.error || latest.error) return null;
  return {
    thisWeek: recent.count ?? 0,
    lastReleasedAt: latest.data?.[0]?.published_at ?? null,
  };
}
