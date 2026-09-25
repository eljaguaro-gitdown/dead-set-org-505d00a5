import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), auth: { getUser: vi.fn() } } }));

import { SlotNotes } from "@/components/SetlistDisplay";

// jsdom has no layout, so give textareas a scrollHeight that tracks their text.
const LINE = 16;
Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
  configurable: true,
  get() {
    return Math.max(1, Math.ceil((this as HTMLTextAreaElement).value.length / 40)) * LINE;
  },
});

const LINER =
  "A high-energy, driving closer to leave the room buzzing — Jerry's leads stack up over a relentless Phil groove.";

describe("SlotNotes", () => {
  // 2026-09-24: Charlie's notes were cut to one line in the builder on a phone.
  it("grows to show the whole note", () => {
    render(<SlotNotes value={LINER} onChange={() => {}} />);
    const box = screen.getByPlaceholderText("Notes...") as HTMLTextAreaElement;
    expect(box.style.height).toBe(`${Math.ceil(LINER.length / 40) * LINE}px`);
    expect(box.className).not.toMatch(/\bh-7\b/);
  });

  it("is one line when empty", () => {
    render(<SlotNotes value="" onChange={() => {}} />);
    const box = screen.getByPlaceholderText("Notes...") as HTMLTextAreaElement;
    expect(box.style.height).toBe(`${LINE}px`);
    expect(box.rows).toBe(1);
  });
});
