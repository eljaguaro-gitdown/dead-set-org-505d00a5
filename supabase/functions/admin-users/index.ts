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
    console.log("isServiceRole:", isServiceRole, "token length:", token.length, "key length:", serviceRoleKey?.length);

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

    // Delete users
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
        const { error } = await adminClient.auth.admin.deleteUser(uid);
        results.push({ id: uid, error: error?.message || null });
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

    return new Response(JSON.stringify({ users: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
