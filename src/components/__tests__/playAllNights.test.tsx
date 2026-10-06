import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PlayAllNights from "@/components/PlayAllNights";
import type { PlayableSlot } from "@/contexts/AudioPlayerContext";

/**
 * One control, both Songbook issue surfaces.
 *
 * It exists because the two pages each had their own copy, and the copies
 * disagreed: the curated page counted rows with a stored archive_org_url while
 * ladderPlaylist decided what played, so Shakedown Street (15 versions, 1 url)
 * offered one night above a ladder of fifteen. Taking the queue rather than a
 * count makes that disagreement unrepresentable.
 */

const slots = (n: number): PlayableSlot[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}` }) as PlayableSlot);

/** Exact, normalised label — toHaveTextContent is a SUBSTRING match, and
 *  "Play all 1 nights" contains "Play all 1 night", so a plural regression
 *  passes a containment assertion. That is how it survived the first pass. */
const label = () =>
  screen.getByRole("button").textContent?.replace(/\s+/g, " ").trim();

describe("PlayAllNights", () => {
  it("renders nothing for an empty queue", () => {
    const { container } = render(
      <PlayAllNights slots={[]} cueing={false} onPlay={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("says 'night' for exactly one", () => {
    render(<PlayAllNights slots={slots(1)} cueing={false} onPlay={vi.fn()} />);
    expect(label()).toBe("Play all 1 night");
  });

  it("says 'nights' for more than one", () => {
    render(<PlayAllNights slots={slots(7)} cueing={false} onPlay={vi.fn()} />);
    expect(label()).toBe("Play all 7 nights");
  });

  it("counts the queue it was handed, never a number beside it", () => {
    render(<PlayAllNights slots={slots(15)} cueing={false} onPlay={vi.fn()} />);
    expect(label()).toBe("Play all 15 nights");
  });

  it("calls onPlay when tapped", () => {
    const onPlay = vi.fn();
    render(<PlayAllNights slots={slots(3)} cueing={false} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it("uses aria-disabled, never the real attribute, so focus is not dropped", () => {
    render(<PlayAllNights slots={slots(3)} cueing onPlay={vi.fn()} />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-disabled", "true");
    // Chromium moves focus off an element that becomes `disabled`, which drops
    // a keyboard or switch user to <body> mid-cue.
    expect(button).not.toBeDisabled();
  });

  it("keeps the label identical while cueing — only the icon swaps", () => {
    const { unmount } = render(
      <PlayAllNights slots={slots(7)} cueing={false} onPlay={vi.fn()} />,
    );
    const idle = label();
    unmount();
    render(<PlayAllNights slots={slots(7)} cueing onPlay={vi.fn()} />);
    // A busy state that grows a control has pushed Share off a 320px screen
    // here before, so the text must not change width between states.
    expect(label()).toBe(idle);
  });
});
