import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Users, ArrowLeft, Loader2, Calendar, Mail, User, Trash2, ListMusic, Eye, Globe, MessageSquare, Bug, Star, Lightbulb, Send, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import LiveVisitorsWidget from "@/components/LiveVisitorsWidget";
import ModerationQueueWidget from "@/components/ModerationQueueWidget";
import PresenceDebugPanel from "@/components/PresenceDebugPanel";
import FunnelWidget from "@/components/FunnelWidget";
import AuthFunnelWidget from "@/components/AuthFunnelWidget";
import ListeningAnalyticsWidget from "@/components/ListeningAnalyticsWidget";
import UserSegmentsWidget from "@/components/UserSegmentsWidget";
import AdminAnnouncementsPanel from "@/components/AdminAnnouncementsPanel";
import DeliverabilityMonitor from "@/components/DeliverabilityMonitor";
import SuppressedAddressesPanel from "@/components/SuppressedAddressesPanel";

import PrivateRelayMonitor from "@/components/PrivateRelayMonitor";
import DispatchSenderPanel from "@/components/DispatchSenderPanel";
import GitHubSyncBadge from "@/components/GitHubSyncBadge";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmedAt: string | null;
  setlistCount: number;
}

interface TrafficStats {
  totalPageViews: number;
  totalUnique: number;
  unique24h: number;
  unique7d: number;
  unique30d: number;
}

interface BackstageData {
  wishlist: Array<{ id: string; top_request: string | null; what_works: string | null; bigger_picture: string | null; created_at: string; user_id: string | null }>;
  bugs: Array<{ id: string; description: string; location: string | null; device: string | null; severity: string | null; repeats: boolean | null; created_at: string; user_id: string | null }>;
  shares: Array<{ id: string; handle: string | null; favorite_songs: string | null; favorite_show: string | null; personal_take: string | null; created_at: string; user_id: string | null }>;
}

