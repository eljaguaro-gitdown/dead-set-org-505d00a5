import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    // Default: list users
    const {
      data: { users },
      error: listError,
    } = await adminClient.auth.admin.listUsers({ perPage: 200 });

    if (listError) throw listError;

    const { data: profiles } = await adminClient
      .from("profiles")
      .select("user_id, display_name, avatar_url");

    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.user_id, p])
    );

    const { data: setlistCounts } = await adminClient
      .from("setlists")
      .select("creator_id");

    const countMap = new Map<string, number>();
    (setlistCounts || []).forEach((s: any) => {
      countMap.set(s.creator_id, (countMap.get(s.creator_id) || 0) + 1);
    });

    // Traffic stats
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 86400000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 604800000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 2592000000).toISOString();

    const { count: totalPageViews } = await adminClient
      .from("page_visits")
      .select("*", { count: "exact", head: true });

    const { data: visitors24h } = await adminClient
      .from("page_visits")
      .select("visitor_id")
      .gte("created_at", oneDayAgo);
    const unique24h = new Set((visitors24h || []).map((v: any) => v.visitor_id)).size;

    const { data: visitors7d } = await adminClient
      .from("page_visits")
      .select("visitor_id")
      .gte("created_at", sevenDaysAgo);
    const unique7d = new Set((visitors7d || []).map((v: any) => v.visitor_id)).size;

    const { data: visitors30d } = await adminClient
      .from("page_visits")
      .select("visitor_id")
      .gte("created_at", thirtyDaysAgo);
    const unique30d = new Set((visitors30d || []).map((v: any) => v.visitor_id)).size;

    const { data: allVisitors } = await adminClient
      .from("page_visits")
      .select("visitor_id");
    const totalUnique = new Set((allVisitors || []).map((v: any) => v.visitor_id)).size;

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
