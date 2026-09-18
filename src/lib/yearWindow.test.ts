import { describe, it, expect } from "vitest";
import {
  ALL_PLAYING_YEARS,
  ALL_YEARS,
  FIRST_YEAR,
  LAST_YEAR,
  encodeYearWindow,
  eraToYearWindow,
  formatYearWindow,
  parseYearWindow,
  sameYearWindow,
  widenYearWindow,
} from "@/lib/yearWindow";

describe("parseYearWindow", () => {
  it("reads a single year as a one-year window", () => {
    expect(parseYearWindow("1974-1974")).toEqual({ start: 1974, end: 1974 });
  });

  it("reads a span", () => {
    expect(parseYearWindow("1974-1976")).toEqual({ start: 1974, end: 1976 });
  });

  it("treats the all-years sentinel and empty values as no window", () => {
    expect(parseYearWindow(ALL_YEARS)).toBeNull();
    expect(parseYearWindow("")).toBeNull();
    expect(parseYearWindow(null)).toBeNull();
    expect(parseYearWindow(undefined)).toBeNull();
  });

  it("widens rather than blanks on malformed input", () => {
    expect(parseYearWindow("nineteen-seventy-four")).toBeNull();
    expect(parseYearWindow("1974")).toBeNull();
    expect(parseYearWindow("1974-")).toBeNull();
    // Inverted ranges are a caller bug, not a filter.
    expect(parseYearWindow("1976-1974")).toBeNull();
  });

  it("clamps to the years the band actually played", () => {
    expect(parseYearWindow("1960-1970")).toEqual({ start: FIRST_YEAR, end: 1970 });
    expect(parseYearWindow("1990-2005")).toEqual({ start: 1990, end: LAST_YEAR });
  });

  it("rejects windows entirely outside the playing years", () => {
    expect(parseYearWindow("1940-1950")).toBeNull();
    expect(parseYearWindow("2000-2010")).toBeNull();
  });
});

describe("encodeYearWindow", () => {
  it("round-trips through parseYearWindow", () => {
    const window = { start: 1974, end: 1976 };
    expect(parseYearWindow(encodeYearWindow(window))).toEqual(window);
  });

  it("round-trips a single year", () => {
    const window = { start: 1977, end: 1977 };
    expect(parseYearWindow(encodeYearWindow(window))).toEqual(window);
  });
});

describe("formatYearWindow", () => {
  it("labels no window as all years", () => {
    expect(formatYearWindow(null)).toBe("All years");
  });

  it("labels a single year plainly", () => {
    expect(formatYearWindow({ start: 1974, end: 1974 })).toBe("1974");
  });

  it("abbreviates a span inside one century with an en dash", () => {
    expect(formatYearWindow({ start: 1974, end: 1976 })).toBe("1974–76");
    expect(formatYearWindow({ start: 1969, end: 1974 })).toBe("1969–74");
  });
});

describe("eraToYearWindow", () => {
  it("maps an era row onto its year span", () => {
    expect(eraToYearWindow({ year_start: 1972, year_end: 1974 })).toEqual({
      start: 1972,
      end: 1974,
    });
  });

  it("clamps an era that runs past the playing years", () => {
    expect(eraToYearWindow({ year_start: 1990, year_end: 1996 })).toEqual({
      start: 1990,
      end: LAST_YEAR,
    });
  });
});

describe("sameYearWindow", () => {
  it("treats two nulls as the same", () => {
    expect(sameYearWindow(null, null)).toBe(true);
  });

  it("distinguishes a window from no window", () => {
    expect(sameYearWindow({ start: 1974, end: 1976 }, null)).toBe(false);
  });

  it("compares both ends", () => {
    expect(sameYearWindow({ start: 1974, end: 1976 }, { start: 1974, end: 1976 })).toBe(true);
    expect(sameYearWindow({ start: 1974, end: 1976 }, { start: 1974, end: 1977 })).toBe(false);
  });
});

describe("ALL_PLAYING_YEARS", () => {
  it("covers every year the band played, oldest first", () => {
    expect(ALL_PLAYING_YEARS[0]).toBe(FIRST_YEAR);
    expect(ALL_PLAYING_YEARS[ALL_PLAYING_YEARS.length - 1]).toBe(LAST_YEAR);
    expect(ALL_PLAYING_YEARS).toHaveLength(LAST_YEAR - FIRST_YEAR + 1);
  });

  it("offers every year as a parseable single-year window", () => {
    for (const year of ALL_PLAYING_YEARS) {
      expect(parseYearWindow(`${year}-${year}`)).toEqual({ start: year, end: year });
    }
  });
});

describe("widenYearWindow — the second dig-deep select", () => {
  it("turns a single year into the brief's headline range", () => {
    // "rare gems of Crazy Fingers in 1974" widened to "1974-76".
    expect(widenYearWindow({ start: 1974, end: 1974 }, 1976)).toEqual({ start: 1974, end: 1976 });
    expect(formatYearWindow(widenYearWindow({ start: 1974, end: 1974 }, 1976))).toBe("1974–76");
  });

  it("keeps the start fixed", () => {
    expect(widenYearWindow({ start: 1972, end: 1974 }, 1980)).toEqual({ start: 1972, end: 1980 });
  });

  it("collapses to a single year rather than inverting", () => {
    expect(widenYearWindow({ start: 1977, end: 1980 }, 1974)).toEqual({ start: 1977, end: 1977 });
  });

  it("clamps to the playing years", () => {
    expect(widenYearWindow({ start: 1990, end: 1990 }, 2010)).toEqual({ start: 1990, end: LAST_YEAR });
  });

  it("produces a window that round-trips through the select value", () => {
    const widened = widenYearWindow({ start: 1974, end: 1974 }, 1976);
    expect(parseYearWindow(encodeYearWindow(widened))).toEqual(widened);
  });
});

describe("start-select value fallback", () => {
  // Regression: once the end is widened the window stops matching any single
  // option, and a Radix trigger bound straight to it renders blank.
  const eraWindows = [
    { id: "era-1", name: "Americana Peak", window: { start: 1970, end: 1974 } },
  ];

  const startSelectValue = (window: { start: number; end: number } | null) => {
    if (!window) return ALL_YEARS;
    const era = eraWindows.find((e) => sameYearWindow(e.window, window));
    if (era) return encodeYearWindow(era.window);
    return `${window.start}-${window.start}`;
  };

  it("shows the era when the window is exactly that era", () => {
    expect(startSelectValue({ start: 1970, end: 1974 })).toBe("1970-1974");
  });

  it("falls back to the start year for a widened range", () => {
    const widened = widenYearWindow({ start: 1974, end: 1974 }, 1976);
    expect(startSelectValue(widened)).toBe("1974-1974");
  });

  it("falls back to the start year for a range that is not an era", () => {
    expect(startSelectValue({ start: 1970, end: 1976 })).toBe("1970-1970");
  });

  it("shows the all-years sentinel when nothing is narrowed", () => {
    expect(startSelectValue(null)).toBe(ALL_YEARS);
  });

  it("always yields a value the start select actually offers", () => {
    // Every fallback must be a real option: an era value or a single year.
    for (const end of ALL_PLAYING_YEARS) {
      const value = startSelectValue({ start: 1974, end });
      expect(parseYearWindow(value)).not.toBeNull();
    }
  });
});
