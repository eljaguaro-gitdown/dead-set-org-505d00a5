// Deterministic hash of the intro-relevant fields of a setlist. When
// this hash changes, the cached DJ intro is stale and must be
// regenerated. Cosmetic edits (typo fixes in notes, reordering fields
// that don't matter to the script) leave the hash unchanged.
//
// KEEP IN SYNC with the same-named function in
// supabase/functions/generate-dj-intro/index.ts — client and server
// must agree on the hash for the cache lookup to work.
//
// See docs/features/dj-cosmic-charlie.md §5.5 for rationale.

export interface IntroHashInput {
  title: string;
  era_id: string | null;
  description: string | null;
  slots: Array<{
    set_number: number;
    position: number;
    segue_to_next: boolean;
    song_id: string;
  }>;
}

/**
 * Compute the 16-char hex intro-source hash. Uses SubtleCrypto SHA-256
 * (available in every modern browser + Deno + Node 18+). Async because
 * SubtleCrypto is async everywhere.
 */
export async function computeIntroSourceHash(input: IntroHashInput): Promise<string> {
  const canonical = JSON.stringify({
    title: input.title.trim(),
    era_id: input.era_id ?? null,
    description: (input.description ?? "").trim(),
    slots: input.slots.map((s) => ({
      set: s.set_number,
      pos: s.position,
      seg: s.segue_to_next,
      song: s.song_id,
    })),
  });
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
