/**
 * Smoke test: end-to-end RLS verification for draft_setlists via the
 * anonymous draft client. Hits the real Supabase backend.
 *
 * Determinism guarantees:
 *  - Every mutation uses `.select({ count: 'exact' })` so we assert the exact
 *    number of rows affected (not just "no error").
 *  - Every cross-session read goes through `retry(...)` to absorb the brief
 *    eventual consistency window between PostgREST writes and reads.
 *  - Foreign-session denial is verified two ways: zero affected rows on the
 *    write itself, AND the owning session re-reads the row to confirm its
 *    state didn't change.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 100;

function uuid() {
  return crypto.randomUUID();
}

function clientFor(sessionId: string) {
  return createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-anon-session-id": sessionId } },
  });
}

/**
 * Retry an async assertion to tolerate eventual consistency between a write
 * and a subsequent read against PostgREST. Backs off exponentially.
 */
async function retry<T>(
  label: string,
  fn: () => Promise<T>,
  attempts = RETRY_ATTEMPTS,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = RETRY_BASE_DELAY_MS * 2 ** i;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(
    `retry(${label}) exhausted ${attempts} attempts: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}

const sessionA = uuid();
const sessionB = uuid();
const clientA = clientFor(sessionA);
const clientB = clientFor(sessionB);

let draftId: string | null = null;

describe("draft_setlists RLS (anon draft client)", () => {
  beforeAll(() => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY");
    }
  });

  afterAll(async () => {
    if (draftId) {
      // Best-effort cleanup with the owning client.
      await clientA.from("draft_setlists").delete().eq("id", draftId);
    }
  });

  it("INSERT: owner can create a draft (1 row affected)", async () => {
    const { data, error } = await clientA
      .from("draft_setlists")
      .insert({
        anon_session_id: sessionA,
        title: "RLS smoke test draft",
        songs: [],
      })
      .select("*");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].anon_session_id).toBe(sessionA);
    draftId = data![0].id;
  });

  it("SELECT: owner sees exactly their draft (with retry)", async () => {
    await retry("owner select", async () => {
      const { data, error, count } = await clientA
        .from("draft_setlists")
        .select("id, title", { count: "exact" })
        .eq("id", draftId!);

      expect(error).toBeNull();
      expect(count).toBe(1);
      expect(data).toHaveLength(1);
    });
  });

  it("SELECT: foreign session cannot see the draft — 0 rows (with retry)", async () => {
    await retry("foreign select", async () => {
      const { data, error, count } = await clientB
        .from("draft_setlists")
        .select("id", { count: "exact" })
        .eq("id", draftId!);

      expect(error).toBeNull(); // RLS filters silently
      expect(count).toBe(0);
      expect(data ?? []).toHaveLength(0);
    });
  });

  it("UPDATE: owner can update their draft (1 row affected)", async () => {
    const newTitle = "RLS smoke test (updated)";
    const { data, error } = await clientA
      .from("draft_setlists")
      .update({ title: newTitle })
      .eq("id", draftId!)
      .select("id, title");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].title).toBe(newTitle);
  });

  it("UPDATE: foreign session cannot update — 0 rows + state unchanged", async () => {
    const { data, error } = await clientB
      .from("draft_setlists")
      .update({ title: "hijacked" })
      .eq("id", draftId!)
      .select("id");

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    // Re-confirm via the owner that the title was NOT changed.
    await retry("owner re-read after foreign update", async () => {
      const { data: check, error: checkErr } = await clientA
        .from("draft_setlists")
        .select("title")
        .eq("id", draftId!)
        .single();
      expect(checkErr).toBeNull();
      expect(check!.title).not.toBe("hijacked");
    });
  });

  it("DELETE: foreign session cannot delete — 0 rows + row still present", async () => {
    const { data, error } = await clientB
      .from("draft_setlists")
      .delete()
      .eq("id", draftId!)
      .select("id");

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    // Row should still exist for the owner.
    await retry("owner re-read after foreign delete", async () => {
      const { data: check, error: checkErr, count: checkCount } = await clientA
        .from("draft_setlists")
        .select("id", { count: "exact" })
        .eq("id", draftId!);
      expect(checkErr).toBeNull();
      expect(checkCount).toBe(1);
      expect(check).toHaveLength(1);
    });
  });

  it("DELETE: owner can delete their draft (1 row affected, then gone)", async () => {
    const { data, error } = await clientA
      .from("draft_setlists")
      .delete()
      .eq("id", draftId!)
      .select("id");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);

    await retry("owner re-read after delete", async () => {
      const { data: check, error: checkErr, count: checkCount } = await clientA
        .from("draft_setlists")
        .select("id", { count: "exact" })
        .eq("id", draftId!);
      expect(checkErr).toBeNull();
      expect(checkCount).toBe(0);
      expect(check ?? []).toHaveLength(0);
    });

    draftId = null; // already cleaned up
  });
});
