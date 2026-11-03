/**
 * Reproduce a playback report from the server side, the way a fan's player
 * would have met it, and name the cause.
 *
 *   npx vite-node --config vitest.config.ts scripts/tape-desk/probe.ts -- \
 *     --song "Jack Straw" --date 1971-10-19 \
 *     --track https://archive.org/download/<id>/<file>   (or --archive https://archive.org/details/<id>)
 *
 * Prints one JSON object (the evidence and the verdict) on stdout.
 *
 * WHY IT IMPORTS THE APP'S RESOLVER
 *
 * The tape desk must ask the Archive the same question the player asked. A
 * second matcher written here would drift from src/lib/archiveOrg.ts, the
 * silent-divergence trap CLAUDE.md keeps banking, and triage would then grade
 * the player against a rule the player does not follow. So the "which track,
 * which night" legs call findTrackInRecordingDetailed and findRecordingForDate
 * directly. Only delivery (does the file actually come down) is probed here,
 * because no app function does that.
 *
 * WHY THE RANGES
 *
 * Safari streams audio with byte-range requests: a two-byte probe first, then
 * chunks, then the tail as it plays. A mirror can serve the head and fail the
 * tail, which looks to a fan like a tape that starts and dies. So every host
 * gets the same three ranges, several times each, because the failure that
 * prompted this (dn720308.ca.archive.org, 2026-10-31) was intermittent.
 *
 * STEWARDSHIP
 *
 * About 30 small requests per run, all for one file. The playbook runs it once
 * per report at triage, not on every hourly pass.
 */
import { findRecordingForDate, findTrackInRecordingDetailed } from "../../src/lib/archiveOrg";
import { classify, hostHealthy, type HostProbe, type ProbeResult, type TapeEvidence } from "./classify";

const TIMEOUT_MS = 15_000;

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null;
}

async function timedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function probeRange(url: string, range: string): Promise<ProbeResult & { contentType: string | null }> {
  try {
    const res = await timedFetch(url, { headers: { Range: `bytes=${range}` } });
    const contentType = res.headers.get("content-type");
    const body = new Uint8Array(await res.arrayBuffer());
    const startsLikeHtml = body.length > 0 && body[0] === 0x3c; // "<"
    return { range, status: res.status, html: /text\/html/i.test(contentType ?? "") || startsLikeHtml, contentType };
  } catch {
    return { range, status: 0, html: false, contentType: null };
  }
}

/** Where archive.org/download sends this request: the Location host of the first redirect. */
async function routedUrl(trackUrl: string): Promise<string | null> {
  try {
    const res = await timedFetch(trackUrl, { redirect: "manual", headers: { Range: "bytes=0-1" } });
    const loc = res.headers.get("location");
    await res.arrayBuffer().catch(() => undefined);
    return loc ? new URL(loc, trackUrl).toString() : null;
  } catch {
    return null;
  }
}

