import { useState, useEffect } from "react";
import { User } from "lucide-react";
import { useOnlineVisitors, type OnlineVisitor } from "@/hooks/useOnlineVisitors";

const pageName = (path: string) => {
  if (path === "/") return "Landing";
  if (path.startsWith("/builder")) return "Builder";
  if (path.startsWith("/browse")) return "Browse";
  if (path.startsWith("/setlist/")) return "Viewing Setlist";
  if (path.startsWith("/my-setlists")) return "My Setlists";
  if (path.startsWith("/backstage")) return "Backstage";
  if (path.startsWith("/auth")) return "Auth";
  if (path.startsWith("/profile")) return "Profile";
  if (path.startsWith("/messages")) return "Messages";
  if (path.startsWith("/updates")) return "Build Notes";
  return path;
};

const formatDuration = (joinedAt: string) => {
  const diff = Math.max(0, Date.now() - new Date(joinedAt).getTime());
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
};

/** Forces a re-render every 10s so durations stay fresh */
const useTick = (intervalMs: number) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
};

const LiveVisitorsWidget = ({ enabled }: { enabled: boolean }) => {
  const visitors = useOnlineVisitors(enabled);
  useTick(10_000);

  const authed = visitors.filter((v) => v.user_id);
  const anonymous = visitors.filter((v) => !v.user_id);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
        </span>
        <h2 className="font-display text-sm text-card-foreground">Live on Site</h2>
        <span className="text-xs font-mono text-muted-foreground ml-auto">
          {visitors.length} visitor{visitors.length !== 1 ? "s" : ""}
        </span>
      </div>

      {visitors.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground font-body">No one is on the site right now</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {authed.map((v) => (
            <VisitorRow key={v.visitor_id} visitor={v} />
          ))}

          {anonymous.length > 0 && (
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-body text-muted-foreground">
                  {anonymous.length} anonymous visitor{anonymous.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs font-mono text-muted-foreground/60 truncate">
                  {[...new Set(anonymous.map((a) => pageName(a.page)))].join(", ")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const VisitorRow = ({ visitor }: { visitor: OnlineVisitor }) => (
  <div className="px-4 py-3 flex items-center gap-3">
    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
      {visitor.avatar_url ? (
        <img src={visitor.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        <User className="w-3.5 h-3.5 text-primary" />
      )}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-body text-card-foreground truncate">
        {visitor.display_name || "Deadhead"}
      </p>
      <p className="text-xs font-mono text-muted-foreground/60">
        📍 {pageName(visitor.page)}
      </p>
    </div>
    <span className="text-xs font-mono text-muted-foreground/80 tabular-nums shrink-0">
      {formatDuration(visitor.joined_at)}
    </span>
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
    </span>
  </div>
);

export default LiveVisitorsWidget;
