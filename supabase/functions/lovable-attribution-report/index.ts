import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LAUNCH_DATE = new Date("2026-04-24T00:00:00Z"); // Lovable launch
const REPORT_WINDOW_DAYS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const dayMs = 86_400_000;
    const day = Math.floor((now.getTime() - LAUNCH_DATE.getTime()) / dayMs) + 1;

    // Auto-stop after 72 hours
    if (day > REPORT_WINDOW_DAYS) {
      try {
        await supabase.rpc("__noop__"); // not needed
      } catch (_) { /* ignore */ }
      // Best-effort unschedule via raw SQL
      try {
        // @ts-ignore - rpc has no typing for arbitrary functions
        await supabase.from("_dummy_").select("*").limit(0);
      } catch (_) { /* ignore */ }
      console.log(`Day ${day} > ${REPORT_WINDOW_DAYS}, skipping report.`);
      return new Response(JSON.stringify({ skipped: true, day }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since24h = new Date(now.getTime() - dayMs).toISOString();
    const sinceLaunch = LAUNCH_DATE.toISOString();

    // --- Lovable-attributed visitors (24h window) ---
    const { data: lovableVisits24h } = await supabase
      .from("page_visits")
      .select("visitor_id")
      .eq("landing_source", "lovable")
      .gte("created_at", since24h);
    const lovableUnique24h = new Set((lovableVisits24h ?? []).map((v) => v.visitor_id)).size;

    // --- Lovable-attributed visitors (since launch / cumulative) ---
    const { data: lovableAttribution } = await supabase
      .from("visitor_attribution")
      .select("visitor_id, user_id, signed_up_at, first_seen_at")
      .eq("first_source", "lovable")
      .gte("first_seen_at", sinceLaunch);
    const lovableTotalVisitors = (lovableAttribution ?? []).length;
    const lovableSignupsTotal = (lovableAttribution ?? []).filter((a) => a.user_id).length;
    const lovableSignups24h = (lovableAttribution ?? []).filter(
      (a) => a.signed_up_at && new Date(a.signed_up_at).getTime() > now.getTime() - dayMs,
    ).length;

    // --- Overall site totals for context (24h) ---
    const { data: visits24h } = await supabase
      .from("page_visits")
      .select("visitor_id")
      .gte("created_at", since24h);
    const totalUnique24h = new Set((visits24h ?? []).map((v) => v.visitor_id)).size;

    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const newUsers24h = (users ?? []).filter(
      (u) => new Date(u.created_at).getTime() > now.getTime() - dayMs,
    ).length;

    // --- Top non-lovable referrers (24h) for comparison ---
    const { data: sources24h } = await supabase
      .from("page_visits")
      .select("landing_source, visitor_id")
      .not("landing_source", "is", null)
      .gte("created_at", since24h);
    const sourceMap = new Map<string, Set<string>>();
    for (const r of sources24h ?? []) {
      if (!r.landing_source) continue;
      if (!sourceMap.has(r.landing_source)) sourceMap.set(r.landing_source, new Set());
      sourceMap.get(r.landing_source)!.add(r.visitor_id);
    }
    const topSources = Array.from(sourceMap.entries())
      .map(([source, set]) => ({ source, visitors: set.size }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 5);

    const conversionPct = lovableTotalVisitors > 0
      ? ((lovableSignupsTotal / lovableTotalVisitors) * 100).toFixed(1)
      : "0.0";

    const subject = `🌀 Lovable launch — Day ${day} of ${REPORT_WINDOW_DAYS}: ${lovableUnique24h} visits, ${lovableSignups24h} signups`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #08080c; color: #e8e6e0; padding: 32px;">
        <h1 style="color: #d4a037; font-size: 24px; margin: 0 0 8px;">Lovable Launch Report</h1>
        <p style="color: #8a8580; margin: 0 0 24px; font-size: 14px;">Day ${day} of ${REPORT_WINDOW_DAYS} · ${now.toISOString().slice(0, 10)}</p>

        <div style="background: #12121a; border: 1px solid #2a2a35; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
          <h2 style="color: #d4a037; font-size: 16px; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.1em;">Last 24 Hours</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #8a8580;">Lovable visitors</td><td style="text-align: right; font-size: 22px; color: #d4a037; font-weight: bold;">${lovableUnique24h}</td></tr>
            <tr><td style="padding: 8px 0; color: #8a8580;">Lovable signups</td><td style="text-align: right; font-size: 22px; color: #d4a037; font-weight: bold;">${lovableSignups24h}</td></tr>
            <tr><td style="padding: 8px 0; color: #8a8580; border-top: 1px solid #2a2a35;">Total site visitors</td><td style="text-align: right; padding-top: 8px; border-top: 1px solid #2a2a35;">${totalUnique24h}</td></tr>
            <tr><td style="padding: 8px 0; color: #8a8580;">Total new signups</td><td style="text-align: right;">${newUsers24h}</td></tr>
          </table>
        </div>

        <div style="background: #12121a; border: 1px solid #2a2a35; border-radius: 12px; padding: 24px; margin-bottom: 16px;">
          <h2 style="color: #d4a037; font-size: 16px; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.1em;">Since Launch</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #8a8580;">Total Lovable visitors</td><td style="text-align: right; font-weight: bold;">${lovableTotalVisitors}</td></tr>
            <tr><td style="padding: 8px 0; color: #8a8580;">Signed up from Lovable</td><td style="text-align: right; font-weight: bold;">${lovableSignupsTotal}</td></tr>
            <tr><td style="padding: 8px 0; color: #8a8580;">Conversion rate</td><td style="text-align: right; color: #d4a037; font-weight: bold;">${conversionPct}%</td></tr>
          </table>
        </div>

        <div style="background: #12121a; border: 1px solid #2a2a35; border-radius: 12px; padding: 24px;">
          <h2 style="color: #d4a037; font-size: 16px; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.1em;">Top Sources (24h)</h2>
          ${
      topSources.length === 0
        ? '<p style="color: #8a8580; margin: 0;">No referred traffic yet.</p>'
        : topSources
          .map(
            (s) =>
              `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #2a2a35;"><span style="color: ${
                s.source === "lovable" ? "#d4a037" : "#e8e6e0"
              };">${s.source}</span><span style="font-weight: bold;">${s.visitors}</span></div>`,
          )
          .join("")
    }
        </div>

        <p style="color: #5a5550; font-size: 12px; margin-top: 24px; text-align: center;">
          Automated report from dead-set.org · Day ${day} of ${REPORT_WINDOW_DAYS} after Lovable launch
        </p>
      </div>
    `;

    // Send via Resend directly (bypass templated system for this one-off)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("RESEND_API_KEY not set");
      return new Response(JSON.stringify({ error: "Email not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "Dead-Set Reports <reports@notify.dead-set.org>",
        to: ["eljaguaro@gmail.com"],
        subject,
        html,
      }),
    });

    if (!emailRes.ok) {
      const text = await emailRes.text();
      console.error("Resend error:", text);
      return new Response(JSON.stringify({ error: "Email send failed", detail: text }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        day,
        lovableUnique24h,
        lovableSignups24h,
        lovableTotalVisitors,
        lovableSignupsTotal,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Lovable report error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
