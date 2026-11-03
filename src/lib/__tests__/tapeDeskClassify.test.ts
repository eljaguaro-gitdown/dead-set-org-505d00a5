import { describe, expect, it } from "vitest";
import { classify, hostHealthy, type HostProbe, type TapeEvidence } from "../../../scripts/tape-desk/classify";

const TRACK = "https://archive.org/download/gd71-10-19.orefm.clugston.3301.sbeok.shnf/gd71-10-19d1t09.mp3";
const OTHER = "https://archive.org/download/gd71-10-19.orefm.clugston.3301.sbeok.shnf/gd71-10-19d1t10.mp3";

const ok = (range: string) => ({ range, status: 206, html: false });
const host = (name: string, role: HostProbe["role"], statuses: Array<number | "html">): HostProbe => ({
  host: name,
  role,
  results: statuses.map((s, i) => (s === "html" ? { range: `r${i}`, status: 200, html: true } : { range: `r${i}`, status: s, html: false })),
});
const healthy = (name: string, role: HostProbe["role"]) => host(name, role, [206, 206, 206, 206, 206, 206]);

/** A report with a track, where the player's resolver still picks that track and every host serves it. */
const trackReport = (over: Partial<TapeEvidence> = {}): TapeEvidence => ({
  hasRecording: true,
  metadata: "ok",
  reportedTrack: TRACK,
  fileInItem: true,
  resolverTrack: TRACK,
  hosts: [healthy("dn720308.ca.archive.org", "routed"), healthy("ia800906.us.archive.org", "workable")],
  ...over,
});

describe("hostHealthy", () => {
  it("is false when one probe in six failed: an intermittent mirror is a sick one", () => {
    expect(hostHealthy(host("dn", "routed", [206, 206, 500, 206, 206, 206]))).toBe(false);
  });
  it("is false for a timeout (status 0)", () => {
    expect(hostHealthy(host("dn", "routed", [206, 0]))).toBe(false);
  });
  it("is false for an HTML page served with a success status, which Safari reports as code 4", () => {
    expect(hostHealthy(host("dn", "routed", [206, "html"]))).toBe(false);
  });
  it("is false for a host nobody probed", () => {
    expect(hostHealthy({ host: "x", role: "routed", results: [] })).toBe(false);
  });
  it("is true when every probe came back as audio", () => {
    expect(hostHealthy({ host: "x", role: "workable", results: [ok("0-1"), ok("0-65535")] })).toBe(true);
  });
});

describe("classify: a report that names a track", () => {
  it("Jack Straw as probed on 2026-10-31: the routed mirror failed, the item's own servers served it → mirror_failure", () => {
    const e = trackReport({
      hosts: [
        host("dn720308.ca.archive.org", "routed", [500, 0, 0, 500, 206, 0, 500, 500, 500, 500, 500, 500]),
        healthy("ia800906.us.archive.org", "workable"),
      ],
    });
    expect(classify(e)).toBe("mirror_failure");
  });

  it("Jack Straw as probed on 2026-11-03, after the mirror recovered → plays_now", () => {
    expect(classify(trackReport())).toBe("plays_now");
  });

  it("a sick routed mirror is still mirror_failure when another routed host was healthy", () => {
    const e = trackReport({
      hosts: [healthy("ia800906.us.archive.org", "routed"), host("dn720308.ca.archive.org", "routed", [206, 500])],
    });
    expect(classify(e)).toBe("mirror_failure");
  });

  it("a sick workable server alone is not a mirror failure: the fan was never routed there", () => {
    const e = trackReport({
      hosts: [healthy("dn720308.ca.archive.org", "routed"), host("ia600906.us.archive.org", "workable", [500, 500])],
    });
    expect(classify(e)).toBe("plays_now");
  });

  it("no host serves the file → tape_unservable, not mirror_failure", () => {
    const e = trackReport({
      hosts: [host("dn", "routed", [500, 500]), host("ia", "workable", [500, 0])],
    });
    expect(classify(e)).toBe("tape_unservable");
  });

  it("no delivery probe ran at all → tape_unservable rather than a clean bill", () => {
    expect(classify(trackReport({ hosts: [] }))).toBe("tape_unservable");
  });

  it("the file is not in the item → track_missing, whatever the hosts say", () => {
    expect(classify(trackReport({ fileInItem: false }))).toBe("track_missing");
  });

  it("the item itself is gone → track_missing", () => {
    expect(classify(trackReport({ metadata: "missing" }))).toBe("track_missing");
  });

  it("the resolver now picks another file → wrong_track, before any delivery verdict", () => {
    const e = trackReport({ resolverTrack: OTHER, hosts: [host("dn", "routed", [500])] });
    expect(classify(e)).toBe("wrong_track");
  });

  it("the resolver says the song is not on this tape → song_not_on_tape", () => {
    expect(classify(trackReport({ resolverTrack: null }))).toBe("song_not_on_tape");
  });

  it("the resolver could not ask → archive_unreachable, never a verdict about the tape", () => {
    expect(classify(trackReport({ resolverTrack: "unreachable" }))).toBe("archive_unreachable");
  });

  it("metadata did not answer → archive_unreachable, even with a missing-looking file", () => {
    expect(classify(trackReport({ metadata: "unreachable", fileInItem: false }))).toBe("archive_unreachable");
  });

  it("a dark item → tape_dark, before the file check", () => {
    expect(classify(trackReport({ metadata: "dark", fileInItem: false }))).toBe("tape_dark");
  });
});

