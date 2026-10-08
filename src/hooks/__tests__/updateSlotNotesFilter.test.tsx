/**
 * A slot note that fails the house rules is not written, and the fan is told.
 *
 * The database now refuses such a note (filter_objectionable_text on
 * setlist_slots, 20261007235500). updateSlot sends the note together with the
 * slot's position and segue, and logged nothing when a write failed, so a
 * refused note would have silently lost the move that came with it. It now
 * leaves the note out of the write, so the last clean note stays and the move
 * still saves, and it says why.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  updates: [] as Array<Record<string, unknown>>,
  toastError: vi.fn(),
}));

const SETLIST = { id: "set-1", title: "Eyes guide", creator_id: "user-1", share_token: null };
const SLOT = {
  id: "slot-1", setlist_id: "set-1", set_number: 1, position: 1, song_id: "song-1",
  notable_version_id: null, notes: "a clean note", segue_to_next: false, added_by_user_id: "user-1",
};
const SONG = { id: "song-1", title: "Eyes of the World" };

const RESULTS: Record<string, unknown> = {
  setlists: { data: SETLIST, error: null },
  setlist_slots: { data: [SLOT], error: null },
  songs: { data: [SONG], error: null },
  collaborators: { data: [], error: null },
  profiles: { data: [], error: null },
};

// Every builder method returns the same chain; awaiting it resolves the
// table's canned result. `update` is recorded, which is all this test reads.
const chain = (table: string): unknown => {
  const c: unknown = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") {
          return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
            Promise.resolve(RESULTS[table] ?? { data: null, error: null }).then(res, rej);
        }
        if (prop === "update") {
          return (payload: Record<string, unknown>) => {
            if (table === "setlist_slots") mocks.updates.push(payload);
            return c;
          };
        }
        return () => c;
      },
    },
  );
  return c;
};

vi.mock("@/integrations/supabase/client", () => {
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    supabase: {
      from: (t: string) => chain(t),
      channel: () => channel,
      removeChannel: vi.fn(),
      rpc: async () => ({ data: null, error: null }),
      auth: { getUser: async () => ({ data: { user: null } }) },
    },
  };
});
vi.mock("@/hooks/useModeration", async () => {
  const { isObjectionable, OBJECTIONABLE_MESSAGE } = await import("@/lib/contentFilter");
  return {
    passesContentFilter: (...texts: Array<string | null | undefined>) => {
      if (texts.some(isObjectionable)) {
        mocks.toastError(OBJECTIONABLE_MESSAGE);
        return false;
      }
      return true;
    },
  };
});
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/posthog", () => ({ captureEvent: vi.fn() }));

import { useSetlist } from "@/hooks/useSetlist";

const USER = { id: "user-1" } as never;

const loaded = async () => {
  const hook = renderHook(() => useSetlist(USER, "set-1"));
  await waitFor(() => expect(hook.result.current.slots).toHaveLength(1));
  return hook;
};

beforeEach(() => {
  mocks.updates.length = 0;
  mocks.toastError.mockClear();
});

describe("updateSlot and the house rules", () => {
  it("writes a clean note", async () => {
    const { result } = await loaded();
    await act(async () => result.current.updateSlot("slot-1", { notes: "into Estimated Prophet" }));
    await waitFor(() => expect(mocks.updates).toHaveLength(1), { timeout: 2000 });
    expect(mocks.updates[0].notes).toBe("into Estimated Prophet");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("leaves a failing note out of the write, keeps the move, and says why", async () => {
    const { result } = await loaded();
    await act(async () => result.current.updateSlot("slot-1", { notes: "what a fucking jam", position: 4 }));
    await waitFor(() => expect(mocks.updates).toHaveLength(1), { timeout: 2000 });
    expect(mocks.updates[0]).not.toHaveProperty("notes");
    expect(mocks.updates[0].position).toBe(4);
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringMatching(/house rules/));
  });
});
