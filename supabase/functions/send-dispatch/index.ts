// send-dispatch — Resend-powered editorial dispatch sender.
// POST { dispatch_id, subject, html_path, test_mode, test_recipient }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { DISPATCH_002_HTML_B64 } from "./dispatch_002.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const FROM = "grateful_jaguaro <grateful_jaguaro@dead-set.org>";
const REPLY_TO = "grateful_jaguaro@dead-set.org";
const SITE_ORIGIN = "https://dead-set.org";

// Decode base64 HTML payload (Latin-1 safe).
function decodeB64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

const DISPATCH_HTML: Record<string, string> = {
  "dispatches/002.html": decodeB64(DISPATCH_002_HTML_B64),
  "002": decodeB64(DISPATCH_002_HTML_B64),
};

// Append UTM params to every absolute URL inside the HTML body, and
// substitute the unsubscribe placeholder.
function personalize(opts: {
  html: string;
  dispatchId: string;
  displayName: string | null;
  unsubscribeToken: string;
}): string {
  const { html, dispatchId, displayName, unsubscribeToken } = opts;
  const utm = `utm_source=dispatch&utm_medium=email&utm_campaign=dispatch_${dispatchId}`;

  // 1. Salutation personalization. Source HTML is hard-coded "Hey Now —".
  //    If we have a display name, swap it; else leave as-is.
  let out = html;
  if (displayName && displayName.trim().length > 0) {
    const safeName = displayName.replace(/[<>&]/g, "");
    out = out.replace(/Hey Now —/g, `Hey ${safeName} —`);
  }
  // Also support an explicit {{display_name}} token for future dispatches.
  out = out.replaceAll(
    "{{display_name}}",
    displayName?.trim() ? displayName : "Now",
  );

  // 2. Unsubscribe link — replace href="#" and any {{unsubscribe_token}} usage.
  const unsubUrl = `${SITE_ORIGIN}/unsubscribe?token=${unsubscribeToken}&kind=dispatch`;
  out = out.replaceAll("{{unsubscribe_token}}", unsubscribeToken);
  out = out.replace(/href="#"/g, `href="${unsubUrl}"`);

  // 3. Append UTM params to every http(s) link except mailto / unsubscribe.
  out = out.replace(/href="(https?:\/\/[^"]+)"/g, (_m, url: string) => {
    if (url.includes("/unsubscribe")) return `href="${url}"`;
    const sep = url.includes("?") ? "&" : "?";
    return `href="${url}${sep}${utm}"`;
  });

  return out;
}

interface Recipient {
  user_id: string;
  email: string;
  display_name: string | null;
  dispatch_unsubscribe_token: string;
}

async function sendViaResend(args: {
  to: string;
  subject: string;
  html: string;
  dispatchId: string;
}): Promise<{ id?: string; error?: string }> {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [args.to],
      reply_to: REPLY_TO,
      subject: args.subject,
      html: args.html,
      tags: [{ name: "dispatch_id", value: args.dispatchId }],
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { error: json?.message || `HTTP ${resp.status}` };
  }
  return { id: json?.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const dispatchId = String(body.dispatch_id ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const htmlPath = String(body.html_path ?? "").trim();
  const testMode = body.test_mode === true;
  const testRecipient = body.test_recipient
    ? String(body.test_recipient).trim()
    : null;

  if (!dispatchId || !subject || !htmlPath) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields: dispatch_id, subject, html_path",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const baseHtml = DISPATCH_HTML[htmlPath] ?? DISPATCH_HTML[dispatchId];
  if (!baseHtml) {
    return new Response(
      JSON.stringify({ error: `Unknown dispatch html_path: ${htmlPath}` }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // Build recipient list.
  let recipients: Recipient[] = [];

  if (testMode) {
    if (!testRecipient) {
      return new Response(
        JSON.stringify({ error: "test_mode=true requires test_recipient" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    // Try to enrich with profile so the test renders identically to a real send.
    const { data: enriched } = await supabase
      .from("dispatch_recipients")
      .select("user_id,email,display_name,dispatch_unsubscribe_token")
      .eq("email", testRecipient)
      .maybeSingle();

    recipients = [
      {
        user_id: enriched?.user_id ?? "00000000-0000-0000-0000-000000000000",
        email: testRecipient,
        display_name: enriched?.display_name ?? null,
        dispatch_unsubscribe_token:
          enriched?.dispatch_unsubscribe_token ?? "test-token",
      },
    ];
  } else {
    const { data, error } = await supabase
      .from("dispatch_recipients")
      .select("user_id,email,display_name,dispatch_unsubscribe_token");
    if (error) {
      return new Response(
        JSON.stringify({ error: `Recipient query failed: ${error.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    recipients = (data ?? []) as Recipient[];
  }

  let sent = 0;
  let failed = 0;
  const results: Array<{ email: string; status: string; id?: string }> = [];

  for (const r of recipients) {
    const html = personalize({
      html: baseHtml,
      dispatchId,
      displayName: r.display_name,
      unsubscribeToken: r.dispatch_unsubscribe_token,
    });

    const { id, error } = await sendViaResend({
      to: r.email,
      subject,
      html,
      dispatchId,
    });

    if (error) {
      failed++;
      results.push({ email: r.email, status: "failed" });
      await supabase.from("dispatch_sends").insert({
        dispatch_id: dispatchId,
        user_id: r.user_id,
        email: r.email,
        status: "failed",
        error_message: error,
      });
    } else {
      sent++;
      results.push({ email: r.email, status: "sent", id });
      await supabase.from("dispatch_sends").insert({
        dispatch_id: dispatchId,
        user_id: r.user_id,
        email: r.email,
        resend_message_id: id ?? null,
        status: "sent",
      });
    }

    // 200ms throttle between sends to stay under Resend rate limits.
    if (recipients.length > 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      dispatch_id: dispatchId,
      test_mode: testMode,
      recipient_count: recipients.length,
      sent_count: sent,
      failed_count: failed,
      results,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
