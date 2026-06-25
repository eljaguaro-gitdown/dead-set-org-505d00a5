import { useEffect, useMemo, useState } from "react";
import { Users2, Loader2, Share2, Hammer, MessageCircle, Headphones, Heart, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type WindowKey = "7d" | "30d" | "all";

const WINDOWS: { key: WindowKey; label: string; ms: number | null }[] = [
  { key: "7d", label: "7d", ms: 7 * 86_400_000 },
  { key: "30d", label: "30d", ms: 30 * 86_400_000 },
  { key: "all", label: "All", ms: null },
];

type SegmentKey = "sharer" | "builder" | "messenger" | "listener" | "curator" | "lurker";

interface SegmentDef {
  key: SegmentKey;
  label: string;
  blurb: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const SEGMENTS: SegmentDef[] = [
  { key: "sharer",    label: "Sharers",    blurb: "Spread setlists outward",            Icon: Share2 },
  { key: "builder",   label: "Builders",   blurb: "Create & edit setlists",             Icon: Hammer },
  { key: "messenger", label: "Messengers", blurb: "DM & comment heavily",               Icon: MessageCircle },
  { key: "listener",  label: "Listeners",  blurb: "Heavy audio playback",               Icon: Headphones },
  { key: "curator",   label: "Curators",   blurb: "Favorite & upvote others' work",     Icon: Heart },
  { key: "lurker",    label: "Lurkers",    blurb: "Signed up, low engagement",          Icon: Eye },
];

interface UserStats {
  userId: string;
  displayName: string;
  shares: number;
  setlistsCreated: number;
  messages: number;
  comments: number;
  plays: number;
  favorites: number;
  upvotes: number;
  segment: SegmentKey;
  totalActions: number;
}

interface Props {
  enabled: boolean;
}

const classify = (s: Omit<UserStats, "segment" | "totalActions" | "displayName" | "userId">): SegmentKey => {
  const messengerScore = s.messages + s.comments * 2;
  const curatorScore = s.favorites + s.upvotes;
  const scores: Record<SegmentKey, number> = {
    sharer: s.shares * 3,
    builder: s.setlistsCreated * 4,
    messenger: messengerScore,
    listener: s.plays,
    curator: curatorScore,
    lurker: 0,
  };
  const max = Math.max(...Object.values(scores));
  if (max === 0) return "lurker";
  return (Object.entries(scores) as [SegmentKey, number][])
    .sort((a, b) => b[1] - a[1])[0][0];
};

const UserSegmentsWidget = ({ enabled }: Props) => {
  const [windowKey, setWindowKey] = useState<WindowKey>("30d");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats[]>([]);
  const [activeSegment, setActiveSegment] = useState<SegmentKey | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const win = WINDOWS.find((w) => w.key === windowKey)!;
      const since = win.ms ? new Date(Date.now() - win.ms).toISOString() : null;

      const range = (q: any) => (since ? q.gte("created_at", since) : q);
      const rangeStarted = (q: any) => (since ? q.gte("started_at", since) : q);

      const [sharesRes, setlistsRes, dmsRes, commentsRes, playsRes, favsRes, upvotesRes, profilesRes] =
        await Promise.all([
          range(supabase.from("share_events").select("user_id").not("user_id", "is", null)).limit(10000),
          range(supabase.from("setlists").select("creator_id")).limit(10000),
          range(supabase.from("direct_messages").select("sender_id")).limit(10000),
          range(supabase.from("setlist_comments").select("user_id")).limit(10000),
          rangeStarted(supabase.from("play_events").select("user_id").not("user_id", "is", null)).limit(10000),
          range(supabase.from("favorites").select("user_id")).limit(10000),
          range(supabase.from("setlist_upvotes").select("user_id")).limit(10000),
          supabase.from("profiles").select("user_id, display_name").limit(10000),
        ]);

      if (cancelled) return;

      const tally = new Map<string, Partial<UserStats>>();
      const bump = (uid: string | null | undefined, key: keyof UserStats) => {
        if (!uid) return;
        const cur = tally.get(uid) || {};
        (cur as any)[key] = ((cur as any)[key] || 0) + 1;
        tally.set(uid, cur);
      };

      (sharesRes.data || []).forEach((r: any) => bump(r.user_id, "shares"));
      (setlistsRes.data || []).forEach((r: any) => bump(r.creator_id, "setlistsCreated"));
      (dmsRes.data || []).forEach((r: any) => bump(r.sender_id, "messages"));
      (commentsRes.data || []).forEach((r: any) => bump(r.user_id, "comments"));
      (playsRes.data || []).forEach((r: any) => bump(r.user_id, "plays"));
      (favsRes.data || []).forEach((r: any) => bump(r.user_id, "favorites"));
      (upvotesRes.data || []).forEach((r: any) => bump(r.user_id, "upvotes"));

      const profileMap = new Map<string, string>();
      (profilesRes.data || []).forEach((p: any) => {
        profileMap.set(p.user_id, p.display_name || "Deadhead");
      });

      const out: UserStats[] = [];
      tally.forEach((v, userId) => {
        const base = {
          shares: v.shares || 0,
          setlistsCreated: v.setlistsCreated || 0,
          messages: v.messages || 0,
          comments: v.comments || 0,
          plays: v.plays || 0,
          favorites: v.favorites || 0,
          upvotes: v.upvotes || 0,
        };
        const segment = classify(base);
        const totalActions =
          base.shares + base.setlistsCreated + base.messages + base.comments +
          base.plays + base.favorites + base.upvotes;
        out.push({
          userId,
          displayName: profileMap.get(userId) || "Deadhead",
          ...base,
          segment,
          totalActions,
        });
      });

      out.sort((a, b) => b.totalActions - a.totalActions);
      setStats(out);
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [enabled, windowKey]);

  const segmentSummary = useMemo(() => {
    const out = new Map<SegmentKey, { count: number; sampleVolume: number }>();
    SEGMENTS.forEach((s) => out.set(s.key, { count: 0, sampleVolume: 0 }));
    stats.forEach((u) => {
      const cur = out.get(u.segment)!;
      cur.count += 1;
      // "Volume" = the action they're known for
      const vol =
        u.segment === "sharer" ? u.shares :
        u.segment === "builder" ? u.setlistsCreated :
        u.segment === "messenger" ? u.messages + u.comments :
        u.segment === "listener" ? u.plays :
        u.segment === "curator" ? u.favorites + u.upvotes : 0;
      cur.sampleVolume += vol;
    });
    return out;
  }, [stats]);

  const filtered = useMemo(() => {
    if (!activeSegment) return stats.slice(0, 25);
    return stats.filter((u) => u.segment === activeSegment).slice(0, 50);
  }, [stats, activeSegment]);

  const totalUsers = stats.length;

  if (!enabled) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Users2 className="w-5 h-5 text-primary" />
          <h2 className="font-display text-lg text-card-foreground">User Segments</h2>
          <span className="text-sm text-muted-foreground font-body">
            ({totalUsers} active)
          </span>
        </div>
        <div className="flex gap-1 bg-muted/40 rounded-md p-1">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => { setWindowKey(w.key); setActiveSegment(null); }}
              className={`px-2.5 py-1 rounded text-sm font-body transition-colors ${
                windowKey === w.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-card-foreground"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="font-body text-sm">Crunching segments…</span>
        </div>
      ) : (
        <>
          {/* Segment grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {SEGMENTS.map(({ key, label, blurb, Icon }) => {
              const summary = segmentSummary.get(key)!;
              const pct = totalUsers > 0 ? Math.round((summary.count / totalUsers) * 100) : 0;
              const avg = summary.count > 0 ? (summary.sampleVolume / summary.count).toFixed(1) : "0";
              const isActive = activeSegment === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveSegment(isActive ? null : key)}
                  className={`text-left p-4 rounded-lg border transition-all ${
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background/50 hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="font-display text-base text-card-foreground">{label}</span>
                  </div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-display text-2xl text-card-foreground">{summary.count}</span>
                    <span className="text-sm text-muted-foreground font-body">({pct}%)</span>
                  </div>
                  <p className="text-sm text-muted-foreground font-body leading-snug mb-1">{blurb}</p>
                  {key !== "lurker" && (
                    <p className="text-sm text-accent font-body">
                      avg {avg} / user
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* User list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display text-base text-card-foreground">
                {activeSegment
                  ? `${SEGMENTS.find((s) => s.key === activeSegment)?.label} (top 50)`
                  : "Most active users (top 25)"}
              </h3>
              {activeSegment && (
                <button
                  onClick={() => setActiveSegment(null)}
                  className="text-sm font-body text-muted-foreground hover:text-card-foreground"
                >
                  Clear filter
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 px-2">Segment</th>
                    <th className="py-2 px-2 text-right">Shares</th>
                    <th className="py-2 px-2 text-right">Built</th>
                    <th className="py-2 px-2 text-right">DMs</th>
                    <th className="py-2 px-2 text-right">Comments</th>
                    <th className="py-2 px-2 text-right">Plays</th>
                    <th className="py-2 px-2 text-right">Favs</th>
                    <th className="py-2 px-2 text-right">Upvotes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u) => (
                    <tr key={u.userId} className="border-b border-border/50">
                      <td className="py-2 pr-3 text-card-foreground truncate max-w-[160px]">{u.displayName}</td>
                      <td className="py-2 px-2 text-muted-foreground capitalize">{u.segment}</td>
                      <td className="py-2 px-2 text-right text-card-foreground">{u.shares}</td>
                      <td className="py-2 px-2 text-right text-card-foreground">{u.setlistsCreated}</td>
                      <td className="py-2 px-2 text-right text-card-foreground">{u.messages}</td>
                      <td className="py-2 px-2 text-right text-card-foreground">{u.comments}</td>
                      <td className="py-2 px-2 text-right text-card-foreground">{u.plays}</td>
                      <td className="py-2 px-2 text-right text-card-foreground">{u.favorites}</td>
                      <td className="py-2 px-2 text-right text-card-foreground">{u.upvotes}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-muted-foreground">
                        No users in this segment for the selected window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserSegmentsWidget;
