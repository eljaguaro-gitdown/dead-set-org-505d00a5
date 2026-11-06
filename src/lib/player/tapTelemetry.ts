/**
 * Tap-to-sound telemetry: what happened between a fan pressing play and the
 * music, measured from the tap itself.
 *
 * Until this existed nothing measured that interval. `audio_play_started`
 * fires when a slot is SET, which is after any lookup, and `audio_error`
 * carries no tap to belong to, so a tap that resolved for nine seconds and
 * then played looked exactly like one that took 400ms. Every play entry point
 * now mints a tap synchronously (in the handler, before any await) and sends:
 *
 *   play_requested  { tap_id, surface, song_id, show_date, has_precomputed }
 *   then EXACTLY ONE of
 *   play_first_sound { tap_id, ms }                 first progress tick > 0
 *   play_failed      { tap_id, ms, kind, stage }    whichever way it died
 *
 * `stage` names the leg the tap was on: lookup (the Archive's search, or the
 * precomputed index), metadata (an item's file list), match (the title
 * matcher), redirect (/download/ → mirror, i.e. the engine has the url and
 * the browser is fetching), buffer (bytes arriving, no sound yet), gesture
 * (the browser refused autoplay).
 *
 * Two owners for one tap. A SURFACE may begin the tap (beginTap) when work
 * sits between its handler and the player — the version picker looks the
 * night up before it calls playSingle — so the clock starts at the finger.
 * The PLAYER claims it (claimTap) in playSingle/playSetlist; if no surface
 * began one, the player mints it there, which for most surfaces is still
 * inside the handler. A newer claim settles an unsettled older tap as
 * `superseded`, so the "exactly one" rule holds across impatient re-taps.
 *
 * PostHog conventions: ids, enums and numbers only — no titles, no free text.
 * The same record also goes out as a DOM event (`deadset:tap`) and into a
 * small ring buffer on window, which is how TapeBench reads it from a browser
 * that has no PostHog token. Analytics must never break the tape: every
 * emit is wrapped.
 */
import { captureEvent } from "@/lib/posthog";
import { audioDebug } from "@/lib/audioDebug";

export type TapSurface =
  | "landing_hero"
  | "songbook_spotlight"
  | "version_picker"
  | "songbook_issue"
  | "songbook"
  | "song_page"
  | "setlist_poster"
  | "setlist_button"
  | "builder"
  | "my_setlists"
  | "browse"
  | "charlie"
  | "oops_suggestion"
  | "fixed_tape"
  | "plan_b"
  | "share_autoplay"
  | "other";

export type TapStage = "lookup" | "metadata" | "match" | "redirect" | "buffer" | "gesture";

export type TapFailKind =
  | "not_on_tape"
  | "no_tape"
  | "none_in_setlist"
  | "unreachable"
  | "uncertain"
  | "wont_play"
  | "autoplay_blocked"
  | "timeout"
  | "superseded"
  | "stopped";

export interface TapMeta {
  songId?: string | null;
  showDate?: string | null;
  /** The tap came with a track url already in hand (index hit, known-good tape). */
  hasPrecomputed?: boolean | null;
  slotId?: string | null;
}

export interface Tap extends TapMeta {
  id: string;
  surface: TapSurface;
  startedAt: number;
  stage: TapStage;
  settled: boolean;
  /** The player took ownership (playSingle/playSetlist). */
  claimed: boolean;
}

export interface TapRecord {
  event: "play_requested" | "play_first_sound" | "play_failed";
  tap_id: string;
  surface: TapSurface;
  ms?: number;
  kind?: TapFailKind;
  stage?: TapStage;
  song_id?: string | null;
  show_date?: string | null;
  has_precomputed?: boolean | null;
  at: number;
}

/** A tap a surface began but the player has not claimed yet. */
let pending: Tap | null = null;
/** The tap the player is working on. */
let active: Tap | null = null;

