import { Headphones } from "lucide-react";

/**
 * Field tap health, from the tap telemetry via admin-users (taps.ts there).
 * The playback sprint's field gate: once there are more than 100 taps in a
 * rolling 7 days, success ≥ 97% and tap-to-sound p90 ≤ 3.5 s. Below that the
 * card says the numbers are a smoke signal. Unanswered shows "—", never 0.
 */
export interface TapHealth {
  taps: number;
  answered: number;
  sounded: number;
  blocked: number;
  planB: number;
  success: number | null;
  p50Ms: number | null;
  p90Ms: number | null;
  enoughToJudge: boolean;
}

/** Only a well-formed payload is shown; anything else reads as unanswered. */
export function readTapHealth(raw: unknown): TapHealth | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
  if (n(r.taps) === null || n(r.answered) === null || n(r.sounded) === null) return null;
  return {
    taps: n(r.taps)!, answered: n(r.answered)!, sounded: n(r.sounded)!,
    blocked: n(r.blocked) ?? 0, planB: n(r.planB) ?? 0,
    success: typeof r.success === "number" && r.success >= 0 && r.success <= 1 ? r.success : null,
    p50Ms: n(r.p50Ms), p90Ms: n(r.p90Ms), enoughToJudge: r.enoughToJudge === true,
  };
}

const secs = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1)} s`);
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);

const AdminTapHealth = ({ taps, loading }: { taps: TapHealth | null; loading: boolean }) => {
  const shown = !loading && taps;
  const meets = shown && taps.enoughToJudge
    ? (taps.success ?? 0) >= 0.97 && taps.p90Ms !== null && taps.p90Ms <= 3500
    : null;
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden" data-tap-health>
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Headphones className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-display text-sm text-card-foreground">Tap to sound (7d)</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4">
        {([
          ["Taps", shown ? String(taps.taps) : "—"],
          ["Sound ≤ 15 s", shown ? pct(taps.success) : "—"],
          ["p50", shown ? secs(taps.p50Ms) : "—"],
          ["p90", shown ? secs(taps.p90Ms) : "—"],
          ["Plan B / blocked", shown ? `${taps.planB} / ${taps.blocked}` : "—"],
        ] as const).map(([label, value]) => (
          <div key={label} className="text-center">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">{label}</p>
            <p className="font-display text-2xl text-card-foreground mt-1">{value}</p>
          </div>
        ))}
      </div>
      <p className="px-4 pb-3 text-[11px] text-muted-foreground font-body">
        {!loading && !taps
          ? "Tap health unavailable: PostHog didn't answer."
          : shown && !taps.enoughToJudge
            ? `Under 100 taps this week: a smoke signal, not a rate. Target once past 100: ≥ 97% and p90 ≤ 3.5 s.`
            : meets === null
              ? "Target: ≥ 97% sound within 15 s and p90 ≤ 3.5 s, over 100+ taps."
              : meets
                ? "Meets the field target (≥ 97%, p90 ≤ 3.5 s)."
                : "Below the field target (≥ 97%, p90 ≤ 3.5 s). See docs/playback-sprint."}
      </p>
    </div>
  );
};

export default AdminTapHealth;
