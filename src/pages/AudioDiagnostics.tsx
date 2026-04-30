import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, Pause, RotateCcw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  startPlayEvent,
  pausePlayEvent,
  resumePlayEvent,
  setPlayEventTrackDuration,
  finalizePlayEvent,
} from "@/lib/playEventTracker";

// A known-good, small, public Internet Archive Grateful Dead recording.
// Cornell '77 — universally cached, reliable CDN response.
const TEST_ARCHIVE_URL = "https://archive.org/details/gd1977-05-08.shnf";
const TEST_DIRECT_URL =
  "https://archive.org/download/gd1977-05-08.shnf/gd1977-05-08d1t01.mp3";
const TEST_SONG_TITLE = "Minglewood Blues";
const TEST_SHOW_DATE = "1977-05-08";
const TEST_VENUE = "Barton Hall, Cornell University";

type LogLevel = "info" | "warn" | "error" | "ok";
interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  msg: string;
  data?: Record<string, unknown>;
}

interface PlayEventRow {
  id: string;
  user_id: string | null;
  visitor_id: string | null;
  ended_reason: string;
  duration_played_ms: number;
  track_duration_ms: number | null;
  completed: boolean;
  started_at: string;
  ended_at: string | null;
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const AudioDiagnostics = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const counter = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackerActive, setTrackerActive] = useState(false);
  const [latestEvent, setLatestEvent] = useState<PlayEventRow | null>(null);
  const [pollErr, setPollErr] = useState<string | null>(null);
  const [insertProbe, setInsertProbe] = useState<"untested" | "ok" | "fail">("untested");
  const [insertErrMsg, setInsertErrMsg] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [playErr, setPlayErr] = useState<{ name: string; message: string; hint: string } | null>(null);

  // Detection
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(/Windows/.test(ua));
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  const isFxiOS = /FxiOS/.test(ua);
  const visitorId =
    typeof window !== "undefined" ? localStorage.getItem("ds_visitor_id") : null;
  const audioContextSupported =
    typeof window !== "undefined" && !!(window.AudioContext || (window as any).webkitAudioContext);
  const mediaSession = typeof navigator !== "undefined" && "mediaSession" in navigator;

  const log = (level: LogLevel, msg: string, data?: Record<string, unknown>) => {
    counter.current += 1;
    setLogs((prev) =>
      [{ id: counter.current, ts: Date.now(), level, msg, data }, ...prev].slice(0, 100)
    );
  };

  // Probe play_events insert directly (no audio) to verify RLS is letting
  // us through on this device/session combo.
  const runInsertProbe = async () => {
    log("info", "Insert probe: writing a temporary play_events row…");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ?? null;
      const vid = localStorage.getItem("ds_visitor_id");

      if (!userId && !vid) {
        log("error", "No user_id and no ds_visitor_id — RLS will block inserts");
        setInsertProbe("fail");
        setInsertErrMsg("Missing both auth and visitor_id");
        return;
      }

      const { data, error } = await supabase
        .from("play_events")
        .insert({
          user_id: userId,
          visitor_id: userId ? null : vid,
          song_title: "[diagnostic probe]",
          ended_reason: "in_progress",
        })
        .select("id")
        .single();

      if (error || !data) {
        log("error", "Probe insert failed", { error: error?.message });
        setInsertProbe("fail");
        setInsertErrMsg(error?.message || "Unknown insert error");
        return;
      }

      // Clean up: mark it ended so it isn't a phantom in-progress row.
      await supabase
        .from("play_events")
        .update({ ended_reason: "navigated_away", ended_at: new Date().toISOString() })
        .eq("id", data.id);

      log("ok", "Probe insert succeeded", { id: data.id });
      setInsertProbe("ok");
      setInsertErrMsg(null);
    } catch (e: any) {
      log("error", "Probe threw", { error: String(e) });
      setInsertProbe("fail");
      setInsertErrMsg(String(e));
    }
  };

  // Poll the DB for the most recent play_events row from this listener so
  // we can verify the tracker is actually writing rows and updating them.
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const userId = user?.id ?? null;
        const vid = localStorage.getItem("ds_visitor_id");
        let q = supabase
          .from("play_events")
          .select(
            "id,user_id,visitor_id,ended_reason,duration_played_ms,track_duration_ms,completed,started_at,ended_at"
          )
          .order("started_at", { ascending: false })
          .limit(1);
        if (userId) q = q.eq("user_id", userId);
        else if (vid) q = q.eq("visitor_id", vid);
        else { setPollErr("No user_id or visitor_id"); return; }

        const { data, error } = await q;
        if (cancelled) return;
        if (error) { setPollErr(error.message); return; }
        setPollErr(null);
        setLatestEvent((data?.[0] as PlayEventRow) || null);
      } catch (e: any) {
        if (!cancelled) setPollErr(String(e));
      }
    };
    poll();
    const id = window.setInterval(poll, 2000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  // Start full pipeline: tracker + audio.
  const handlePlay = async () => {
    const el = audioRef.current;
    if (!el) return;

    if (!trackerActive) {
      log("info", "startPlayEvent → DB insert", { song: TEST_SONG_TITLE });
      await startPlayEvent({
        archiveUrl: TEST_ARCHIVE_URL,
        songTitle: TEST_SONG_TITLE,
        showDate: TEST_SHOW_DATE,
        venue: TEST_VENUE,
      });
      setTrackerActive(true);
    } else {
      resumePlayEvent();
      log("info", "resumePlayEvent");
    }

    try {
      await el.play();
      log("ok", "audio.play() resolved");
      setPlaying(true);
    } catch (e: any) {
      log("error", "audio.play() rejected (likely autoplay policy)", { error: String(e) });
    }
  };

  const handlePause = () => {
    audioRef.current?.pause();
    pausePlayEvent();
    log("info", "pause + pausePlayEvent");
    setPlaying(false);
  };

  const handleFinalize = async (reason: "finished" | "skipped" | "navigated_away") => {
    log("info", `finalizePlayEvent("${reason}")`);
    await finalizePlayEvent(reason);
    setTrackerActive(false);
    setPlaying(false);
    audioRef.current?.pause();
  };

  const handleReset = async () => {
    if (trackerActive) await finalizePlayEvent("navigated_away");
    setTrackerActive(false);
    setLogs([]);
    setPlaying(false);
    setProgress(0);
    setDuration(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    log("info", "Reset");
  };

  // Wire every audio event so we can see exactly where iOS Safari fails.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const handlers: Array<[string, (e: Event) => void]> = [
      ["loadstart", () => log("info", "audio: loadstart")],
      ["loadedmetadata", () => {
        const d = el.duration;
        if (Number.isFinite(d) && d > 0) {
          setDuration(d);
          setPlayEventTrackDuration(d * 1000);
          log("ok", "audio: loadedmetadata", { duration: d });
        } else {
          log("warn", "audio: loadedmetadata (no duration)");
        }
      }],
      ["canplay", () => log("ok", "audio: canplay")],
      ["canplaythrough", () => log("ok", "audio: canplaythrough")],
      ["play", () => log("info", "audio: play event")],
      ["playing", () => log("ok", "audio: playing")],
      ["pause", () => log("info", "audio: pause event")],
      ["waiting", () => log("warn", "audio: waiting (buffering)")],
      ["stalled", () => log("warn", "audio: stalled")],
      ["suspend", () => log("info", "audio: suspend")],
      ["timeupdate", () => setProgress(el.currentTime)],
      ["ended", () => {
        log("ok", "audio: ended");
        void finalizePlayEvent("finished");
        setTrackerActive(false);
        setPlaying(false);
      }],
      ["error", () => {
        const code = el.error?.code;
        const msg = el.error?.message;
        log("error", "audio: error", { code, msg, src: el.currentSrc });
      }],
    ];
    handlers.forEach(([name, fn]) => el.addEventListener(name, fn));
    return () => handlers.forEach(([name, fn]) => el.removeEventListener(name, fn));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground font-body text-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </Link>

        <h1 className="font-display text-3xl text-foreground mb-2">Audio Diagnostics</h1>
        <p className="font-body text-base text-muted-foreground mb-6">
          Reproduces the full playback + analytics pipeline against a known-good
          recording. Use this on iOS Safari to verify <code>play_events</code>{" "}
          insert/update wiring.
        </p>

        {/* Environment */}
        <section className="bg-card border border-border rounded-xl p-4 mb-4">
          <h2 className="font-display text-lg mb-3">Environment</h2>
          <dl className="grid grid-cols-2 gap-y-2 font-body text-sm">
            <dt className="text-muted-foreground">User Agent</dt>
            <dd className="text-foreground break-all">{ua || "—"}</dd>
            <dt className="text-muted-foreground">iOS</dt>
            <dd>{isIOS ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">Safari</dt>
            <dd>{isSafari ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">Firefox iOS</dt>
            <dd>{isFxiOS ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">visitor_id</dt>
            <dd className="text-foreground break-all">{visitorId || "(none)"}</dd>
            <dt className="text-muted-foreground">MediaSession</dt>
            <dd>{mediaSession ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">AudioContext</dt>
            <dd>{audioContextSupported ? "Yes" : "No"}</dd>
          </dl>
        </section>

        {/* Insert probe */}
        <section className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3 gap-3">
            <h2 className="font-display text-lg">RLS / Insert Probe</h2>
            <button
              onClick={runInsertProbe}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-body text-sm hover:opacity-90"
            >
              Run probe
            </button>
          </div>
          <p className="font-body text-sm text-muted-foreground mb-2">
            Writes a single throwaway row to <code>play_events</code> to confirm
            RLS allows this device to insert.
          </p>
          {insertProbe === "ok" && (
            <div className="flex items-center gap-2 text-accent font-body text-sm">
              <CheckCircle2 className="w-4 h-4" /> Insert succeeded — RLS is OK.
            </div>
          )}
          {insertProbe === "fail" && (
            <div className="flex items-start gap-2 text-destructive font-body text-sm">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Insert blocked: {insertErrMsg}</span>
            </div>
          )}
          {insertProbe === "untested" && (
            <div className="flex items-center gap-2 text-muted-foreground font-body text-sm">
              <AlertTriangle className="w-4 h-4" /> Not tested yet.
            </div>
          )}
        </section>

        {/* Player */}
        <section className="bg-card border border-border rounded-xl p-4 mb-4">
          <h2 className="font-display text-lg mb-1">Test Track</h2>
          <p className="font-body text-sm text-muted-foreground mb-3">
            {TEST_SONG_TITLE} · {TEST_VENUE} · {TEST_SHOW_DATE}
          </p>
          <audio
            ref={audioRef}
            src={TEST_DIRECT_URL}
            preload="metadata"
            playsInline
            crossOrigin="anonymous"
          />
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {!playing ? (
              <button
                onClick={handlePlay}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground font-body hover:opacity-90"
              >
                <Play className="w-4 h-4" /> Play
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border font-body hover:border-primary/40"
              >
                <Pause className="w-4 h-4" /> Pause
              </button>
            )}
            <button
              onClick={() => handleFinalize("finished")}
              disabled={!trackerActive}
              className="px-3 py-2 rounded-lg bg-muted text-foreground font-body text-sm disabled:opacity-50"
            >
              Force finish
            </button>
            <button
              onClick={() => handleFinalize("skipped")}
              disabled={!trackerActive}
              className="px-3 py-2 rounded-lg bg-muted text-foreground font-body text-sm disabled:opacity-50"
            >
              Force skip
            </button>
            <button
              onClick={handleReset}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border font-body text-sm hover:border-primary/40"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
          <div className="font-body text-sm text-muted-foreground">
            {fmt(progress * 1000)} / {fmt(duration * 1000)}
            {trackerActive && <span className="ml-3 text-accent">● tracker active</span>}
          </div>
        </section>

        {/* Latest play_events row */}
        <section className="bg-card border border-border rounded-xl p-4 mb-4">
          <h2 className="font-display text-lg mb-3">Latest play_events row (polled every 2s)</h2>
          {pollErr && (
            <div className="flex items-start gap-2 text-destructive font-body text-sm mb-2">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{pollErr}</span>
            </div>
          )}
          {latestEvent ? (
            <dl className="grid grid-cols-2 gap-y-1.5 font-body text-sm">
              <dt className="text-muted-foreground">id</dt>
              <dd className="text-foreground break-all">{latestEvent.id}</dd>
              <dt className="text-muted-foreground">ended_reason</dt>
              <dd className="text-foreground">{latestEvent.ended_reason}</dd>
              <dt className="text-muted-foreground">duration_played_ms</dt>
              <dd className="text-foreground">{latestEvent.duration_played_ms}</dd>
              <dt className="text-muted-foreground">track_duration_ms</dt>
              <dd className="text-foreground">{latestEvent.track_duration_ms ?? "—"}</dd>
              <dt className="text-muted-foreground">completed</dt>
              <dd className="text-foreground">{String(latestEvent.completed)}</dd>
              <dt className="text-muted-foreground">started_at</dt>
              <dd className="text-foreground">{latestEvent.started_at}</dd>
              <dt className="text-muted-foreground">ended_at</dt>
              <dd className="text-foreground">{latestEvent.ended_at ?? "—"}</dd>
            </dl>
          ) : (
            <p className="font-body text-sm text-muted-foreground">
              No play_events row found yet for this listener.
            </p>
          )}
        </section>

        {/* Event log */}
        <section className="bg-card border border-border rounded-xl p-4">
          <h2 className="font-display text-lg mb-3">Event log</h2>
          {logs.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground">No events yet — press Play.</p>
          ) : (
            <ul className="space-y-1 max-h-96 overflow-y-auto">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className={`font-body text-sm flex items-start gap-2 py-0.5 ${
                    l.level === "error"
                      ? "text-destructive"
                      : l.level === "warn"
                      ? "text-accent"
                      : l.level === "ok"
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <span className="shrink-0 tabular-nums opacity-70">
                    {new Date(l.ts).toLocaleTimeString()}
                  </span>
                  <span className="flex-1">
                    {l.msg}
                    {l.data && (
                      <span className="block opacity-70 break-all">
                        {JSON.stringify(l.data)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default AudioDiagnostics;
