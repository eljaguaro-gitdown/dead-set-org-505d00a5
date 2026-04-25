/**
 * Smoke test: end-to-end RLS verification for draft_setlists via the
 * anonymous draft client. Hits the real Supabase backend.
 *
 * Verifies:
 *  1. INSERT with a valid session id + matching x-anon-session-id header succeeds
 *  2. SELECT returns only rows for the current session
 *  3. UPDATE on the owned row succeeds
 *  4. A *different* session cannot SELECT, UPDATE, or DELETE the row (RLS deny)
 *  5. DELETE on the owned row succeeds and the row is gone
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function uuid() {
  return crypto.randomUUID();
}

function clientFor(sessionId: string) {
  return createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-anon-session-id": sessionId } },
  });
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
      // Best-effort cleanup with the owning client
      await clientA.from("draft_setlists").delete().eq("id", draftId);
    }
  });

  it("INSERT: owner can create a draft", async () => {
    const { data, error } = await clientA
      .from("draft_setlists")
      .insert({
        anon_session_id: sessionA,
        title: "RLS smoke test draft",
        songs: [],
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.anon_session_id).toBe(sessionA);
    draftId = data!.id;
  });

  it("SELECT: owner sees their draft", async () => {
    const { data, error } = await clientA
      .from("draft_setlists")
      .select("id, title")
      .eq("id", draftId!);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("SELECT: foreign session cannot see the draft (RLS)", async () => {
    const { data, error } = await clientB
      .from("draft_setlists")
      .select("id")
      .eq("id", draftId!);

    expect(error).toBeNull(); // RLS filters silently
    expect(data ?? []).toHaveLength(0);
  });

  it("UPDATE: owner can update their draft", async () => {
    const newTitle = "RLS smoke test (updated)";
    const { data, error } = await clientA
      .from("draft_setlists")
      .update({ title: newTitle })
      .eq("id", draftId!)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.title).toBe(newTitle);
  });

  it("UPDATE: foreign session cannot update the draft (RLS)", async () => {
    const { data, error } = await clientB
      .from("draft_setlists")
      .update({ title: "hijacked" })
      .eq("id", draftId!)
      .select();

    // RLS makes the filter match zero rows; no error, no rows updated.
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    // Confirm the title was NOT changed.
    const { data: check } = await clientA
      .from("draft_setlists")
      .select("title")
      .eq("id", draftId!)
      .single();
    expect(check!.title).not.toBe("hijacked");
  });

  it("DELETE: foreign session cannot delete the draft (RLS)", async () => {
    const { data, error } = await clientB
      .from("draft_setlists")
      .delete()
      .eq("id", draftId!)
      .select();

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);

    // Row should still exist.
    const { data: check } = await clientA
      .from("draft_setlists")
      .select("id")
      .eq("id", draftId!);
    expect(check).toHaveLength(1);
  });

  it("DELETE: owner can delete their draft", async () => {
    const { error } = await clientA
      .from("draft_setlists")
      .delete()
      .eq("id", draftId!);
    expect(error).toBeNull();

    const { data: check } = await clientA
      .from("draft_setlists")
      .select("id")
      .eq("id", draftId!);
    expect(check ?? []).toHaveLength(0);

    draftId = null; // already cleaned up
  });
});