async function main() {
  const song = arg("song");
  const date = arg("date");
  const track = arg("track");
  const archive = arg("archive");
  const samples = Number(arg("samples") ?? 4);
  if (!song || (!track && !archive && !date)) {
    console.error('usage: probe.ts -- --song "<title>" [--date YYYY-MM-DD] [--track <download url>] [--archive <details url>] [--samples N]');
    process.exit(2);
  }

  const identifier =
    (track ?? "").match(/archive\.org\/download\/([^/?#]+)\//)?.[1] ??
    (archive ?? "").match(/archive\.org\/details\/([^/?#]+)/)?.[1] ??
    null;
  const filePath = track ? decodeURIComponent((track.match(/archive\.org\/download\/[^/]+\/(.+)$/)?.[1] ?? "").split("?")[0]) : null;

  // 1. The item, fetched directly: does it exist, is it dark, which servers hold it.
  let metadata: TapeEvidence["metadata"] = "ok";
  let meta: Record<string, unknown> | null = null;
  if (identifier) {
    try {
      const res = await timedFetch(`https://archive.org/metadata/${identifier}`);
      if (!res.ok) metadata = "unreachable";
      else {
        meta = (await res.json()) as Record<string, unknown>;
        if (!meta || Object.keys(meta).length === 0 || !meta.files) metadata = "missing";
        else if (meta.is_dark) metadata = "dark";
      }
    } catch {
      metadata = "unreachable";
    }
  }
  const files = ((meta?.files as Array<Record<string, unknown>>) ?? []);
  const file = filePath ? files.find((f) => f.name === filePath) ?? null : null;

  // 2. The player's own answer today.
  let resolverTrack: TapeEvidence["resolverTrack"] = null;
  if (identifier && metadata === "ok") {
    const r = await findTrackInRecordingDetailed(`https://archive.org/details/${identifier}`, song);
    resolverTrack = r.unreachable ? "unreachable" : r.url;
  }

  let night: TapeEvidence["night"];
  let nightRecording: unknown = null;
  if (date) {
    let unreachable = false;
    let recordingFound = false;
    try {
      nightRecording = await findRecordingForDate(song, date);
      recordingFound = nightRecording !== null;
    } catch {
      unreachable = true;
    }
    let recordingsThatNight: number | null = null;
    try {
      const q = encodeURIComponent(`collection:GratefulDead AND date:[${date} TO ${date}]`);
      const res = await timedFetch(`https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&rows=0&output=json`);
      if (res.ok) recordingsThatNight = ((await res.json()) as { response: { numFound: number } }).response.numFound;
    } catch {
      /* the count is context, not a verdict input on its own */
    }
    night = { unreachable, recordingFound, recordingsThatNight };
  }

  // 3. Delivery: where the Archive routes the file, and the item's own servers.
  const hosts: HostProbe[] = [];
  const size = Number(file?.size ?? 0);
  const ranges = ["0-1", "0-65535", ...(size > 131072 ? [`${size - 65536}-${size - 1}`] : [])];
  const routedSeen: Record<string, number> = {};
  if (track && file && metadata === "ok") {
    const routedByHost = new Map<string, string>();
    for (let i = 0; i < samples * 2; i++) {
      const u = await routedUrl(track);
      const host = u ? new URL(u).host : "(no redirect)";
      routedSeen[host] = (routedSeen[host] ?? 0) + 1;
      if (u && !routedByHost.has(host)) routedByHost.set(host, u);
    }
    const encodedPath = track.match(/archive\.org\/download\/[^/]+\/(.+)$/)?.[1] ?? "";
    const workable = ((meta?.workable_servers as string[]) ?? []).map((s) => `https://${s}${meta?.dir as string}/${encodedPath}`);
    const targets: Array<[string, "routed" | "workable", number]> = [
      ...[...routedByHost.values()].map((u) => [u, "routed", samples] as [string, "routed", number]),
      ...workable.map((u) => [u, "workable", 2] as [string, "workable", number]),
    ];
    for (const [url, role, n] of targets) {
      const results: Array<ProbeResult & { contentType: string | null }> = [];
      for (const range of ranges) for (let i = 0; i < n; i++) results.push(await probeRange(url, range));
      hosts.push({ host: new URL(url).host, role, results });
    }
  }

  const evidence: TapeEvidence = {
    hasRecording: Boolean(identifier),
    metadata,
    reportedTrack: track,
    fileInItem: track ? Boolean(file) : null,
    resolverTrack,
    night,
    hosts,
  };
  const verdict = classify(evidence);

  const summary = hosts.map((h) => ({
    host: h.host,
    role: h.role,
    healthy: hostHealthy(h),
    byRange: Object.fromEntries(
      ranges.map((r) => [r, h.results.filter((x) => x.range === r).map((x) => (x.html ? `${x.status}html` : String(x.status))).join(" ")]),
    ),
  }));

  console.log(
    JSON.stringify(
      {
        probedAt: new Date().toISOString(),
        input: { song, date, track, archive },
        item: identifier
          ? {
              identifier,
              metadata,
              file: file ? { name: file.name, title: file.title ?? null, format: file.format, size } : null,
              workableServers: meta?.workable_servers ?? null,
            }
          : null,
        resolver: { track: resolverTrack, sameAsReported: track ? resolverTrack === track : null },
        night: night ? { ...night, recording: nightRecording } : null,
        routing: routedSeen,
        delivery: summary,
        verdict,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