/** A surface's tap is the player's next claim only for this long. */
const PENDING_TTL_MS = 30_000;
const RING_SIZE = 50;

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const mintId = (): string => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `tap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

type TapWindow = Window & { __deadSetTaps?: TapRecord[] };

function emit(record: TapRecord): void {
  try {
    const { event, at: _at, ...props } = record;
    captureEvent(event, props);
  } catch {
    /* analytics must never break the tape */
  }
  try {
    if (typeof window !== "undefined") {
      const w = window as TapWindow;
      const ring = (w.__deadSetTaps ??= []);
      ring.push(record);
      if (ring.length > RING_SIZE) ring.splice(0, ring.length - RING_SIZE);
      window.dispatchEvent(new CustomEvent("deadset:tap", { detail: record }));
    }
  } catch {
    /* ditto */
  }
  try {
    audioDebug.log("tap", record.event, { ...record } as unknown as Record<string, unknown>,
      record.event === "play_failed" ? "warn" : "info");
  } catch {
    /* ditto */
  }
}

const requestedRecord = (t: Tap): TapRecord => ({
  event: "play_requested",
  tap_id: t.id,
  surface: t.surface,
  song_id: t.songId ?? null,
  show_date: t.showDate ?? null,
  has_precomputed: t.hasPrecomputed ?? null,
  at: Date.now(),
});

function mint(surface: TapSurface, meta: TapMeta): Tap {
  const tap: Tap = {
    id: mintId(),
    surface,
    startedAt: now(),
    stage: "lookup",
    settled: false,
    claimed: false,
    ...meta,
  };
  emit(requestedRecord(tap));
  return tap;
}

function settle(tap: Tap, record: Omit<TapRecord, "tap_id" | "surface" | "at">): void {
  if (tap.settled) return;
  tap.settled = true;
  emit({ ...record, tap_id: tap.id, surface: tap.surface, at: Date.now() });
}

/**
 * Begin a tap in a surface's handler, synchronously, before any await. The
 * player claims it next; until then it is pending.
 */
export function beginTap(surface: TapSurface, meta: TapMeta = {}): Tap {
  const tap = mint(surface, meta);
  pending = tap;
  return tap;
}

/**
 * The player's half: take the surface's pending tap, or mint one here. Any
 * tap still waiting for sound is superseded — one finger, one answer.
 */
export function claimTap(fallbackSurface: TapSurface, meta: TapMeta = {}): Tap {
  if (active && !active.settled) {
    settle(active, { event: "play_failed", ms: Math.round(now() - active.startedAt), kind: "superseded", stage: active.stage });
  }
  let tap: Tap;
  if (pending && !pending.claimed && now() - pending.startedAt <= PENDING_TTL_MS) {
    tap = pending;
    // The surface may not have known these at the finger (the hero reads its
    // slots after the tap); the record already went out, but the tap keeps
    // them for the bench and for the first-sound match on slot id.
    if (meta.slotId && !tap.slotId) tap.slotId = meta.slotId;
    if (meta.songId && !tap.songId) tap.songId = meta.songId;
    if (meta.showDate && !tap.showDate) tap.showDate = meta.showDate;
    if (tap.hasPrecomputed == null && meta.hasPrecomputed != null) tap.hasPrecomputed = meta.hasPrecomputed;
  } else {
    tap = mint(fallbackSurface, meta);
  }
  tap.claimed = true;
  pending = null;
  active = tap;
  return tap;
}

/** The leg the active tap is on now. */
export function tapStage(stage: TapStage): void {
  if (active && !active.settled) active.stage = stage;
}

/** The slot the active tap ended up on (Play All picks its first playable slot late). */
export function tapSlot(slotId: string | null): void {
  if (active && !active.settled) active.slotId = slotId;
}

/**
 * Sound. Called from the progress subscriber on every tick; the first tick
 * with real time settles the tap, later ticks are ignored. `slotId` guards
 * against a tick from a slot the tap was not about (the previous track still
 * ticking as the new one resolves).
 */
export function tapFirstSound(slotId?: string | null): void {
  if (!active || active.settled) return;
  if (slotId && active.slotId && slotId !== active.slotId) return;
  settle(active, { event: "play_first_sound", ms: Math.round(now() - active.startedAt) });
}

/** The tap died. `stage` defaults to wherever it was. */
export function tapFailed(kind: TapFailKind, stage?: TapStage): void {
  if (!active || active.settled) return;
  settle(active, { event: "play_failed", ms: Math.round(now() - active.startedAt), kind, stage: stage ?? active.stage });
}

/** The tap the player is on, or null. For tests and the bench. */
export const activeTap = (): Tap | null => active;

/** Test seam. */
export function resetTaps(): void {
  pending = null;
  active = null;
  try {
    if (typeof window !== "undefined") (window as TapWindow).__deadSetTaps = [];
  } catch {
    /* ignore */
  }
}

/**
 * Which surface a tap came from, when no handler said. Most controls call
 * playSingle inside their own click handler, so the route is a faithful
 * witness; the ones with an await in between call beginTap themselves.
 */
export function surfaceFromPath(pathname: string): TapSurface {
  if (pathname.startsWith("/versions/")) return "version_picker";
  if (pathname.startsWith("/songbook/")) return "songbook_issue";
  if (pathname === "/songbook") return "songbook";
  if (pathname.startsWith("/setlist/")) return "setlist_poster";
  if (pathname.startsWith("/song/") || pathname.startsWith("/songs/")) return "song_page";
  if (pathname.startsWith("/builder")) return "builder";
  if (pathname.startsWith("/my-setlists")) return "my_setlists";
  if (pathname.startsWith("/browse")) return "browse";
  if (pathname === "/" || pathname === "") return "landing_hero";
  return "other";
}
