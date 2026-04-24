import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter (per isolate lifetime)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function isRateLimited(visitorId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(visitorId);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(visitorId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Parse a referrer URL or explicit ref param into a normalized source bucket. */
function classifySource(referrer: string | null, refParam: string | null): string | null {
  const r = (refParam || "").toLowerCase().trim();
  if (r === "lovable" || r === "lovable.dev") return "lovable";
  if (!referrer) return refParam ? r.slice(0, 64) : null;
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (host.endsWith("lovable.dev") || host.endsWith("lovable.app")) return "lovable";
    if (host.includes("google.")) return "google";
    if (host.includes("facebook.") || host.includes("fb.")) return "facebook";
    if (host.includes("twitter.") || host === "t.co" || host.includes("x.com")) return "twitter";
    if (host.includes("reddit.")) return "reddit";
    if (host.includes("instagram.")) return "instagram";
    return host.slice(0, 64);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { visitor_id, page_path, user_agent, referrer, ref_param } = body;

    if (!visitor_id || typeof visitor_id !== "string" || !UUID_RE.test(visitor_id)) {
      return new Response(JSON.stringify({ error: "Invalid visitor_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!page_path || typeof page_path !== "string" || page_path.length > 512) {
      return new Response(JSON.stringify({ error: "Invalid page_path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (user_agent !== undefined && user_agent !== null) {
      if (typeof user_agent !== "string" || user_agent.length > 1024) {
        return new Response(JSON.stringify({ error: "Invalid user_agent" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const cleanReferrer =
      typeof referrer === "string" && referrer.length > 0 && referrer.length <= 1024
        ? referrer
        : null;
    const cleanRefParam =
      typeof ref_param === "string" && ref_param.length > 0 && ref_param.length <= 64
        ? ref_param
        : null;
    const landingSource = classifySource(cleanReferrer, cleanRefParam);

    if (isRateLimited(visitor_id)) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await supabase.from("page_visits").insert({
      visitor_id,
      page_path: page_path.slice(0, 512),
      user_agent: user_agent ? user_agent.slice(0, 1024) : null,
      referrer: cleanReferrer ? cleanReferrer.slice(0, 1024) : null,
      landing_source: landingSource,
    });

    if (error) {
      console.error("Insert error:", error.message);
      return new Response(JSON.stringify({ error: "Failed to track" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First-touch attribution: only insert if visitor has no row yet
    // (PRIMARY KEY conflict on duplicate is silently ignored)
    if (landingSource || cleanReferrer) {
      await supabase
        .from("visitor_attribution")
        .insert({
          visitor_id,
          first_referrer: cleanReferrer ? cleanReferrer.slice(0, 1024) : null,
          first_source: landingSource,
          first_landing_path: page_path.slice(0, 512),
        })
        .select()
        .maybeSingle()
        .then(() => null, () => null); // ignore conflicts
    }

    return new Response(JSON.stringify({ ok: true, source: landingSource }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