describe("classify: a report that names a recording but no track", () => {
  const recordingReport = (over: Partial<TapeEvidence> = {}): TapeEvidence => ({
    hasRecording: true,
    metadata: "ok",
    reportedTrack: null,
    fileInItem: null,
    resolverTrack: null,
    hosts: [],
    ...over,
  });

  it("the resolver finds the song in it today → resolver_found_tape", () => {
    expect(classify(recordingReport({ resolverTrack: TRACK }))).toBe("resolver_found_tape");
  });

  it("not on this tape, but another tape of the night has it → song_on_other_tape", () => {
    const e = recordingReport({ night: { unreachable: false, recordingFound: true, recordingsThatNight: 2 } });
    expect(classify(e)).toBe("song_on_other_tape");
  });

  it("not on this tape, and the night could not be asked → archive_unreachable", () => {
    const e = recordingReport({ night: { unreachable: true, recordingFound: false, recordingsThatNight: null } });
    expect(classify(e)).toBe("archive_unreachable");
  });

  it("not on this tape, and no tape of the night has it → song_not_on_tape", () => {
    const e = recordingReport({ night: { unreachable: false, recordingFound: false, recordingsThatNight: 2 } });
    expect(classify(e)).toBe("song_not_on_tape");
  });

  it("not on this tape, and no night was named → song_not_on_tape", () => {
    expect(classify(recordingReport())).toBe("song_not_on_tape");
  });

  it("the recording's item is gone → track_missing", () => {
    expect(classify(recordingReport({ metadata: "missing" }))).toBe("track_missing");
  });

  it("the resolver could not ask → archive_unreachable", () => {
    expect(classify(recordingReport({ resolverTrack: "unreachable" }))).toBe("archive_unreachable");
  });
});

describe("classify: a report that names only a night", () => {
  const nightReport = (night: TapeEvidence["night"]): TapeEvidence => ({
    hasRecording: false,
    metadata: "ok",
    reportedTrack: null,
    fileInItem: null,
    resolverTrack: null,
    night,
    hosts: [],
  });

  it("the resolver finds a tape of that night with the song today → resolver_found_tape", () => {
    expect(classify(nightReport({ unreachable: false, recordingFound: true, recordingsThatNight: 3 }))).toBe("resolver_found_tape");
  });

  it("the Archive lists no recording of that date → no_tape_of_night", () => {
    expect(classify(nightReport({ unreachable: false, recordingFound: false, recordingsThatNight: 0 }))).toBe("no_tape_of_night");
  });

  it("recordings of that date exist but none carries the song → song_not_on_night", () => {
    expect(classify(nightReport({ unreachable: false, recordingFound: false, recordingsThatNight: 10 }))).toBe("song_not_on_night");
  });

  it("the night could not be asked → archive_unreachable, never no_tape_of_night", () => {
    expect(classify(nightReport({ unreachable: true, recordingFound: false, recordingsThatNight: 0 }))).toBe("archive_unreachable");
  });

  it("the count failed and no tape was found → needs_human, not a guess", () => {
    expect(classify(nightReport({ unreachable: false, recordingFound: false, recordingsThatNight: null }))).toBe("needs_human");
  });

  it("nothing to go on → needs_human", () => {
    expect(classify(nightReport(undefined))).toBe("needs_human");
  });
});
