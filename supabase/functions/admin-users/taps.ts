/**
 * Field tap health for the admin dashboard: what fans got when they pressed
 * play, from the tap telemetry (src/lib/player/tapTelemetry.ts) — every tap
 * sends play_requested, then exactly one of play_first_sound or play_failed.
 *
 * The playback sprint's field confirmation (docs/playback-sprint/STATUS.md):
 * once there are more than 100 instrumented taps in a rolling 7 days, success
 * must hold at ≥ 97% and tap-to-sound p90 at ≤ 3.5 s. Below 100 taps the
 * numbers are a smoke signal, and the card says so.
 *
 * Definitions:
 *   taps      fans' taps: play_requested from any surface but Plan B's own
 *   answered  taps less those the fan abandoned (superseded, stopped)
 *   sounded   play_first_sound within 15 s, from a fan's tap OR from the
 *             Plan B that stood in for it (a fan who heard music is served)
 *   success   sounded / answered
 *   p50, p90  tap-to-sound over fans' taps that sounded on their own
 *
 * Free of Deno APIs, like traffic.ts, so Vitest and tsc can load it.
 */
export const buildTapHealthSql = (externalTrafficWhere: string): string => `
  SELECT
    countIf(event = 'play_requested' AND properties.surface != 'plan_b') AS taps,
    countIf(event = 'play_failed' AND properties.surface != 'plan_b' AND properties.kind IN ('superseded', 'stopped')) AS abandoned,
    countIf(event = 'play_first_sound' AND toFloat(properties.ms) <= 15000) AS sounded,
    countIf(event = 'play_failed' AND properties.surface != 'plan_b' AND properties.kind = 'autoplay_blocked') AS blocked,
    countIf(event = 'play_requested' AND properties.surface = 'plan_b') AS planB,
    quantileIf(0.5)(toFloat(properties.ms), event = 'play_first_sound' AND properties.surface != 'plan_b') AS p50,
    quantileIf(0.9)(toFloat(properties.ms), event = 'play_first_sound' AND properties.surface != 'plan_b') AS p90
  FROM events
  WHERE event IN ('play_requested', 'play_first_sound', 'play_failed')
    AND timestamp >= now() - INTERVAL 7 DAY
    AND ${externalTrafficWhere}`;

export interface TapHealth {
  taps: number;
  answered: number;
  sounded: number;
  blocked: number;
  planB: number;
  /** 0..1, or null with no answered taps. */
  success: number | null;
  p50Ms: number | null;
  p90Ms: number | null;
  /** The sprint's field gate applies only past this many taps. */
  enoughToJudge: boolean;
}

export const FIELD_MIN_TAPS = 100;

const num = (raw: unknown): number | null => {
  const v = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  return Number.isFinite(v) && v >= 0 ? v : null;
};

/** The single row as tap health, or null when PostHog did not answer: shown as "—", never as 0. */
export const toTapHealth = (rows: Array<Record<string, unknown>> | null): TapHealth | null => {
  const row = rows?.[0];
  if (!row) return null;
  const taps = num(row.taps);
  const abandoned = num(row.abandoned);
  const sounded = num(row.sounded);
  if (taps === null || abandoned === null || sounded === null) return null;
  const answered = Math.max(0, taps - abandoned);
  return {
    taps,
    answered,
    sounded,
    blocked: num(row.blocked) ?? 0,
    planB: num(row.planB) ?? 0,
    success: answered > 0 ? Math.min(1, sounded / answered) : null,
    // quantile over nothing comes back NaN; that is "no data", not 0 ms.
    p50Ms: num(row.p50),
    p90Ms: num(row.p90),
    enoughToJudge: taps > FIELD_MIN_TAPS,
  };
};
