// handle-dispatch-unsubscribe — flips profiles.dispatch_opt_in to false
// for the user whose dispatch_unsubscribe_token matches the supplied token.
// Validates token via GET, performs unsubscribe via POST.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function readToken(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("token");
  if (fromQuery) return fromQuery;
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (body?.token) return String(body.token);
    } catch {
      /* ignore */
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const token = await readToken(req);
  if (!token || !UUID_RE.test(token)) {
    return json({ valid: false, reason: "invalid_token" }, 200);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_id,dispatch_opt_in")
    .eq("dispatch_unsubscribe_token", token)
    .maybeSingle();

  if (error) return json({ valid: false, reason: "lookup_error" }, 200);
  if (!profile) return json({ valid: false, reason: "invalid_token" }, 200);

  // GET = validation probe; do not flip the bit.
  if (req.method === "GET") {
    if (profile.dispatch_opt_in === false) {
      return json({ valid: false, reason: "already_unsubscribed" });
    }
    return json({ valid: true });
  }

  // POST = perform unsubscribe.
  if (profile.dispatch_opt_in === false) {
    return json({
      success: false,
      reason: "already_unsubscribed",
      user_id: profile.user_id,
    });
  }

  const { error: upErr } = await supabase
    .from("profiles")
    .update({ dispatch_opt_in: false })
    .eq("user_id", profile.user_id);

  if (upErr) return json({ success: false, reason: "update_failed" }, 500);

  return json({ success: true, user_id: profile.user_id });
});
