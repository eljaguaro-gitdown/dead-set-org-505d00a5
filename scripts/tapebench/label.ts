/**
 * Ground truth for the TapeBench corpus: does a tape of this song on this
 * night exist on the Archive, as far as the PLAYER'S OWN resolver can tell?
 *
 *   NODE_USE_ENV_PROXY=1 npx vite-node --config vitest.config.ts scripts/tapebench/label.ts -- \
 *     [--corpus scripts/tapebench/corpus.json] [--out scripts/tapebench/labels.json] [--limit N]
 *
 * Why the player's resolver and not a second matcher: the same reason as
 * scripts/tape-desk/probe.ts. A label the player would disagree with grades
 * the player against a rule it does not follow. So "yes" here means
 * findTrackInRecordingDetailed / findRecordingForDate found a track, "no"
 * means the Archive lists no Grateful Dead recording of the night at all,
 * and "unknown" covers the two cases the resolver cannot settle: tapes of
 * the night exist but no track matched (a medley or an untitled segue is
 * the usual reason), and the Archive could not be asked.
 *
 * Labels are an input to the bench, not an output of it: a tap on a "no"
 * night can only succeed through Plan B, and a tap on an "unknown" night
 * is scored but reported separately, because the matcher is one of the
 * things the sprint is fixing.
 */
import fs from "node:fs";
import { findRecordingForDate, findTrackInRecordingDetailed } from "../../src/lib/archiveOrg";

function arg(name: string, dflt: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : dflt;
}

type Truth = "yes" | "no" | "unknown";
interface Label {
  id: string;
  truth: Truth;
  reason: string;
  /** What the resolver found, when it found something. */
  identifier?: string | null;
  track?: string | null;
  ms: number;
  labelledAt: string;
}

const idOf = (url: string | null | undefined) => url?.match(/archive\.org\/(?:details|download)\/([^/?#]+)/)?.[1] ?? null;

async function labelTap(t: { title: string; showDate: string | null; archiveUrl: string | null; trackUrl?: string | null }): Promise<Omit<Label, "id" | "ms" | "labelledAt">> {
  // A stored recording: is the song on it? If not, the night decides.
  if (t.archiveUrl) {
    const r = await findTrackInRecordingDetailed(t.archiveUrl, t.title);
    if (r.url) return { truth: "yes", reason: "song found on the stored recording", identifier: idOf(t.archiveUrl), track: r.url };
    if (r.unreachable) return { truth: "unknown", reason: "stored recording could not be read" };
    if (!t.showDate) return { truth: "unknown", reason: "stored recording lacks the song and the tap names no night" };
  }
  if (!t.showDate) return { truth: "unknown", reason: "no night and no recording" };
  try {
    const night = await findRecordingForDate(t.title, t.showDate);
    if (night?.directTrackUrl) return { truth: "yes", reason: t.archiveUrl ? "another tape of the night carries the song" : "a tape of the night carries the song", identifier: idOf(night.url), track: night.directTrackUrl };
    if (night) return { truth: "unknown", reason: "tapes of the night exist; no track matched the title", identifier: idOf(night.url), track: null };
    return { truth: "no", reason: "the Archive lists no Grateful Dead recording of the night" };
  } catch (e) {
    return { truth: "unknown", reason: `could not ask the Archive: ${String(e).slice(0, 80)}` };
  }
}

async function main() {
  const corpusPath = arg("corpus", "scripts/tapebench/corpus.json");
  const outPath = arg("out", "scripts/tapebench/labels.json");
  const limit = Number(arg("limit", "0"));
  const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
  const prior: Record<string, Label> = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")).labels ?? {} : {};
  const labels: Record<string, Label> = { ...prior };
  let done = 0;
  for (const t of corpus.taps) {
    if (limit && done >= limit) break;
    if (labels[t.id] && labels[t.id].truth !== "unknown") continue; // settled answers are kept; unknowns are re-asked
    const t0 = Date.now();
    const l = await labelTap(t);
    labels[t.id] = { id: t.id, ...l, ms: Date.now() - t0, labelledAt: new Date().toISOString() };
    done++;
    process.stderr.write(`${String(done).padStart(4)} ${l.truth.padEnd(7)} ${t.title} ${t.showDate ?? ""} — ${l.reason}\n`);
    // Stewardship: one night at a time, with a breath between.
    await new Promise((r) => setTimeout(r, 150));
    fs.writeFileSync(outPath, JSON.stringify({ corpusVersion: corpus.version, labels }, null, 1));
  }
  const all = Object.values(labels);
  const count = (tr: Truth) => all.filter((l) => l.truth === tr).length;
  console.error(`labels: ${all.length} — yes ${count("yes")}, no ${count("no")}, unknown ${count("unknown")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
