import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { POSTHOG_EXTERNAL_TRAFFIC_WHERE, queryPostHog } from "../_shared/posthogQuery.ts";
import { buildAdminTrafficSql, toAdminTraffic } from "./traffic.ts";
import { checkAdmin } from "../_shared/requireAdmin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-visitor-id",
};

interface ReportedTarget {
  ownerId: string | null;
  excerpt: string | null;
  link: string | null;
  /** The content no longer exists — deleted by its author, or already removed. */
  gone: boolean;
}

/** Who posted a reported item, what it said, and where it lives. */
// deno-lint-ignore no-explicit-any
const resolveReported = async (admin: any, type: string, id: string): Promise<ReportedTarget> => {
  if (type === "setlist") {
    const { data } = await admin.from("setlists").select("title, creator_id").eq("id", id).maybeSingle();
    return data
      ? { ownerId: data.creator_id, excerpt: data.title, link: `/setlist/${id}`, gone: false }
      : { ownerId: null, excerpt: null, link: null, gone: true };
  }
  if (type === "comment") {
    const { data } = await admin
      .from("setlist_comments")
      .select("content, user_id, setlist_id")
      .eq("id", id)
      .maybeSingle();
    return data
      ? { ownerId: data.user_id, excerpt: data.content, link: `/setlist/${data.setlist_id}`, gone: false }
      : { ownerId: null, excerpt: null, link: null, gone: true };
  }
  if (type === "message") {
    const { data } = await admin
      .from("direct_messages")
      .select("content, sender_id")
      .eq("id", id)
      .maybeSingle();
    return data
      ? { ownerId: data.sender_id, excerpt: data.content, link: null, gone: false }
      : { ownerId: null, excerpt: null, link: null, gone: true };
  }
  // profile: the report is about the account itself, so the owner is the id.
  const { data } = await admin.from("profiles").select("display_name").eq("user_id", id).maybeSingle();
  return { ownerId: id, excerpt: data?.display_name ?? null, link: `/user/${id}`, gone: !data };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service role to manage auth users
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Admin or service role only, before anything is read: this function has
    // verify_jwt = false and returns every account's email. See
    // _shared/requireAdmin.ts, which send-beta-nudge runs too.
    const auth = await checkAdmin(req.headers.get("Authorization"), {
      serviceRoleKey,
      getUserId: async (authHeader) => {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data, error } = await userClient.auth.getUser();
        return error || !data.user ? null : data.user.id;
      },
      // The identity is proven above, so the role is read with the service
      // client rather than through user_roles' RLS.
      isAdmin: async (userId) => {
        const { data } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        return !!data;
      },
      // Only the service role may list users, so a token that can is one. See
      // _shared/requireAdmin.ts: asked only of a token that claims the role.
      isServiceRoleToken: async (token) => {
        const probe = createClient(supabaseUrl, token, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error } = await probe.auth.admin.listUsers({ page: 1, perPage: 1 });
        return !error;
      },
    });
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = auth.callerId;

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Delete users (with cascade cleanup)
    if (action === "delete") {
      const { userIds } = await req.json();
      if (!Array.isArray(userIds)) {
        return new Response(JSON.stringify({ error: "userIds must be an array" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const results = [];
      for (const uid of userIds) {
        try {
          // Get setlists owned by this user
          const { data: ownedSetlists } = await adminClient
            .from("setlists")
            .select("id")
            .eq("creator_id", uid);
          const setlistIds = (ownedSetlists || []).map((s: any) => s.id);

          if (setlistIds.length > 0) {
            // Delete all child records for owned setlists
            await adminClient.from("setlist_slots").delete().in("setlist_id", setlistIds);
            await adminClient.from("chat_messages").delete().in("setlist_id", setlistIds);
            await adminClient.from("collaborators").delete().in("setlist_id", setlistIds);
            await adminClient.from("setlists").delete().in("id", setlistIds);
          }

          // Clean up user references in other setlists
          await adminClient.from("chat_messages").delete().eq("user_id", uid);
          await adminClient.from("collaborators").delete().eq("user_id", uid);
          // Nullify added_by_user_id references in slots
          await adminClient.from("setlist_slots").update({ added_by_user_id: null }).eq("added_by_user_id", uid);
          // Delete profile and roles
          await adminClient.from("profiles").delete().eq("user_id", uid);
          await adminClient.from("user_roles").delete().eq("user_id", uid);
          // Delete auth user
          const { error } = await adminClient.auth.admin.deleteUser(uid);
          results.push({ id: uid, error: error?.message || null });
        } catch (e: any) {
          results.push({ id: uid, error: e.message });
        }
      }
      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Moderation — App Store guideline 1.2 requires acting on a report within
    // 24 hours by removing the content and ejecting the user who posted it.
    // Both actions live here because banning goes through the auth admin API,
    // and because the queue needs the reported text and its author: a direct
    // message is not readable through RLS by anyone outside the conversation.
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    if (action === "reports") {
      const { data: reports, error } = await adminClient
        .from("content_reports")
        .select("id, content_type, content_id, reason, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) throw error;

      const withTargets = await Promise.all(
        (reports ?? []).map(async (r: any) => ({
          id: r.id,
          contentType: r.content_type,
          contentId: r.content_id,
          reason: r.reason,
          createdAt: r.created_at,
          ...(await resolveReported(adminClient, r.content_type, r.content_id)),
        })),
      );

      const ownerIds = [...new Set(withTargets.map((r) => r.ownerId).filter(Boolean))];
      const { data: owners } = ownerIds.length
        ? await adminClient.from("profiles").select("user_id, display_name").in("user_id", ownerIds)
        : { data: [] };
      const nameOf = new Map((owners ?? []).map((p: any) => [p.user_id, p.display_name]));

      return json({
        reports: withTargets.map((r) => ({
          ...r,
          ownerName: (r.ownerId && nameOf.get(r.ownerId)) || null,
        })),
      });
    }

    if (action === "moderate") {
      const { reportId, decision } = await req.json();
      if (!["dismiss", "remove", "remove_and_ban"].includes(decision)) {
        return json({ error: "decision must be dismiss, remove or remove_and_ban" }, 400);
      }

      const { data: report } = await adminClient
        .from("content_reports")
        .select("id, content_type, content_id")
        .eq("id", reportId)
        .maybeSingle();
      if (!report) return json({ error: "Report not found" }, 404);

      const target = await resolveReported(adminClient, report.content_type, report.content_id);
      const banning = decision === "remove_and_ban";

      // Refuse before touching anything, so a refused ban never half-applies.
      if (banning) {
        if (!target.ownerId) return json({ error: "No account to ban — the content is already gone" }, 409);
        if (target.ownerId === callerId) return json({ error: "That's your own account" }, 400);
        const { data: ownerIsAdmin } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", target.ownerId)
          .eq("role", "admin")
          .maybeSingle();
        if (ownerIsAdmin) return json({ error: "Won't ban an admin account from here" }, 400);
      }

      const done: string[] = [];

      if (decision !== "dismiss" && !target.gone) {
        // Foreign keys to setlists and setlist_comments cascade, so one delete
        // takes the slots, votes, comments and notifications with it.
        const removal =
          report.content_type === "setlist"
            ? adminClient.from("setlists").delete().eq("id", report.content_id)
            : report.content_type === "comment"
              ? adminClient.from("setlist_comments").delete().eq("id", report.content_id)
              : report.content_type === "message"
                ? adminClient.from("direct_messages").delete().eq("id", report.content_id)
                : adminClient
                    .from("profiles")
                    .update({ display_name: null, avatar_url: null })
                    .eq("user_id", report.content_id);
        const { error } = await removal;
        if (error) throw new Error(`remove ${report.content_type} failed: ${error.message}`);
        done.push("removed");
      }

      if (banning) {
        // ~100 years. A ban stops sign-in and token refresh; the account and
        // its data stay, so a mistaken ban can be lifted.
        const { error } = await adminClient.auth.admin.updateUserById(target.ownerId!, {
          ban_duration: "876000h",
        });
        if (error) throw new Error(`ban failed: ${error.message}`);
        // And off every feed: unpublish, rather than delete, the rest of their setlists.
        await adminClient.from("setlists").update({ is_public: false }).eq("creator_id", target.ownerId!);
        done.push("banned");
      }

      // One incident, however many people reported it: settle every open
      // report on the same content, and on the account when it was banned.
      const settled = {
        status: decision === "dismiss" ? "dismissed" : "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: callerId,
      };
      await adminClient
        .from("content_reports")
        .update(settled)
        .eq("content_type", report.content_type)
        .eq("content_id", report.content_id)
        .eq("status", "open");
      if (banning) {
        await adminClient
          .from("content_reports")
          .update(settled)
          .eq("content_type", "profile")
          .eq("content_id", target.ownerId!)
          .eq("status", "open");
      }

      return json({ ok: true, done });
    }

    // Default: list users — fetch users, profiles, setlist counts, and
    // traffic stats in parallel. Traffic comes from PostHog with the shared
    // external-traffic filter (production host, internal cohort and bots
    // excluded), the same numbers the daily and weekly reports use. It used
    // to come from page_visits, which counted every Lovable preview reload
    // and admin session as a visitor. See traffic.ts. queryPostHog never
    // throws; a failure gives null, which the dashboard shows as "—".
    const [usersRes, profilesRes, setlistCountsRes, trafficRows] = await Promise.all([
      adminClient.auth.admin.listUsers({ perPage: 200 }),
      adminClient.from("profiles").select("user_id, display_name, avatar_url"),
      adminClient.from("setlists").select("creator_id").limit(20000),
      queryPostHog("admin-users traffic", buildAdminTrafficSql(POSTHOG_EXTERNAL_TRAFFIC_WHERE)),
    ]);

    if (usersRes.error) throw usersRes.error;
    const users = usersRes.data.users;

    const profileMap = new Map(
      (profilesRes.data || []).map((p: any) => [p.user_id, p])
    );

    const countMap = new Map<string, number>();
    (setlistCountsRes.data || []).forEach((s: any) => {
      countMap.set(s.creator_id, (countMap.get(s.creator_id) || 0) + 1);
    });

    const traffic = toAdminTraffic(trafficRows);

    const result = (users || []).map((u: any) => {
      const profile = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email,
        displayName: (profile as any)?.display_name || null,
        avatarUrl: (profile as any)?.avatar_url || null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        emailConfirmedAt: u.email_confirmed_at,
        setlistCount: countMap.get(u.id) || 0,
      };
    });

    return new Response(JSON.stringify({
      users: result,
      traffic,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
