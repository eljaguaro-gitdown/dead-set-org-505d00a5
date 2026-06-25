import { useState } from "react";
import { Bug, X, Copy, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { audioDebug, isAudioDebugEnabled, useAudioDebug } from "@/lib/audioDebug";

const fmtTime = (ts: number) => {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d
    .getSeconds()
    .toString()
    .padStart(2, "0")}.${d.getMilliseconds().toString().padStart(3, "0")}`;
};

const truncate = (s: string | null, n = 60) =>
  !s ? "—" : s.length > n ? s.slice(0, n) + "…" : s;

const AudioDebugPanel = () => {
  const enabled = isAudioDebugEnabled();
  const snap = useAudioDebug();
  const [open, setOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  if (!enabled || !open) return null;

  const copyAll = () => {
    const payload = JSON.stringify(snap, null, 2);
    navigator.clipboard?.writeText(payload).catch(() => {});
  };

  return (
    <div
      className="fixed bottom-2 right-2 z-[60] w-[min(380px,calc(100vw-1rem))] max-h-[70vh] flex flex-col rounded-lg border border-primary/40 bg-card/95 backdrop-blur-md shadow-2xl text-card-foreground font-mono text-[11px]"
      role="dialog"
      aria-label="Audio debug panel"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border">
        <Bug className="w-3.5 h-3.5 text-primary" />
        <span className="text-primary tracking-wider uppercase text-[10px]">Audio Debug</span>
        <span className="ml-auto flex items-center gap-1">
          <button
            onClick={copyAll}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-card-foreground"
            title="Copy snapshot to clipboard"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={() => audioDebug.clearAll()}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-card-foreground"
            title="Clear log"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-card-foreground"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-card-foreground"
            title="Close (reload to reopen)"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      </div>

      {!collapsed && (
        <>
          {/* State */}
          <dl className="px-2 py-1.5 grid grid-cols-[auto,1fr] gap-x-2 gap-y-0.5 border-b border-border">
            <dt className="text-muted-foreground">slot.id</dt>
            <dd className="truncate" title={snap.slotId || ""}>{truncate(snap.slotId, 40)}</dd>

            <dt className="text-muted-foreground">song</dt>
            <dd className="truncate text-primary" title={snap.songTitle || ""}>{snap.songTitle || "—"}</dd>

            <dt className="text-muted-foreground">archive id</dt>
            <dd className="truncate" title={snap.resolvedArchiveId || ""}>{truncate(snap.resolvedArchiveId, 40)}</dd>

            <dt className="text-muted-foreground">archive url</dt>
            <dd className="truncate" title={snap.archiveUrl || ""}>
              {snap.archiveUrl ? (
                <a href={snap.archiveUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                  {truncate(snap.archiveUrl, 40)}
                </a>
              ) : "—"}
            </dd>

            <dt className="text-muted-foreground">track url</dt>
            <dd className="truncate" title={snap.directTrackUrl || ""}>
              {snap.directTrackUrl ? (
                <a href={snap.directTrackUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                  {truncate(snap.directTrackUrl, 40)}
                </a>
              ) : "—"}
            </dd>

            <dt className="text-muted-foreground">state</dt>
            <dd className="text-primary">{snap.playbackState}</dd>

            <dt className="text-muted-foreground">last error</dt>
            <dd className={snap.lastError ? "text-destructive" : ""} title={snap.lastError || ""}>
              {truncate(snap.lastError, 60)}
            </dd>
          </dl>

          {/* Event log */}
          <div className="overflow-y-auto flex-1 px-2 py-1.5 space-y-0.5">
            {snap.events.length === 0 && (
              <p className="text-muted-foreground italic">No events yet — start playback.</p>
            )}
            {snap.events.map((e) => (
              <div
                key={e.id}
                className={`leading-tight ${
                  e.level === "error" ? "text-destructive" : e.level === "warn" ? "text-[hsl(var(--dead-gold))]" : "text-card-foreground/90"
                }`}
              >
                <span className="text-muted-foreground">{fmtTime(e.ts)}</span>{" "}
                <span className="text-primary/80">[{e.source}]</span>{" "}
                <span>{e.message}</span>
                {e.data && (
                  <pre className="text-[10px] text-muted-foreground pl-4 whitespace-pre-wrap break-all">
                    {JSON.stringify(e.data)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AudioDebugPanel;
