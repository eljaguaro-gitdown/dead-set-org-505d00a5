import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useClaimBottom } from "@/lib/bottomCardClaims";

/**
 * Seen on a 375px phone: the install banner (fixed bottom-0 z-50, a second
 * after load on every mobile visit) sat over the oops card's sign-in line and
 * the tape it offered. A card about what the fan just did holds the bottom;
 * the pitch to install yields while it is up and comes back after.
 */

vi.mock("@/lib/nativeApp", () => ({ isNativeApp: () => false }));

import PwaInstallBanner from "@/components/PwaInstallBanner";

const Claimer = ({ active }: { active: boolean }) => {
  useClaimBottom("test-card", active);
  return null;
};

const ua = Object.getOwnPropertyDescriptor(window.navigator, "userAgent");

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    get: () => "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  });
});
afterEach(() => {
  vi.useRealTimers();
  if (ua) Object.defineProperty(window.navigator, "userAgent", ua);
  else delete (window.navigator as unknown as Record<string, unknown>).userAgent;
});

const banner = () => screen.queryByText("Add Dead Set to Home Screen");

describe("the install banner yields the bottom of the screen", () => {
  it("shows on a phone after its delay when nothing holds the bottom", () => {
    render(<><PwaInstallBanner /><Claimer active={false} /></>);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(banner()).not.toBeNull();
  });

  it("steps aside while a card holds the bottom, and comes back after", () => {
    const { rerender } = render(<><PwaInstallBanner /><Claimer active={false} /></>);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(banner()).not.toBeNull();

    rerender(<><PwaInstallBanner /><Claimer active /></>);
    expect(banner()).toBeNull();

    rerender(<><PwaInstallBanner /><Claimer active={false} /></>);
    expect(banner()).not.toBeNull();
  });

  it("releases the claim when the card unmounts, not just when it deactivates", () => {
    const { rerender } = render(<><PwaInstallBanner /><Claimer active /></>);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(banner()).toBeNull();
    rerender(<><PwaInstallBanner /></>);
    expect(banner()).not.toBeNull();
  });
});
