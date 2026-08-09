// send-dispatch — editorial dispatch sender using the project email queue.
// POST { dispatch_id, subject, html_path, test_mode, test_recipient }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { DISPATCH_002_HTML_B64 } from "./dispatch_002.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-visitor-id, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FROM = "Dead Set <noreply@notify.dead-set.org>";
const REPLY_TO = "grateful_jaguaro@dead-set.org";
const SENDER_DOMAIN = "notify.dead-set.org";
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

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getTransactionalUnsubscribeToken(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<{ token?: string; error?: string }> {
  const normalizedEmail = email.toLowerCase();
  const { data: existingToken, error: lookupError } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (lookupError) return { error: `Unsubscribe lookup failed: ${lookupError.message}` };
  if (existingToken?.token) return { token: existingToken.token };

  const token = generateToken();
  const { error: tokenError } = await supabase
    .from("email_unsubscribe_tokens")
    .upsert({ token, email: normalizedEmail }, { onConflict: "email", ignoreDuplicates: true });
  if (tokenError) return { error: `Unsubscribe token failed: ${tokenError.message}` };

  const { data: storedToken, error: rereadError } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (rereadError || !storedToken?.token) {
    return { error: "Unsubscribe token could not be confirmed" };
  }

  return { token: storedToken.token };
}

async function enqueueDispatchEmail(args: {
  supabase: ReturnType<typeof createClient>;
  to: string;
  subject: string;
  html: string;
  dispatchId: string;
}): Promise<{ id?: string; error?: string }> {
  const messageId = crypto.randomUUID();
  const { token: unsubscribeToken, error: tokenError } =
    await getTransactionalUnsubscribeToken(args.supabase, args.to);
  if (tokenError || !unsubscribeToken) return { error: tokenError ?? "Missing unsubscribe token" };

  const { error: logError } = await args.supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: `dispatch-${args.dispatchId}`,
    recipient_email: args.to,
    status: "pending",
  });
  if (logError) return { error: `Send log failed: ${logError.message}` };

  const { error: enqueueError } = await args.supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: args.to,
      from: FROM,
      reply_to: REPLY_TO,
      sender_domain: SENDER_DOMAIN,
      subject: args.subject,
      html: args.html,
      text: "Dead-Set.Org Editorial Dispatch",
      purpose: "transactional",
      label: `dispatch-${args.dispatchId}`,
      idempotency_key: `dispatch-${args.dispatchId}-${args.to}-${messageId}`,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });
  if (enqueueError) return { error: `Queue failed: ${enqueueError.message}` };

  return { id: messageId };
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

  // Authorization: must be either the service-role key, or an authenticated
  // admin user. verify_jwt=true ensures an Authorization header is present.
  const authHeader = req.headers.get("Authorization") ?? "";
  const presentedToken = authHeader.replace(/^Bearer\s+/i, "");
  const isServiceRole =
    presentedToken === SERVICE_KEY || parseJwtClaims(presentedToken)?.role === "service_role";

  if (!isServiceRole) {
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const uid = userRes?.user?.id;
    if (!uid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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

    const { id, error } = await enqueueDispatchEmail({
      supabase,
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
        status: "queued",
      });
    }

    // Keep enqueue bursts gentle so the dispatcher can drain smoothly.
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
