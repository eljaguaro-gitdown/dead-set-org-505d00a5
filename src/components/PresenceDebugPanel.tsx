import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import {
  getPresenceChannel,
  subscribeToDebug,
  getDebugSnapshot,
  type PresenceStatus,
} from "@/lib/presenceChannel";

const STATUS_STYLES: Record<PresenceStatus, string> = {
  IDLE: "bg-muted text-muted-foreground",
  SUBSCRIBING: "bg-amber-500/15 text-amber-400",
  SUBSCRIBED: "bg-green-500/15 text-green-400",
  CHANNEL_ERROR: "bg-destructive/15 text-destructive",
  TIMED_OUT: "bg-destructive/15 text-destructive",
  CLOSED: "bg-muted text-muted-foreground",
};

const formatAge = (ts: number | null) => {
  if (!ts) return "—";
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 1) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
};

const PresenceDebugPanel = () => {
  const [snap, setSnap] = useState(getDebugSnapshot());
  const [, setTick] = useState(0);

  useEffect(() => {
    // Make sure the channel is open so we get status updates.
    getPresenceChannel();
    const unsub = subscribeToDebug(setSnap);
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, []);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Activity className="w-4 h-4 text-primary" />
        <h2 className="font-display text-sm text-card-foreground">Presence Channel</h2>
        <span
          className={`ml-auto px-2 py-0.5 rounded text-[11px] font-mono uppercase tracking-wider ${STATUS_STYLES[snap.status]}`}
        >
          {snap.status}
        </span>
      </div>

      <dl className="divide-y divide-border">
        <Row label="Tracked presences" value={String(snap.trackedCount)} mono />
        <Row label="Last event" value={snap.lastEvent ?? "—"} mono />
        <Row label="Last sync" value={formatAge(snap.lastSyncAt)} />
        <Row label="Subscribed" value={formatAge(snap.subscribedAt)} />
        <Row label="Channel" value="online_visitors" mono />
      </dl>
    </div>
  );
};

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="px-4 py-2.5 flex items-center justify-between gap-4">
    <dt className="text-sm font-body text-muted-foreground">{label}</dt>
    <dd
      className={`text-sm text-card-foreground tabular-nums ${mono ? "font-mono" : "font-body"}`}
    >
      {value}
    </dd>
  </div>
);

export default PresenceDebugPanel;
