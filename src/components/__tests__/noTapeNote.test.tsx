import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";

const db = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
vi.mock("@/integrations/supabase/client", () => {
  const q: Record<string, unknown> = {};
  Object.assign(q, {
    select: () => q, eq: () => q, in: () => q,
    then: (res: (v: unknown) => void) => Promise.resolve({ data: db.rows, error: null }).then(res),
  });
  return { supabase: { from: () => q } };
});

import NoTapeNote from "@/components/NoTapeNote";
import { prefetchNights, resetTapeIndex } from "@/lib/tapeIndex";

const S = "11111111-1111-4111-8111-111111111111";
const row = (date: string, status: string) => ({
  song_id: S, show_date: date, identifier: status === "playable" ? "x" : "", status, is_default: true, is_song_default: false,
  track_url: status === "playable" ? "https://archive.org/download/x/a.mp3" : null, servers: [],
});

beforeEach(() => resetTapeIndex());

describe("NoTapeNote — said before the tap", () => {
  it("marks a night the index knows no tape carries", async () => {
    db.rows = [row("1983-10-06", "no_tape"), row("1977-04-27", "no_match"), row("1974-06-20", "playable")];
    render(
      <>
        <div data-testid="a"><NoTapeNote songId={S} showDate="1983-10-06" /></div>
        <div data-testid="b"><NoTapeNote songId={S} showDate="1977-04-27" /></div>
        <div data-testid="c"><NoTapeNote songId={S} showDate="1974-06-20" /></div>
      </>,
    );
    // Nothing is claimed until the index has answered.
    expect(document.querySelectorAll("[data-no-tape]")).toHaveLength(0);
    act(() => prefetchNights([{ songId: S, showDate: "1983-10-06" }, { songId: S, showDate: "1977-04-27" }, { songId: S, showDate: "1974-06-20" }]));
    await waitFor(() => expect(screen.getByTestId("a").textContent).toBe("No tape of it from this night"));
    expect(screen.getByTestId("b").textContent).toBe("No tape of it from this night");
    expect(screen.getByTestId("c").textContent).toBe(""); // a night with a tape says nothing
  });

  it("an unindexed night says nothing — absence of an answer is not 'no tape'", async () => {
    db.rows = [];
    render(<div data-testid="a"><NoTapeNote songId={S} showDate="1990-01-01" /></div>);
    act(() => prefetchNights([{ songId: S, showDate: "1990-01-01" }]));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId("a").textContent).toBe("");
  });
});
