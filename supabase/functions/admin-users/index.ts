import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-visitor-id",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allow service role key as bearer token (for internal calls)
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      // Create client with user's token to check role
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: userError,
      } = await userClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check admin role
      const { data: roleData } = await userClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Use service role to manage auth users
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

    // Default: list users — fetch users, profiles, setlist counts, and
    // traffic stats in parallel. Traffic stats are computed in a single
    // SQL function instead of pulling the full page_visits table client-side
    // (which was causing 60-130s response times and mobile timeouts).
    // Traffic: refresh the cache (best-effort), then read it directly.
    // get_admin_traffic_stats RPC can't be used here — it checks
    // has_role(auth.uid()) and the service-role client has no uid, so the
    // call raises and the panel rendered zeros. This function already
    // verified the caller is an admin above.
    const [usersRes, profilesRes, setlistCountsRes, trafficRes] = await Promise.all([
      adminClient.auth.admin.listUsers({ perPage: 200 }),
      adminClient.from("profiles").select("user_id, display_name, avatar_url"),
      adminClient.from("setlists").select("creator_id").limit(20000),
      adminClient
        .rpc("refresh_admin_traffic_stats")
        .then(() => adminClient.from("admin_traffic_stats_cache").select("*").eq("id", 1).maybeSingle())
        .catch(() => adminClient.from("admin_traffic_stats_cache").select("*").eq("id", 1).maybeSingle()),
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

    const trafficRow = trafficRes.data ?? null;
    const totalPageViews = Number(trafficRow?.total_page_views ?? 0);
    const totalUnique = Number(trafficRow?.total_unique ?? 0);
    const unique24h = Number(trafficRow?.unique_24h ?? 0);
    const unique7d = Number(trafficRow?.unique_7d ?? 0);
    const unique30d = Number(trafficRow?.unique_30d ?? 0);

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
      traffic: {
        totalPageViews: totalPageViews || 0,
        totalUnique,
        unique24h,
        unique7d,
        unique30d,
      },
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
