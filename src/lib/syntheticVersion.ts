import type { Database } from "@/integrations/supabase/types";

type NotableVersion = Database["public"]["Tables"]["notable_versions"]["Row"];

/**
 * Column defaults for a *synthetic* notable version — one reconstructed from an
 * Archive.org recording, or from a slot's stored metadata, rather than read out
 * of the notable_versions table.
 *
 * Spread this first, then override with what the call site actually knows:
 *
 *   const version: NotableVersion = {
 *     ...SYNTHETIC_VERSION_DEFAULTS,
 *     id: `archive-${identifier}`,
 *     song_id: song.id,
 *     show_date: date,
 *   };
 *
 * Why it exists: every one of these used to be spelled out inline in eleven
 * files. When the songbook migration added blurb / is_benchmark / source_quote /
 * source_url / verified_at / vote_source / votes, all eleven stopped
 * typechecking at once — sixteen errors for one schema change. A new column now
 * breaks this file alone.
 */
export const SYNTHETIC_VERSION_DEFAULTS = {
  archive_org_url: null,
  blurb: null,
  city: null,
  description: null,
  era_id: null,
  is_benchmark: false,
  rating: null,
  source_quote: null,
  source_url: null,
  venue: null,
  verified_at: null,
  vote_source: null,
  votes: null,
} satisfies Omit<NotableVersion, "id" | "song_id" | "show_date">;
