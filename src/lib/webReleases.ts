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

export interface RecordedRelease {
  commitSha: string;
  publishedAt: string;
}

/** The most recent web release in the log, or null if none / unreadable. */
export async function fetchLatestRelease(): Promise<RecordedRelease | null> {
  const { data, error } = await db
    .from("web_releases")
    .select("commit_sha, published_at")
    .order("published_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (error || !row) return null;
  return { commitSha: row.commit_sha, publishedAt: row.published_at };
}

/**
 * A recorded release can stand in for a build's missing sha only if it is
 * this build. It is recorded after the build goes live, so it must not be
 * older than the build itself; a build newer than the last recorded release
 * means a publish went out without step 2a (docs/RELEASING.md).
 */
export function releaseCoversBuild(release: RecordedRelease, buildTimeIso: string): boolean {
  const built = Date.parse(buildTimeIso);
  const recorded = Date.parse(release.publishedAt);
  if (Number.isNaN(built) || Number.isNaN(recorded)) return false;
  return recorded >= built;
}
