/**
 * Year-window helpers for digging into a single song across a span of years.
 *
 * A window is an inclusive pair of years. A single year is just a window whose
 * ends match, so one control can express both "1974" and "1974–76".
 */

export interface YearWindow {
  start: number;
  end: number;
}

/** Sentinel for "don't narrow the years at all". */
export const ALL_YEARS = "all";

/** First and last years the band played live — the outer bounds of any window. */
export const FIRST_YEAR = 1965;
export const LAST_YEAR = 1995;

/** Every year the band played, oldest first. */
export const ALL_PLAYING_YEARS: number[] = Array.from(
  { length: LAST_YEAR - FIRST_YEAR + 1 },
  (_, i) => FIRST_YEAR + i,
);

/** Serialize a window into a single string a <Select> can carry. */
export function encodeYearWindow(window: YearWindow): string {
  return `${window.start}-${window.end}`;
}

/**
 * Parse a select value back into a window. Returns null for the "all years"
 * sentinel and for anything malformed, so a bad value simply widens the view
 * rather than blanking it.
 */
export function parseYearWindow(value: string | null | undefined): YearWindow | null {
  if (!value || value === ALL_YEARS) return null;

  const match = /^(\d{4})-(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start > end) return null;
  if (end < FIRST_YEAR || start > LAST_YEAR) return null;

  return {
    start: Math.max(start, FIRST_YEAR),
    end: Math.min(end, LAST_YEAR),
  };
}

/**
 * Human label for a window: "1974" for a single year, "1974–76" for a span
 * inside one century, "1969–74" across decades. En dash, per the era dropdown.
 */
export function formatYearWindow(window: YearWindow | null): string {
  if (!window) return "All years";
  if (window.start === window.end) return String(window.start);

  const endsSameCentury = Math.floor(window.start / 100) === Math.floor(window.end / 100);
  const tail = endsSameCentury ? String(window.end).slice(-2) : String(window.end);
  return `${window.start}–${tail}`;
}

/** Map an era row's year bounds onto a window, clamped to the playing years. */
export function eraToYearWindow(era: {
  year_start: number;
  year_end: number;
}): YearWindow | null {
  return parseYearWindow(`${era.year_start}-${era.year_end}`);
}

/** True when two windows cover exactly the same span (either may be null). */
export function sameYearWindow(a: YearWindow | null, b: YearWindow | null): boolean {
  if (!a || !b) return a === b;
  return a.start === b.start && a.end === b.end;
}

/**
 * Move the end of a window, keeping the start fixed. An end before the start
 * collapses to a single year rather than producing an inverted range, so the
 * two dig-deep selects can never disagree with each other.
 */
export function widenYearWindow(window: YearWindow, end: number): YearWindow {
  const clamped = Math.min(Math.max(end, FIRST_YEAR), LAST_YEAR);
  return { start: window.start, end: Math.max(window.start, clamped) };
}