interface ProfileMap {
  [userId: string]: { display_name: string | null; avatar_url: string | null };
}

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [traffic, setTraffic] = useState<TrafficStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [backstage, setBackstage] = useState<BackstageData>({ wishlist: [], bugs: [], shares: [] });
  const [profileMap, setProfileMap] = useState<ProfileMap>({});

  // Check admin role
  useEffect(() => {
    if (!user) return;
    const checkAdmin = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
      if (!data) {
        setLoading(false);
      }
    };
    checkAdmin();
  }, [user]);

  // Fetch users from edge function (extracted so pull-to-refresh can re-invoke)
  const fetchUsers = async () => {
    setLoading(true);
    const [usersRes, wishlistRes, bugsRes, sharesRes] = await Promise.all([
      supabase.functions.invoke("admin-users"),
      supabase.from("insider_wishlist").select("*").order("created_at", { ascending: false }),
      supabase.from("insider_bugs").select("*").order("created_at", { ascending: false }),
      supabase.from("insider_shares").select("*").order("created_at", { ascending: false }),
    ]);
    if (usersRes.error) {
      toast.error("Failed to load users");
      console.error(usersRes.error);
    } else {
      setUsers(usersRes.data.users || []);
      setTraffic(usersRes.data.traffic || null);
    }
    const bsData = {
      wishlist: (wishlistRes.data as any[]) || [],
      bugs: (bugsRes.data as any[]) || [],
      shares: (sharesRes.data as any[]) || [],
    };
    setBackstage(bsData);

    const allUserIds = [
      ...bsData.wishlist.map((w: any) => w.user_id),
      ...bsData.bugs.map((b: any) => b.user_id),
      ...bsData.shares.map((s: any) => s.user_id),
    ].filter((id): id is string => !!id);
    const uniqueIds = [...new Set(allUserIds)];
    if (uniqueIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", uniqueIds);
      if (profiles) {
        const map: ProfileMap = {};
        profiles.forEach((p) => { map[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
        setProfileMap(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // Pull-to-refresh on mobile (and trackpad-overscroll on desktop)
  const { pull, refreshing, threshold } = usePullToRefresh({
    enabled: isAdmin,
    onRefresh: async () => {
      await fetchUsers();
      toast.success("Refreshed");
    },
  });

  const [deleting, setDeleting] = useState<string | null>(null);
  const [sendingWelcome, setSendingWelcome] = useState<string | null>(null);

  const handleSendWelcome = async (userId: string, email: string, displayName: string | null) => {
    setSendingWelcome(userId);
    try {
      const { data, error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "welcome-email",
          recipientEmail: email,
          idempotencyKey: `manual-welcome-${userId}-${Date.now()}`,
          templateData: { name: displayName || email.split("@")[0] },
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Welcome email sent to ${email}`);
      } else {
        toast.error(data?.reason === "email_suppressed" ? `${email} is on the suppression list` : "Failed to send");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send welcome email");
      console.error(err);
    } finally {
      setSendingWelcome(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setDeleting(userId);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users?action=delete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ userIds: [userId] }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to delete user");
      
      const deleteResult = result.results?.[0];
      if (deleteResult?.error) throw new Error(deleteResult.error);
      
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success("User deleted successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
      console.error(err);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(dateStr);
  };

  const SubmitterBadge = ({ userId }: { userId: string | null }) => {
    if (!userId) return <span className="text-xs text-muted-foreground italic">Anonymous</span>;
    const profile = profileMap[userId];
    const name = profile?.display_name || "Unknown user";
    return (
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-3 h-3 text-primary" />
          )}
        </div>
        <button onClick={() => navigate(`/user/${userId}`)} className="text-xs text-card-foreground font-medium hover:text-accent-foreground transition-colors">{name}</button>
        <button
          onClick={() => navigate(`/messages?to=${userId}`)}
          className="inline-flex items-center gap-1 text-xs text-accent-foreground hover:text-accent-foreground/80 transition-colors ml-1"
          title={`Message ${name}`}
        >
          <Send className="w-3 h-3" />
          Reply
        </button>
      </div>
    );
  };

  if (authLoading) {
    return (
      <div className="grain-overlay min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (!loading && !isAdmin) {
    return (
      <div className="grain-overlay min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
          <h1 className="font-display text-xl text-foreground">Access Denied</h1>
          <p className="font-body text-sm text-foreground/75">
            You don't have admin access.
          </p>
          <Button variant="outline" onClick={() => navigate("/")} className="font-body">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const progress = Math.min(1, pull / threshold);

  return (
    <div className="grain-overlay min-h-screen bg-background overscroll-y-contain">
      {/* Pull-to-refresh indicator */}
      <div
        aria-hidden={pull === 0 && !refreshing}
        className="fixed top-0 inset-x-0 z-50 flex justify-center pointer-events-none"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          transform: `translateY(${refreshing ? threshold * 0.6 : pull * 0.6}px)`,
          opacity: refreshing ? 1 : progress,
          transition: pull === 0 || refreshing ? "transform 200ms ease, opacity 200ms ease" : "none",
        }}
      >
        <div className="mt-2 bg-card border border-border rounded-full p-2 shadow-lg">
          <RefreshCw
            className={`w-4 h-4 text-primary ${refreshing ? "animate-spin" : ""}`}
            style={{ transform: refreshing ? undefined : `rotate(${progress * 270}deg)` }}
          />
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="font-display text-lg text-dead-gold">
          DS
        </button>
        <div className="w-px h-5 bg-border" />
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <h1 className="font-display text-base text-foreground">Admin Dashboard</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchUsers().then(() => toast.success("Refreshed"))}
          className="ml-auto font-body text-foreground/75"
          disabled={loading || refreshing}
          aria-label="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading || refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="font-body text-foreground/75"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
        </Button>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* User Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Total Users</p>
            <p className="font-display text-2xl text-card-foreground mt-1">
              {loading ? "—" : users.length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Active (24h)</p>
            <p className="font-display text-2xl text-card-foreground mt-1">
              {loading
                ? "—"
                : users.filter(
                    (u) =>
                      u.lastSignInAt &&
                      Date.now() - new Date(u.lastSignInAt).getTime() < 86400000
                  ).length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Active (7d)</p>
            <p className="font-display text-2xl text-card-foreground mt-1">
              {loading
                ? "—"
                : users.filter(
                    (u) =>
                      u.lastSignInAt &&
                      Date.now() - new Date(u.lastSignInAt).getTime() < 604800000
                  ).length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Total Setlists</p>
            <p className="font-display text-2xl text-card-foreground mt-1">
              {loading ? "—" : users.reduce((sum, u) => sum + u.setlistCount, 0)}
            </p>
          </div>
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/notification-clicks")} className="font-body">
            Notification Clicks
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/changelog")} className="font-body">
            Changelog
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/email/beta-nudge")} className="font-body">
            Beta Nudge Email
          </Button>
        </div>

        {/* GitHub sync status */}
        <GitHubSyncBadge />

        {/* Broadcast Announcements */}
        <AdminAnnouncementsPanel />

        {/* Editorial Dispatch sender */}
        <DispatchSenderPanel />

        {/* Email Deliverability Monitoring */}
        <DeliverabilityMonitor />

        {/* Suppression list management */}
        <SuppressedAddressesPanel />


        {/* Apple Private Relay welcome-email confirmation */}
        <PrivateRelayMonitor />

        {/* Traffic Stats */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-display text-sm text-card-foreground">Site Traffic</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Unique (24h)</p>
              <p className="font-display text-2xl text-card-foreground mt-1">
                {loading ? "—" : traffic?.unique24h ?? 0}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Unique (7d)</p>
              <p className="font-display text-2xl text-card-foreground mt-1">
                {loading ? "—" : traffic?.unique7d ?? 0}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Unique (30d)</p>
              <p className="font-display text-2xl text-card-foreground mt-1">
                {loading ? "—" : traffic?.unique30d ?? 0}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">All-Time Unique</p>
              <p className="font-display text-2xl text-card-foreground mt-1">
                {loading ? "—" : traffic?.totalUnique ?? 0}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground font-body uppercase tracking-wider">Total Page Views</p>
              <p className="font-display text-2xl text-card-foreground mt-1">
                {loading ? "—" : traffic?.totalPageViews ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* Conversion Funnel */}
        <FunnelWidget
          enabled={isAdmin}
          signupDates={users.map((u) => u.createdAt).filter(Boolean)}
          signupRecords={users
            .filter((u) => u.id && u.createdAt)
            .map((u) => ({ id: u.id, createdAt: u.createdAt }))}
        />

        {/* Sign-up Funnel (auth_events) */}
        <AuthFunnelWidget enabled={isAdmin} />

        {/* Listening Analytics */}
        <ListeningAnalyticsWidget enabled={isAdmin} />

        {/* User Segments */}
        <UserSegmentsWidget enabled={isAdmin} />

        {/* Live Visitors */}
        <ModerationQueueWidget enabled={isAdmin} />

        <LiveVisitorsWidget enabled={isAdmin} />

        {/* Presence channel debug */}
        <PresenceDebugPanel />

        {/* Backstage Submissions */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <h2 className="font-display text-sm text-card-foreground">Backstage · Inner Circle</h2>
            <span className="text-xs text-muted-foreground font-body ml-auto">
              {!loading && `${backstage.wishlist.length + backstage.bugs.length + backstage.shares.length} submissions`}
            </span>
          </div>

          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Wishlist */}
              {backstage.wishlist.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-3.5 h-3.5 text-primary" />
                    <h3 className="font-display text-xs text-accent-foreground uppercase tracking-wider">Wish List ({backstage.wishlist.length})</h3>
                  </div>
                  <div className="space-y-2">
                    {backstage.wishlist.map((w) => (
                      <div key={w.id} className="bg-muted/30 border border-border rounded-md p-3 text-sm font-body">
                        <SubmitterBadge userId={w.user_id} />
                        {w.top_request && <p className="text-card-foreground mt-2"><span className="text-muted-foreground">Top request:</span> {w.top_request}</p>}
                        {w.what_works && <p className="text-card-foreground mt-1"><span className="text-muted-foreground">What works:</span> {w.what_works}</p>}
                        {w.bigger_picture && <p className="text-card-foreground mt-1"><span className="text-muted-foreground">Bigger picture:</span> {w.bigger_picture}</p>}
                        <p className="text-xs text-muted-foreground mt-2">{formatDate(w.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bugs */}
              {backstage.bugs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Bug className="w-3.5 h-3.5 text-destructive" />
                    <h3 className="font-display text-xs text-destructive uppercase tracking-wider">Bug Reports ({backstage.bugs.length})</h3>
                  </div>
                  <div className="space-y-2">
                    {backstage.bugs.map((b) => (
                      <div key={b.id} className="bg-muted/30 border border-border rounded-md p-3 text-sm font-body">
                        <SubmitterBadge userId={b.user_id} />
                        <p className="text-card-foreground mt-2">{b.description}</p>
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                          {b.location && <span>📍 {b.location}</span>}
                          {b.device && <span>📱 {b.device}</span>}
                          {b.severity && <span className={b.severity === 'high' ? 'text-destructive' : ''}>⚠️ {b.severity}</span>}
                          {b.repeats !== null && <span>{b.repeats ? '🔁 Repeats' : 'Once'}</span>}
                          <span>{formatDate(b.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shares */}
              {backstage.shares.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-3.5 h-3.5 text-primary" />
                    <h3 className="font-display text-xs text-accent-foreground uppercase tracking-wider">Share Your Set ({backstage.shares.length})</h3>
                  </div>
                  <div className="space-y-2">
                    {backstage.shares.map((s) => (
                      <div key={s.id} className="bg-muted/30 border border-border rounded-md p-3 text-sm font-body">
                        <SubmitterBadge userId={s.user_id} />
                        {s.handle && <p className="text-accent-foreground font-medium mt-1">@{s.handle}</p>}
                        {s.favorite_songs && <p className="text-card-foreground mt-1"><span className="text-muted-foreground">Fav songs:</span> {s.favorite_songs}</p>}
                        {s.favorite_show && <p className="text-card-foreground mt-1"><span className="text-muted-foreground">Fav show:</span> {s.favorite_show}</p>}
                        {s.personal_take && <p className="text-card-foreground mt-1"><span className="text-muted-foreground">Take:</span> {s.personal_take}</p>}
                        <p className="text-xs text-muted-foreground mt-2">{formatDate(s.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {backstage.wishlist.length === 0 && backstage.bugs.length === 0 && backstage.shares.length === 0 && (
                <p className="text-sm text-muted-foreground font-body text-center py-4">No submissions yet.</p>
              )}
            </div>
          )}
        </div>

        {/* User List */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-display text-sm text-card-foreground">User Accounts</h2>
            <span className="text-xs text-muted-foreground font-body ml-auto">
              {!loading && `${users.length} users`}
            </span>
          </div>

          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {users
                .sort(
                  (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )
                .map((u) => (
                  <div
                    key={u.id}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-primary" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/user/${u.id}`)}
                          className="font-body text-sm text-card-foreground font-medium truncate hover:text-accent-foreground transition-colors"
                        >
                          {u.displayName || u.email?.split("@")[0]}
                        </button>
                        {!u.emailConfirmedAt && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-800 font-body">
                            Unverified
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground font-body truncate">
                          <Mail className="w-3 h-3 shrink-0" />
                          {u.email}
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-xs text-muted-foreground font-body flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Joined {formatDate(u.createdAt)}
                      </span>
                      <span
                        className={`text-xs font-body ${
                          u.lastSignInAt &&
                          Date.now() - new Date(u.lastSignInAt).getTime() < 86400000
                            ? "text-accent-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        Last seen {timeAgo(u.lastSignInAt)}
                      </span>
                      <button
                        onClick={() => navigate(`/user/${u.id}`)}
                        className="text-xs font-body text-accent-foreground hover:text-accent-foreground/80 transition-colors flex items-center gap-1 mt-0.5"
                      >
                        <ListMusic className="w-3 h-3" />
                        {u.setlistCount} setlist{u.setlistCount !== 1 ? "s" : ""}
                      </button>
                    </div>

                    {/* Mobile: compact stats */}
                    <div className="flex sm:hidden flex-col items-end gap-0.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground font-body">
                        {timeAgo(u.lastSignInAt)}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-body">
                        {u.setlistCount} sets
                      </span>
                    </div>

                    {/* Send welcome email */}
                    <button
                      onClick={() => handleSendWelcome(u.id, u.email, u.displayName)}
                      disabled={sendingWelcome === u.id}
                      className="p-1.5 text-muted-foreground hover:text-primary transition-colors shrink-0"
                      title="Send welcome email"
                    >
                      {sendingWelcome === u.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Mail className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Delete button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          title="Delete user"
                          disabled={deleting === u.id || u.id === user?.id}
                        >
                          {deleting === u.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-card border-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-display text-card-foreground">
                            Delete {u.displayName || u.email}?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="font-body text-muted-foreground">
                            This will permanently delete this user and all their data including{" "}
                            {u.setlistCount > 0 ? `${u.setlistCount} setlist${u.setlistCount > 1 ? "s" : ""}, ` : ""}
                            profile, and collaborations. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="font-body">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteUser(u.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
