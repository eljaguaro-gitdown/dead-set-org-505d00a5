/**
 * The tape desk's verdict: given what the probe saw, name the cause of a
 * playback report. Pure, so it can be tested without the network; the probe
 * (probe.ts) gathers the evidence and the playbook (docs/tape-desk.md) maps
 * each verdict to what happens next.
 *
 * A verdict is a claim about the cause, and the order of the checks below is
 * the order in which one cause hides another: an Archive that did not answer
 * says nothing about the tape, a missing file says nothing about mirrors, and
 * a resolver that now picks a different file makes the reported file's
 * delivery beside the point.
 */

/** status 0 = the request never got an answer (timeout, reset, DNS). */
export interface ProbeResult {
  range: string;
  status: number;
  /** The body was an HTML page where audio was expected. Safari reports this as MediaError code 4. */
  html: boolean;
}

export interface HostProbe {
  host: string;
  /** "routed": where archive.org/download sent us. "workable": the item's own servers from its metadata. */
  role: "routed" | "workable";
  results: ProbeResult[];
}

export interface TapeEvidence {
  /** The report names a recording (an archive.org details url), with or without a track in it. */
  hasRecording: boolean;
  /** The item's metadata, fetched directly. "missing" = the Archive answered {} (no such item). */
  metadata: "ok" | "unreachable" | "missing" | "dark";
  /** The track the fan's player tried. Null when the report was filed before any track was found. */
  reportedTrack: string | null;
  /** Whether the reported track's file is listed in the item. Null when there is no reported track. */
  fileInItem: boolean | null;
  /**
   * What the player's own resolver (findTrackInRecordingDetailed) picks for this
   * song in this recording today: a url, null for "not on this tape", or
   * "unreachable" when it could not ask. Null as well when there is no recording.
   */
  resolverTrack: string | null | "unreachable";
  /** The by-night leg (findRecordingForDate), when the report names a night. */
  night?: {
    unreachable: boolean;
    recordingFound: boolean;
    /** How many Grateful Dead recordings of that date the Archive lists; null if the count failed. */
    recordingsThatNight: number | null;
  };
  hosts: HostProbe[];
}

export type Verdict =
  | "archive_unreachable"
  | "tape_dark"
  | "track_missing"
  | "song_not_on_tape"
  | "song_on_other_tape"
  | "wrong_track"
  | "tape_unservable"
  | "mirror_failure"
  | "plays_now"
  | "resolver_found_tape"
  | "no_tape_of_night"
  | "song_not_on_night"
  | "needs_human";

export const passes = (r: ProbeResult): boolean => (r.status === 200 || r.status === 206) && !r.html;

/** A host is healthy only when every probe of it passed. One 500 in six is a sick mirror, not a healthy one. */
export const hostHealthy = (h: HostProbe): boolean => h.results.length > 0 && h.results.every(passes);

export function classify(e: TapeEvidence): Verdict {
  if (e.metadata === "unreachable") return "archive_unreachable";
  if (e.metadata === "dark") return "tape_dark";

  if (e.reportedTrack) {
    if (e.metadata === "missing" || e.fileInItem === false) return "track_missing";
    if (e.resolverTrack === "unreachable") return "archive_unreachable";
    if (e.resolverTrack === null) return "song_not_on_tape";
    if (e.resolverTrack !== e.reportedTrack) return "wrong_track";

    if (!e.hosts.some(hostHealthy)) return "tape_unservable";
    const routedSick = e.hosts.some((h) => h.role === "routed" && !hostHealthy(h));
    if (routedSick) return "mirror_failure";
    return "plays_now";
  }

  if (e.hasRecording) {
    if (e.metadata === "missing") return "track_missing";
    if (e.resolverTrack === "unreachable") return "archive_unreachable";
    if (typeof e.resolverTrack === "string") return "resolver_found_tape";
    // The named recording lacks the song. Whether another tape of the night
    // carries it decides between a catalog repoint and a night with no such song.
    if (e.night?.recordingFound) return "song_on_other_tape"; // found implies the lookup answered
    if (e.night?.unreachable) return "archive_unreachable";
    return "song_not_on_tape";
  }

  if (e.night) {
    if (e.night.unreachable) return "archive_unreachable";
    if (e.night.recordingFound) return "resolver_found_tape";
    if (e.night.recordingsThatNight === 0) return "no_tape_of_night";
    if (e.night.recordingsThatNight !== null && e.night.recordingsThatNight > 0) return "song_not_on_night";
  }
  return "needs_human";
}
