import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Bell, MessageCircle } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ClickRow {
  created_at: string;
  channel: string;
  user_id: string | null;
  visitor_id: string | null;
  metadata: Record<string, unknown> | null;
}

type RangeKey = "7d" | "30d" | "90d";

const RANGE_DAYS: Record<RangeKey, number> = { "7d": 7, "30d": 30, "90d": 90 };

const AdminNotificationClicks = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ClickRow[]>([]);
  const [range, setRange] = useState<RangeKey>("30d");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
      if (!data) setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - RANGE_DAYS[range]);
      const { data, error } = await supabase
        .from("share_events")
        .select("created_at, channel, user_id, visitor_id, metadata")
        .eq("share_type", "cta_click")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true })
        .limit(10000);
      if (error) {
        console.error(error);
        setRows([]);
      } else {
        setRows(
          (data || []).filter(
            (r: any) =>
              typeof r.channel === "string" &&
              (r.channel.startsWith("announcement:") ||
                r.channel.startsWith("comment_notif:"))
          ) as ClickRow[]
        );
      }
      setLoading(false);
    };
    load();
  }, [isAdmin, range]);

  const stats = useMemo(() => {
    const ann = rows.filter((r) => r.channel.startsWith("announcement:"));
    const cmt = rows.filter((r) => r.channel.startsWith("comment_notif:"));
    const uniqueKey = (r: ClickRow) => r.user_id || r.visitor_id || "unknown";
    return {
      annClicks: ann.length,
      annUsers: new Set(ann.map(uniqueKey)).size,
      cmtClicks: cmt.length,
      cmtUsers: new Set(cmt.map(uniqueKey)).size,
      totalClicks: rows.length,
      totalUsers: new Set(rows.map(uniqueKey)).size,
    };
  }, [rows]);

  const series = useMemo(() => {
    const days: Record<
      string,
      { day: string; announcement: number; comment: number; uniqueUsers: Set<string> }
    > = {};
    const days_count = RANGE_DAYS[range];
    for (let i = days_count - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = { day: key, announcement: 0, comment: 0, uniqueUsers: new Set() };
    }
    rows.forEach((r) => {
      const key = r.created_at.slice(0, 10);
      const bucket = days[key];
      if (!bucket) return;
      if (r.channel.startsWith("announcement:")) bucket.announcement++;
      else if (r.channel.startsWith("comment_notif:")) bucket.comment++;
      bucket.uniqueUsers.add(r.user_id || r.visitor_id || "unknown");
    });
    return Object.values(days).map((d) => ({
      day: d.day.slice(5),
      announcement: d.announcement,
      comment: d.comment,
      uniqueUsers: d.uniqueUsers.size,
    }));
  }, [rows, range]);

  const channelBreakdown = useMemo(() => {
    const map = new Map<string, { channel: string; clicks: number; users: Set<string> }>();
    rows.forEach((r) => {
      const entry = map.get(r.channel) || {
        channel: r.channel,
        clicks: 0,
        users: new Set<string>(),
      };
      entry.clicks++;
      entry.users.add(r.user_id || r.visitor_id || "unknown");
      map.set(r.channel, entry);
    });
    return Array.from(map.values())
      .map((e) => ({ channel: e.channel, clicks: e.clicks, users: e.users.size }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 25);
  }, [rows]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <p className="font-body text-foreground/75">Access denied.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-12 pb-20">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin")}
          className="mb-8 -ml-3 text-foreground/75 hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to admin
        </Button>

        <header className="mb-12">
          <h1 className="font-display text-4xl text-foreground mb-2">
            Notification Click Analytics
          </h1>
          <p className="font-body text-foreground/75">
            Tracking CTA clicks from the bell — announcements & comment notifications.
          </p>
        </header>

        <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)} className="mb-8">
          <TabsList>
            <TabsTrigger value="7d">Last 7 days</TabsTrigger>
            <TabsTrigger value="30d">Last 30 days</TabsTrigger>
            <TabsTrigger value="90d">Last 90 days</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Summary cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <SummaryCard
            icon={<Bell className="w-4 h-4 text-primary" />}
            label="Announcement clicks"
            primary={stats.annClicks}
            secondary={`${stats.annUsers} unique`}
          />
          <SummaryCard
            icon={<MessageCircle className="w-4 h-4 text-primary" />}
            label="Comment notification clicks"
            primary={stats.cmtClicks}
            secondary={`${stats.cmtUsers} unique`}
          />
          <SummaryCard
            label="Total clicks"
            primary={stats.totalClicks}
            secondary={`${stats.totalUsers} unique users`}
          />
        </section>

        {/* Time series */}
        <section className="bg-card border border-border rounded-xl p-6 mb-12">
          <h2 className="font-display text-lg text-card-foreground mb-6">Clicks over time</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="announcement"
                  name="Announcements"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="comment"
                  name="Comment notifs"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="uniqueUsers"
                  name="Unique users"
                  stroke="hsl(var(--accent-foreground))"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Per-channel breakdown */}
        <section className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-display text-lg text-card-foreground mb-6">
            Top notifications by clicks
          </h2>
          {channelBreakdown.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground">
              No clicks tracked in this range yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left font-mono text-[10px] tracking-wider uppercase text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4">Channel</th>
                    <th className="py-2 pr-4 text-right">Clicks</th>
                    <th className="py-2 text-right">Unique users</th>
                  </tr>
                </thead>
                <tbody>
                  {channelBreakdown.map((c) => (
                    <tr
                      key={c.channel}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td className="py-3 pr-4 font-mono text-card-foreground/90 break-all">
                        {c.channel}
                      </td>
                      <td className="py-3 pr-4 text-right text-card-foreground">{c.clicks}</td>
                      <td className="py-3 text-right text-muted-foreground">{c.users}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

const SummaryCard = ({
  icon,
  label,
  primary,
  secondary,
}: {
  icon?: React.ReactNode;
  label: string;
  primary: number;
  secondary: string;
}) => (
  <div className="bg-card border border-border rounded-xl p-6">
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground">
        {label}
      </span>
    </div>
    <div className="font-display text-4xl text-card-foreground">{primary.toLocaleString()}</div>
    <div className="font-body text-sm text-muted-foreground mt-1">{secondary}</div>
  </div>
);

export default AdminNotificationClicks;
