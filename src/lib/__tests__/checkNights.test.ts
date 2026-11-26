import { describe, expect, it } from "vitest";
import { droppedPicksMessage, splitByVerdict, type PickVerdict } from "@/lib/checkNights";
import { pickVerdict } from "../../../supabase/functions/_shared/pickVerdict";
import { reindexMilestones } from "@/lib/listeningGuide";
import type { MilestoneEntry } from "@/lib/firstLastPlayed";

describe("pickVerdict", () => {
  it("drops a night only when both records rule it out", () => {
    expect(pickVerdict({ supports: "N", setlistPlayed: "no", onTape: "no" })).toBe("not_played");
  });
  it("keeps a night on tape, or on JerryBase's setlist", () => {
    expect(pickVerdict({ supports: "on_tape", setlistPlayed: "no", onTape: "yes" })).toBe("played");
    expect(pickVerdict({ supports: "G", setlistPlayed: "yes", onTape: "no" })).toBe("played");
  });
  it("a source that didn't answer is not evidence", () => {
    expect(pickVerdict({ supports: null, setlistPlayed: "unknown", onTape: "no" })).toBe("unknown");
  });
});

describe("splitByVerdict", () => {
  const picks = [{ showDate: "1972-05-26" }, { showDate: "1977-05-08" }, { showDate: "1980-10-11" }];
  it("takes out only the not_played nights", () => {
    const verdicts = new Map<string, PickVerdict>([
      ["1972-05-26", "played"],
      ["1977-05-08", "not_played"],
      ["1980-10-11", "unknown"],
    ]);
    const { kept, dropped } = splitByVerdict(picks, verdicts);
    expect(kept.map((p) => p.showDate)).toEqual(["1972-05-26", "1980-10-11"]);
    expect(dropped.map((p) => p.showDate)).toEqual(["1977-05-08"]);
  });
  it("keeps everything when the check could not run", () => {
    expect(splitByVerdict(picks, new Map()).kept).toHaveLength(3);
  });
});

describe("droppedPicksMessage", () => {
  it("says what came out, in plain words", () => {
    expect(droppedPicksMessage("Ramble On Rose", [{ showDate: "1977-05-08" }])).toBe(
      "Left out 1977-05-08: the setlists don't have Ramble On Rose that night.",
    );
    expect(droppedPicksMessage("Slipknot!", [{ showDate: "1976-06-09" }, { showDate: "1977-04-27" }])).toContain(
      "1976-06-09 and 1977-04-27",
    );
  });
  it("never names the machinery", () => {
    const text = droppedPicksMessage("Althea", [{ showDate: "1982-04-06" }]);
    expect(text).not.toMatch(/\bAI\b|algorithm|generat/i);
  });
});

describe("reindexMilestones", () => {
  const ftp: MilestoneEntry = {
    kind: "ftp", date: "1971-10-19", venue: "Northrop Auditorium", city: null,
    archiveUrl: "https://archive.org/details/gd71-10-19", directTrackUrl: null,
    tapeFound: true, source: "list", listIndex: 2,
  };
  it("follows its night when picks before it are dropped", () => {
    const [m] = reindexMilestones([ftp], [{ showDate: "1972-05-26" }, { showDate: "1971-10-19" }]);
    expect(m.listIndex).toBe(1);
  });
  it("becomes a row of its own when its pick is gone", () => {
    const [m] = reindexMilestones([ftp], [{ showDate: "1972-05-26" }]);
    expect(m.listIndex).toBeNull();
    expect(m.source).toBe("archive");
  });
});
