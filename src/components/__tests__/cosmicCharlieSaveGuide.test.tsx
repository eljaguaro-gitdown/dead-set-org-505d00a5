/**
 * "Save as Listening Guide" must wait for the first/last-played lookups.
 *
 * The guide's two bookends — the first and last time the song was played —
 * are resolved by date against the Archive AFTER Charlie's picks render, so the
 * list is never held up by those round-trips. While they run, `milestones` is
 * still empty, and a save in that window filed a guide with neither bookend:
 * the cards on screen said FTP and LTP, the setlist that got saved did not.
 * Found by the 2026-10-04 pre-release gate.
 *
 * The lookup is held open with a deferred so the window is wide enough to
 * test, then settled to show the save carries both milestones once it lands.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { createElement, forwardRef, Fragment, type ReactNode } from "react";

const deferreds: Array<(v: unknown) => void> = [];
const findRecordingForDate = vi.fn(
  () => new Promise((resolve) => { deferreds.push(resolve); }),
);
vi.mock("@/lib/archiveOrg", () => ({
  findRecordingForDate: (...args: unknown[]) => findRecordingForDate(...(args as [])),
}));

const SONG = {
  id: "song-ror",
  title: "Ramble On Rose",
  first_played: "1971-10-19",
  last_played: "1995-07-09",
  times_played: 319,
};

const EXPLORE_RESULT = {
  songTitle: "Ramble On Rose",
  linerNotes: "Two nights worth the trip.",
  versions: [
    {
      songTitle: "Ramble On Rose", showDate: "1972-05-26", venue: "Strand Lyceum", city: "London",
      description: null, archiveUrl: "https://archive.org/details/gd72-05-26", rating: 5,
      eraName: "Europe '72", whyThisVersion: "Loose and sure-footed.",
    },
    {
      songTitle: "Ramble On Rose", showDate: "1977-05-08", venue: "Barton Hall", city: "Ithaca",
      description: null, archiveUrl: "https://archive.org/details/gd77-05-08", rating: 5,
      eraName: "1977", whyThisVersion: "Patient, every line landing.",
    },
  ],
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        order: async () => ({ data: table === "songs" ? [SONG] : [], error: null }),
      }),
    }),
    functions: { invoke: async () => ({ data: EXPLORE_RESULT, error: null }) },
  },
}));

vi.mock("@/contexts/AudioPlayerContext", () => ({
  useAudioPlayer: () => ({ playSingle: vi.fn(), unlockAudio: vi.fn() }),
}));
vi.mock("@/lib/wizardEvents", () => ({ trackWizardEvent: vi.fn(async () => {}) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

// AnimatePresence mode="wait" holds the next step until the exit animation
// finishes, which jsdom never runs. Render the steps as plain elements.
vi.mock("framer-motion", () => {
  const strip = ({ initial, animate, exit, variants, transition, custom, whileTap, whileHover, layout, ...rest }: Record<string, unknown>) => rest;
  // One component per tag, made once: a fresh forwardRef on every access is a
  // new component type on every render, which remounts the subtree and drops
  // input events aimed at the element it replaced.
  const cache = new Map<string, unknown>();
  const motion = new Proxy({}, {
    get: (_, tag: string) => {
      if (!cache.has(tag)) {
        cache.set(tag, forwardRef<unknown, Record<string, unknown>>((props, ref) => createElement(tag, { ...strip(props), ref })));
      }
      return cache.get(tag);
    },
  });
  return {
    motion,
    AnimatePresence: ({ children }: { children: ReactNode }) => createElement(Fragment, null, children),
  };
});

import CosmicCharlieDialog from "@/components/CosmicCharlieDialog";

const openExplorerResult = async (onCreateNewSetlist = vi.fn()) => {
  render(
    <CosmicCharlieDialog
      open
      onOpenChange={vi.fn()}
      eraId={null}
      currentSlots={[]}
      onApplySuggestion={vi.fn()}
      onCreateNewSetlist={onCreateNewSetlist}
    />,
  );
  fireEvent.click(screen.getByText("Version Explorer").closest("button")!);
  fireEvent.change(await screen.findByPlaceholderText("Search for a song..."), { target: { value: "Ramble" } });
  fireEvent.click(await screen.findByText("Ramble On Rose"));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(screen.getByText("Surprise me — all eras"));
  fireEvent.click(screen.getByRole("button", { name: /Explore Versions/ }));
  return screen.findByRole("button", { name: /Save as Listening Guide/ });
};

describe("Save as Listening Guide", () => {
  beforeEach(() => {
    deferreds.length = 0;
    findRecordingForDate.mockClear();
  });

  it("is disabled while the first/last-played lookups are still running", async () => {
    const save = await openExplorerResult();
    await waitFor(() => expect(findRecordingForDate).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/Checking the crates for the first and last times/)).toBeInTheDocument();
    expect(save).toBeDisabled();
  });

  it("saves both milestones once the lookups land", async () => {
    const onCreate = vi.fn();
    const save = await openExplorerResult(onCreate);
    await waitFor(() => expect(deferreds).toHaveLength(2));

    await act(async () => {
      deferreds.forEach((resolve) => resolve(null));
    });
    await waitFor(() => expect(save).toBeEnabled());

    fireEvent.click(save);
    expect(onCreate).toHaveBeenCalledTimes(1);
    const songs = onCreate.mock.calls[0][0].sets[0].songs;
    // FTP + Charlie's two nights + LTP. Saved during the lookup, this was 2.
    expect(songs).toHaveLength(4);
    expect(songs[0].notes).toContain("First time played");
    expect(songs[3].notes).toContain("Last time played");
  });
});
