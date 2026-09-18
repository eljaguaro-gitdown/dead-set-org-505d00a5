/**
 * Prompt construction for Cosmic Charlie's liner notes.
 *
 * Kept out of index.ts, and free of any Deno API, so the copy rules it
 * encodes can be unit-tested from the app's Vitest suite — this text becomes
 * user-facing writing, so the voice constraints in CLAUDE.md apply to it.
 */

export interface DescribeWindow {
  start: number;
  end: number;
  /** Name of the era the window lines up with, when it is a named one. */
  eraName?: string | null;
}

export interface DescribeVersionInput {
  date?: string | null;
  venue?: string | null;
  rating?: number | null;
}

/** "1974" for a single year, "1974–76" for a span inside one century. */
export function windowLabel(window: DescribeWindow): string {
  const { start, end } = window;
  if (start === end) return String(start);
  const sameCentury = Math.floor(start / 100) === Math.floor(end / 100);
  return sameCentury ? `${start}–${String(end).slice(-2)}` : `${start}–${end}`;
}

/**
 * Accept a window off the wire only if it is a sane pair of years. Anything
 * else is dropped rather than rejected, so a client that sends nothing — or
 * sends junk — still gets general notes instead of an error.
 */
export function normalizeWindow(raw: unknown): DescribeWindow | null {
  if (!raw || typeof raw !== "object") return null;
  const { start, end, eraName } = raw as Record<string, unknown>;
  if (typeof start !== "number" || typeof end !== "number") return null;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 1900 || end < 1900 || start > 2100 || end > 2100) return null;

  const [lo, hi] = start <= end ? [start, end] : [end, start];

  // The era name reaches the prompt verbatim, so keep it to one short line.
  const name =
    typeof eraName === "string"
      ? eraName.replace(/[\r\n`]/g, " ").trim().slice(0, 60)
      : "";

  return { start: lo, end: hi, eraName: name || null };
}

/** The rules that hold whether or not a window was chosen. */
const VOICE = `Describe the music structurally and by its energy — how far the jam goes, how long, how hard they push, how it moves into the next thing, the era, who was on stage. Never reach for genre adjectives. Recordings circulate or are on tape; they are not "available", "streaming", or "in the catalogue". Stay a tape trader throughout: never mention tools, models, or how these notes came to be written.`;

export function buildDescribePrompt(
  songTitle: string,
  versions: DescribeVersionInput[],
  window: DescribeWindow | null
): string {
  const versionList = versions
    .map(
      (v, i) =>
        `${i + 1}. ${v.date} — ${v.venue || "Unknown venue"} (rating: ${v.rating ?? "N/A"})`
    )
    .join("\n");

  const label = window ? windowLabel(window) : null;
  const era = window?.eraName ? `, the ${window.eraName} era` : "";

  // With a window, the note has to earn the version its place among what else
  // circulates from those years — not crown it against the whole history.
  const windowFraming = label
    ? `\n\nEvery recording below circulates from ${label}${era}. Weigh each one against the others in ${label}, not against every version ever played: say what this night has that its neighbours in that window do not. A version that stands out in ${label} is the standout of ${label} — never call it the best ever.`
    : "";

  return `You are Cosmic Charlie, a veteran Grateful Dead tape trader and historian. For each live recording of "${songTitle}" listed below, write ONE evocative sentence (max 20 words) capturing what makes that particular version special — the energy, the jam, the moment. Channel David Lemieux liner notes: vivid, specific, enthusiastic but not hyperbolic. If you don't have specific knowledge of that show, infer from the era and venue.${windowFraming}

${VOICE}

Recordings:
${versionList}

Reply as a JSON array of strings, one per recording, in the same order. No preamble, just the JSON array.`;
}
