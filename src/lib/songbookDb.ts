/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/integrations/supabase/client";

/**
 * Temporary typing escape hatch for The Songbook.
 *
 * `supabase/migrations/20260821120000_songbook.sql` adds the `song_features`
 * table and several new `notable_versions` columns (votes, vote_source,
 * source_url, blurb, is_benchmark…). `src/integrations/supabase/types.ts` is
 * generated FROM the live database and carries a "do not edit" header, so
 * those names are absent from the `Database` type until someone runs:
 *
 *     supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts
 *
 * against a database with this migration applied.
 *
 * Rather than scatter `as any` through three components — or hand-edit a
 * generated file and have it silently reverted on the next regen — every
 * songbook query goes through this one module. Once types.ts knows about
 * `song_features`, delete this file and swap the call sites back to `supabase`.
 */
type LooseClient = { from: (table: string) => any };

export const songbookDb = supabase as unknown as LooseClient;
