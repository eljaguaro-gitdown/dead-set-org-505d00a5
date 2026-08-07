import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// In-app account deletion (App Store guideline 5.1.1(v) and GDPR-style
// erasure). verify_jwt = true in config.toml — the gateway guarantees a
// valid JWT before this code runs; we still resolve the user from it and
// only ever delete that user's own data.
//
// No public.* table has a real FK to auth.users, so auth.admin.deleteUser
// alone would orphan everything — each table is handled explicitly:
//   - personal data and content: hard-deleted
//   - analytics rows: anonymized (user_id -> null) to keep aggregates honest

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uid = user.id;
    const email = user.email?.toLowerCase() ?? null;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1) Owned setlists and everything hanging off them
    const { data: ownedSetlists } = await admin
      .from("setlists")
      .select("id")
      .eq("creator_id", uid);
    const setlistIds = (ownedSetlists ?? []).map((s) => s.id);
    if (setlistIds.length > 0) {
      for (const table of [
        "setlist_slots",
        "setlist_upvotes",
        "setlist_comments",
        "collaborators",
        "comment_notifications",
      ]) {
        const { error } = await admin.from(table).delete().in("setlist_id", setlistIds);
        if (error) console.warn(`[delete-account] ${table} by setlist:`, error.message);
      }
      const { error } = await admin.from("setlists").delete().in("id", setlistIds);
      if (error) throw new Error(`setlists delete failed: ${error.message}`);
    }

    // 2) Rows keyed directly to the user — hard delete
    const deleteByColumn: Array<[string, string]> = [
      ["setlist_upvotes", "user_id"],
      ["setlist_comments", "user_id"],
      ["collaborators", "user_id"],
      ["favorites", "user_id"],
      ["favorite_songs", "user_id"],
      ["favorite_song_setlists", "user_id"],
      ["chat_messages", "user_id"],
      ["direct_messages", "sender_id"],
      ["conversation_members", "user_id"],
      ["cosmic_charlie_history", "user_id"],
      ["insider_bugs", "user_id"],
      ["insider_shares", "user_id"],
      ["insider_wishlist", "user_id"],
      ["announcement_reads", "user_id"],
      ["comment_notifications", "recipient_user_id"],
      ["comment_notifications", "commenter_user_id"],
      ["user_roles", "user_id"],
      ["profiles", "user_id"],
    ];
    for (const [table, column] of deleteByColumn) {
      const { error } = await admin.from(table).delete().eq(column, uid);
      if (error) console.warn(`[delete-account] ${table}.${column}:`, error.message);
    }

    // 3) Slots the user added to OTHER people's setlists: keep the slot,
    //    drop the attribution
    await admin
      .from("setlist_slots")
      .update({ added_by_user_id: null })
      .eq("added_by_user_id", uid);

    // 4) Analytics: anonymize, keep aggregates
    for (const table of [
      "auth_events",
      "play_events",
      "share_events",
      "ab_test_assignments",
      "visitor_attribution",
      "email_sends",
      "dispatch_sends",
    ]) {
      const { error } = await admin.from(table).update({ user_id: null }).eq("user_id", uid);
      if (error) console.warn(`[delete-account] anonymize ${table}:`, error.message);
    }

    // 5) Email artifacts tied to the address
    if (email) {
      await admin.from("email_unsubscribe_tokens").delete().eq("email", email);
    }

    // 6) Finally, the auth user itself
    const { error: authError } = await admin.auth.admin.deleteUser(uid);
    if (authError) throw new Error(`auth delete failed: ${authError.message}`);

    console.log(`[delete-account] deleted user ${uid}`);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[delete-account] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
