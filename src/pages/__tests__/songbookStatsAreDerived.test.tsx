import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * The shelf's three numbers must follow the data, never a literal.
 *
 * "2 issues published" is correct today because there are two rows, which is
 * exactly why it is worth pinning: a count that happens to be right is
 * indistinguishable, on screen, from one that is frozen. Jay read it as static
 * and could not tell from looking — nor could anyone.
 *
 * So this renders the page with a DIFFERENT number of issues than production
 * has and asserts the stat follows, which a hardcoded 2 cannot survive. It
 * also pins "Sundays left", since that is derived from the same count and
 * would drift silently if someone froze one and not the other.
 */
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> };
});
vi.mock("@/components/PageLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/SiteHeader", () => ({ default: () => <header /> }));
vi.mock("@/lib/posthog", () => ({ captureEvent: vi.fn() }));

let FEATURES: Record<string, unknown>[] = [];

const table = (rows: unknown[]) => {
  const api: Record<string, unknown> = {
    select: () => api, eq: () => api, in: () => api, limit: () => Promise.resolve({ data: [], error: null }),
    order: () => Promise.resolve({ data: rows, error: null }),
    then: (res: (v: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(res),
  };
  return api;
};
vi.mock("@/lib/songbookDb", () => ({
  songbookDb: { from: (t: string) => table(t === "song_features" ? FEATURES : []) },
}));

import Songbook from "@/pages/Songbook";

const issue = (n: number) => ({
  id: `f${n}`, slug: `song-${n}`, title: `Song ${n}`, week_of: `2026-0${n}-01`,
  issue_number: n, headline: `Headline ${n}`, dek: `Dek ${n}`,
  times_played: 100 + n, ftp_date: "1970-01-01", ltp_date: "1995-07-09",
});

beforeEach(() => { FEATURES = []; });
afterEach(cleanup);

/** The repertoire constant the page divides by; see Songbook.tsx. */
const REPERTOIRE_TOTAL = 523;

describe("the Songbook shelf counts what is on it", () => {
  it("reports five issues when five are published, not the two production has", async () => {
    FEATURES = [5, 4, 3, 2, 1].map(issue);
    render(<Songbook />);
    expect(await screen.findByText("5")).toBeInTheDocument();
    expect(screen.getByText("issues published")).toBeInTheDocument();
  });

  it("says 'issue published', singular, when there is exactly one", async () => {
    FEATURES = [issue(1)];
    render(<Songbook />);
    expect(await screen.findByText("issue published")).toBeInTheDocument();
  });

  it("shrinks the Sundays left by the number of issues, from the same count", async () => {
    FEATURES = [3, 2, 1].map(issue);
    render(<Songbook />);
    const expected = `${((REPERTOIRE_TOTAL - 3) / 52).toFixed(1)} yrs`;
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it("the two numbers move together — a frozen one would disagree with the other", async () => {
    FEATURES = [9, 8, 7, 6, 5, 4, 3, 2, 1].map(issue);
    render(<Songbook />);
    expect(await screen.findByText("9")).toBeInTheDocument();
    expect(screen.getByText(`${((REPERTOIRE_TOTAL - 9) / 52).toFixed(1)} yrs`)).toBeInTheDocument();
  });
});
