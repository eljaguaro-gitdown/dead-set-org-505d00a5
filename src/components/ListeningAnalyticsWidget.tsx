import { useEffect, useMemo, useState } from "react";
import { Headphones, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PlayEventRow {
  id: string;
  user_id: string | null;
  visitor_id: string | null;
  setlist_id: string | null;
  song_title: string | null;
  duration_played_ms: number;
  track_duration_ms: number | null;
  completed: boolean;
  ended_reason: string;
  started_at: string;
  ended_at: string | null;
}

type WindowKey = "24h" | "7d" | "30d" | "all";

const WINDOWS: { key: WindowKey; label: string; ms: number | null }[] = [
  { key: "24h", label: "24h", ms: 86_400_000 },
  { key: "7d", label: "7d", ms: 7 * 86_400_000 },
  { key: "30d", label: "30d", ms: 30 * 86_400_000 },
  { key: "all", label: "All", ms: null },
];

interface Props {
  enabled: boolean;
}

const SESSION_GAP_MS = 30 * 60 * 1000; // 30 min idle = new listening session

const ListeningAnalyticsWidget = ({ enabled }: Props) => {
  const [rows, setRows] = useState<PlayEventRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [windowKey, setWindowKey] = useState<WindowKey>("7d");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      // Pull most recent events (capped at 5k). "All" reflects whatever's in that window.
      const { data, error } = await supabase
        .from("play_events")
        .select(
          "id,user_id,visitor_id,setlist_id,song_title,duration_played_ms,track_duration_ms,completed,ended_reason,started_at,ended_at"
        )
        .order("started_at", { ascending: false })
        .limit(5000);
      if (cancelled) return;
      if (!error && data) setRows(data as PlayEventRow[]);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const cutoff = WINDOWS.find((w) => w.key === windowKey)?.ms ?? null;
    const now = Date.now();
    const STALE_IN_PROGRESS_MS = 30 * 60 * 1000; // 30 min — older "in_progress" rows are abandoned
    const MIN_PLAY_MS = 3000; // <3s = accidental click, not a real play

    const cleaned = rows.filter((r) => {
      // Drop orphaned in_progress rows (tab closed, never finalized)
      if (r.ended_reason === "in_progress") {
        const age = now - new Date(r.started_at).getTime();
        if (age > STALE_IN_PROGRESS_MS) return false;
      }
      // Drop sub-3-second blips from skipped/errored events with no real listen time
      if (
        (r.ended_reason === "skipped" || r.ended_reason === "error" || r.ended_reason === "navigated_away") &&
        (r.duration_played_ms || 0) < MIN_PLAY_MS
      ) {
        return false;
      }
      return true;
    });

    const filtered = cutoff
      ? cleaned.filter((r) => now - new Date(r.started_at).getTime() <= cutoff)
      : cleaned;

    const totalEvents = filtered.length;
    if (totalEvents === 0) {
      return {
        totalEvents: 0,
        finishedRate: 0,
        avgListenedSec: 0,
        totalMinutes: 0,
        uniqueListeners: 0,
        avgListensPerUser: 0,
        avgSongsPerSession: 0,
        sessions: 0,
        topSongs: [] as Array<{ title: string; count: number }>,
      };
    }

    // "% finished" = events that reached the end of the track. Prefer the
    // explicit ended_reason='finished' signal (always reliable), and fall back
    // to the `completed` flag (only set when track_duration_ms was captured).
    const finishedCount = filtered.filter(
      (r) => r.ended_reason === "finished" || r.completed
    ).length;
    const finishedRate = totalEvents > 0 ? finishedCount / totalEvents : 0;

    const totalMs = filtered.reduce(
      (sum, r) => sum + (r.duration_played_ms || 0),
      0
    );
    const avgListenedSec = totalMs / totalEvents / 1000;
    const totalMinutes = totalMs / 60_000;

    // Unique listeners = unique user_id OR visitor_id
    const listenerKey = (r: PlayEventRow) =>
      r.user_id ?? `visitor:${r.visitor_id ?? "unknown"}`;
    const listenerSet = new Set(filtered.map(listenerKey));
    const uniqueListeners = listenerSet.size;
    const avgListensPerUser = uniqueListeners
      ? totalEvents / uniqueListeners
      : 0;

    // Sessionize per listener: events within 30 min count as same session
    const byListener = new Map<string, PlayEventRow[]>();
    for (const r of filtered) {
      const k = listenerKey(r);
      if (!byListener.has(k)) byListener.set(k, []);
      byListener.get(k)!.push(r);
    }
    let sessions = 0;
    for (const list of byListener.values()) {
      const sorted = [...list].sort(
        (a, b) =>
          new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
      );
      let last = -Infinity;
      for (const r of sorted) {
        const t = new Date(r.started_at).getTime();
        if (t - last > SESSION_GAP_MS) sessions += 1;
        last = t;
      }
    }
    const avgSongsPerSession = sessions ? totalEvents / sessions : 0;

    // Top songs
    const songCounts = new Map<string, number>();
    for (const r of filtered) {
      const t = (r.song_title || "Unknown").trim();
      songCounts.set(t, (songCounts.get(t) || 0) + 1);
    }
    const topSongs = [...songCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([title, count]) => ({ title, count }));

    return {
      totalEvents,
      finishedRate,
      avgListenedSec,
      totalMinutes,
      uniqueListeners,
      avgListensPerUser,
      avgSongsPerSession,
      sessions,
      topSongs,
    };
  }, [rows, windowKey]);

  if (!enabled) return null;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Headphones className="w-4 h-4 text-primary" />
        <h2 className="font-display text-sm text-foreground">Listening</h2>
        <div className="ml-auto flex items-center gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWindowKey(w.key)}
              className={`px-2 py-0.5 rounded-md text-sm font-body transition-colors ${
                windowKey === w.key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !stats ? (
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : stats.totalEvents === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground font-body">
          No listening data yet for this window.
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Avg songs / session" value={stats.avgSongsPerSession.toFixed(1)} />
            <Stat label="% finished" value={`${Math.round(stats.finishedRate * 100)}%`} />
            <Stat label="Avg listens / user" value={stats.avgListensPerUser.toFixed(1)} />
            <Stat label="Avg listen length" value={formatSec(stats.avgListenedSec)} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm font-body text-muted-foreground">
            <Mini label="Total plays" value={stats.totalEvents.toLocaleString()} />
            <Mini label="Sessions" value={stats.sessions.toLocaleString()} />
            <Mini label="Unique listeners" value={stats.uniqueListeners.toLocaleString()} />
            <Mini label="Total minutes" value={Math.round(stats.totalMinutes).toLocaleString()} />
          </div>

          {stats.topSongs.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground font-body mb-2">
                Top songs
              </p>
              <ul className="space-y-1">
                {stats.topSongs.map((s) => (
                  <li
                    key={s.title}
                    className="flex items-center justify-between text-sm font-body"
                  >
                    <span className="text-foreground truncate pr-2">
                      {s.title}
                    </span>
                    <span className="text-primary tabular-nums">
                      {s.count}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-background/40 border border-border/60 rounded-lg p-3">
    <div className="text-sm text-muted-foreground font-body">{label}</div>
    <div className="text-2xl font-display text-primary tabular-nums">
      {value}
    </div>
  </div>
);

const Mini = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between">
    <span>{label}</span>
    <span className="text-foreground tabular-nums">{value}</span>
  </div>
);

const formatSec = (s: number) => {
  if (!s || !isFinite(s)) return "0s";
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}m ${sec}s`;
};

export default ListeningAnalyticsWidget;
