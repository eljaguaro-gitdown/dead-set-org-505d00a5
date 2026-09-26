/**
 * /lab/sleepers — a bench for the sleeper rule.
 *
 * Unlisted and unlinked, in the manner of /audio-diag. The point is to run the
 * SHIPPING rule over many songs quickly and decide whether its answers are
 * good, so it imports `scoreSleepers` from the same shared module the
 * score-sleepers edge function uses rather than reimplementing it. If a
 * threshold is changed here and the results are better, the change belongs in
 * DEFAULT_THRESHOLDS — this page is where that argument gets evidence.
 *
 * It calls archive.org straight from the browser, exactly as
 * `src/lib/archiveOrg.ts` already does in production, so it needs no deployed
 * function and runs against real data on `bun run dev`.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Play, Square } from "lucide-react";
import {
  DEFAULT_THRESHOLDS,
  buildArchiveSearchUrl,
  scoreSleepers,
  toRecordings,
  type ScoredRecording,
  type SleeperThresholds,
} from "../../supabase/functions/_shared/sleeperScore";

/** A spread of songs across eras, popularity and jam-vehicle status. */
const STARTER_SONGS = [
  "Scarlet Begonias",
  "Crazy Fingers",
  "Shakedown Street",
  "Dark Star",
  "Eyes of the World",
  "Ripple",
  "China Cat Sunflower",
  "Sugaree",
  "Terrapin Station",
  "Help on the Way",
  "Franklin's Tower",
  "Morning Dew",
  "Wharf Rat",
  "Bertha",
  "Touch of Grey",
].join("\n");

interface SongResult {
  song: string;
  considered: number;
  leaderPullsPerMonth: number | null;
  bestRating: number | null;
  sleepers: ScoredRecording[];
  scored: ScoredRecording[];
  error?: string;
}

const VERDICT_COLOR: Record<string, string> = {
  sleeper: "text-dead-gold",
  leader: "text-dead-cream",
  "widely-heard": "text-white/45",
  "too-few-reviews": "text-white/30",
  "rated-below-peers": "text-white/30",
  undateable: "text-white/25",
};

const n1 = (v: number | null | undefined) =>
  v == null ? "—" : v.toFixed(1);

export default function LabSleepers() {
  const [songs, setSongs] = useState(STARTER_SONGS);
  const [thresholds, setThresholds] = useState<SleeperThresholds>(DEFAULT_THRESHOLDS);
  const [rows, setRows] = useState(100);
  const [results, setResults] = useState<SongResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const cancel = useRef(false);

  const titles = useMemo(
    () => songs.split("\n").map((s) => s.trim()).filter(Boolean),
    [songs],
  );

  /** Fetch once per song; re-scoring on a threshold change reuses the rows. */
  const raw = useRef<Map<string, ReturnType<typeof toRecordings>>>(new Map());

  const run = useCallback(async () => {
    cancel.current = false;
    setRunning(true);
    setResults([]);
    const out: SongResult[] = [];

    for (let i = 0; i < titles.length; i++) {
      if (cancel.current) break;
      const song = titles[i];
      setProgress(`${i + 1}/${titles.length} · ${song}`);
      try {
        const res = await fetch(buildArchiveSearchUrl(song, { rows }), {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Archive returned ${res.status}`);
        const recordings = toRecordings(await res.json());
        raw.current.set(song, recordings);
        const report = scoreSleepers(recordings, new Date(), thresholds);
        out.push({
          song,
          considered: recordings.length,
          leaderPullsPerMonth: report.leaderPullsPerMonth,
          bestRating: report.bestRating,
          sleepers: report.sleepers,
          scored: report.scored,
        });
      } catch (e) {
        out.push({
          song,
          considered: 0,
          leaderPullsPerMonth: null,
          bestRating: null,
          sleepers: [],
          scored: [],
          error: (e as Error).message,
        });
      }
      setResults([...out]);
      // The Archive is a donated public service. One request at a time, paced.
      if (i < titles.length - 1) await new Promise((r) => setTimeout(r, 350));
    }

    setProgress(null);
    setRunning(false);
  }, [titles, rows, thresholds]);

  /** Re-score what is already fetched. No network, so tuning is instant. */
  const rescore = useCallback(
    (next: SleeperThresholds) => {
      setThresholds(next);
      setResults((prev) =>
        prev.map((r) => {
          const recordings = raw.current.get(r.song);
          if (!recordings) return r;
          const report = scoreSleepers(recordings, new Date(), next);
          return {
            ...r,
            sleepers: report.sleepers,
            scored: report.scored,
            leaderPullsPerMonth: report.leaderPullsPerMonth,
            bestRating: report.bestRating,
          };
        }),
      );
    },
    [],
  );

  const totalSleepers = results.reduce((a, r) => a + r.sleepers.length, 0);
  const withNone = results.filter((r) => !r.error && r.sleepers.length === 0).length;

  return (
    <div className="min-h-screen bg-dead-dark text-dead-cream font-mono">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-white/50 hover:text-dead-gold"
        >
          <ArrowLeft className="h-3 w-3" /> Dead Set
        </Link>

        <h1 className="mt-4 font-display text-3xl text-dead-gold">Sleeper bench</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/60">
          Runs the shipping rule over real Archive metadata, in the browser. Change a
          threshold and everything already fetched re-scores instantly — no refetch, so
          you can feel what each number does.
        </p>

        {/* ---- controls ---- */}
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_280px]">
          <div>
            <label className="text-xs uppercase tracking-widest text-white/45">
              Songs · one per line
            </label>
            <textarea
              value={songs}
              onChange={(e) => setSongs(e.target.value)}
              spellCheck={false}
              rows={10}
              className="mt-2 w-full rounded border border-white/15 bg-black/30 p-3 text-sm text-dead-cream outline-none focus:border-dead-gold"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                onClick={running ? () => (cancel.current = true) : run}
                disabled={!titles.length}
                className="inline-flex items-center gap-2 rounded bg-dead-red px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {running ? (
                  <>
                    <Square className="h-3.5 w-3.5" /> Stop
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> Run {titles.length} song
                    {titles.length === 1 ? "" : "s"}
                  </>
                )}
              </button>
              {progress && (
                <span className="inline-flex items-center gap-2 text-xs text-white/55">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {progress}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded border border-white/15 bg-black/20 p-3">
            <div className="text-xs uppercase tracking-widest text-white/45">
              Thresholds
            </div>
            <Knob
              label="Sleeper ratio"
              hint="under this share of the busiest version's pulls/month"
              value={thresholds.sleeperRatio}
              step={0.05}
              min={0.05}
              max={1}
              onChange={(v) => rescore({ ...thresholds, sleeperRatio: v })}
            />
            <Knob
              label="Min reviews"
              hint="fewer than this and there is no opinion to trust"
              value={thresholds.minReviews}
              step={1}
              min={0}
              max={20}
              onChange={(v) => rescore({ ...thresholds, minReviews: v })}
            />
            <Knob
              label="Rating tolerance"
              hint="how far under the song's best rating is still allowed"
              value={thresholds.ratingTolerance}
              step={0.1}
              min={0}
              max={2}
              onChange={(v) => rescore({ ...thresholds, ratingTolerance: v })}
            />
            <Knob
              label="Rows fetched"
              hint="recordings considered per song (refetch to apply)"
              value={rows}
              step={25}
              min={25}
              max={200}
              onChange={setRows}
            />
            <button
              onClick={() => rescore(DEFAULT_THRESHOLDS)}
              className="w-full rounded border border-white/20 px-2 py-1 text-xs text-white/60 hover:border-dead-gold hover:text-dead-gold"
            >
              Reset to shipping defaults
            </button>
          </div>
        </div>

        {/* ---- summary ---- */}
        {results.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-6 border-y border-white/10 py-3 text-sm">
            <Stat label="songs" value={String(results.length)} />
            <Stat label="sleepers found" value={String(totalSleepers)} />
            <Stat label="songs with none" value={String(withNone)} />
            <Stat
              label="avg per song"
              value={results.length ? (totalSleepers / results.length).toFixed(1) : "—"}
            />
          </div>
        )}

        {/* ---- results ---- */}
        <div className="mt-6 space-y-3 pb-24">
          {results.map((r) => (
            <div key={r.song} className="rounded border border-white/12 bg-black/20">
              <button
                onClick={() => setExpanded(expanded === r.song ? null : r.song)}
                className="flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left hover:bg-white/5"
              >
                <span className="font-display text-lg text-dead-cream">{r.song}</span>
                <span className="flex items-center gap-4 text-xs text-white/50">
                  {r.error ? (
                    <span className="text-dead-red">{r.error}</span>
                  ) : (
                    <>
                      <span>{r.considered} considered</span>
                      <span>best {n1(r.bestRating)}★</span>
                      <span
                        className={
                          r.sleepers.length
                            ? "font-semibold text-dead-gold"
                            : "text-white/35"
                        }
                      >
                        {r.sleepers.length} sleeper
                        {r.sleepers.length === 1 ? "" : "s"}
                      </span>
                    </>
                  )}
                </span>
              </button>

              {r.sleepers.length > 0 && (
                <div className="border-t border-white/10 px-3 py-2">
                  {r.sleepers.map((s) => (
                    <Row key={s.identifier} r={s} />
                  ))}
                </div>
              )}

              {expanded === r.song && (
                <div className="border-t border-white/10 px-3 py-2">
                  <div className="mb-1 text-[10px] uppercase tracking-widest text-white/35">
                    everything considered · why each was kept or dropped
                  </div>
                  {[...r.scored]
                    .sort((a, b) => (b.pullsPerMonth ?? 0) - (a.pullsPerMonth ?? 0))
                    .map((s) => (
                      <Row key={s.identifier} r={s} showVerdict />
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg text-dead-gold">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
    </div>
  );
}

function Row({ r, showVerdict }: { r: ScoredRecording; showVerdict?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-white/5 py-1 text-xs last:border-0">
      <a
        href={`https://archive.org/details/${r.identifier}`}
        target="_blank"
        rel="noreferrer noopener"
        className="w-[58px] shrink-0 text-dead-gold hover:underline"
      >
        {r.date ? r.date.slice(0, 10) : "—"}
      </a>
      <span className="w-14 shrink-0 text-white/70">{n1(r.avgRating)}★</span>
      <span className="w-16 shrink-0 text-white/45">{r.numReviews ?? 0} rev</span>
      <span className="w-24 shrink-0 text-white/45">
        {r.pullsPerMonth == null ? "—" : r.pullsPerMonth.toFixed(1)}/mo
      </span>
      {showVerdict && (
        <span className={`w-36 shrink-0 ${VERDICT_COLOR[r.verdict] ?? "text-white/40"}`}>
          {r.verdict}
        </span>
      )}
      <span className="truncate text-white/30">{r.identifier}</span>
    </div>
  );
}

function Knob({
  label,
  hint,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-white/70">{label}</span>
        <span className="text-xs text-dead-gold">{value}</span>
      </div>
      <input
        type="range"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-dead-gold"
      />
      <div className="text-[10px] leading-tight text-white/35">{hint}</div>
    </div>
  );
}
