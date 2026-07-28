import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, authorization, apikey, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};

const jsonHeaders = { ...corsHeaders, "content-type": "application/json" };

function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: jsonHeaders });
    }

    const name1 = clip((body as any).name1, 2000);
    const name2 = clip((body as any).name2, 2000);
    const email = clip((body as any).email, 2000);
    const why = clip((body as any).why, 8000);

    if (!name1 || !name2 || !email || !why) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: jsonHeaders });
    }
    if (!isEmail(email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: jsonHeaders });
    }

    const handles = clip((body as any).handles, 2000);
    const location = clip((body as any).where, 2000);
    const experience = clip((body as any).experience, 2000);
    const demo = clip((body as any).demo, 2000);
    const source = clip((body as any).source, 2000);
    const userAgent = clip(req.headers.get("user-agent"), 2000);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await supabase.from("podcast_applications").insert({
      name1, name2, email, handles, location, experience, demo, why, source,
      user_agent: userAgent,
    });

    if (error) {
      console.error("podcast-application insert error", error);
      return new Response(JSON.stringify({ error: "Could not save application" }), { status: 500, headers: jsonHeaders });
    }

    // Best-effort notification email; never fails the request.
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      try {
        const subject = `New Dead Set podcast host application — ${name1} & ${name2}`;
        const text = [
          `Hosts: ${name1} & ${name2}`,
          `Email: ${email}`,
          `Handles: ${handles || "—"}`,
          `Where: ${location || "—"}`,
          `Experience: ${experience || "—"}`,
          `Clip: ${demo || "—"}`,
          `Source: ${source || "—"}`,
          ``,
          `What kind of night it is:`,
          why,
        ].join("\n");

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "authorization": `Bearer ${resendKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: "Dead Set <notify@dead-set.org>",
            to: ["grateful_jaguaro@dead-set.org"],
            reply_to: email,
            subject,
            text,
          }),
        });
      } catch (mailErr) {
        console.error("podcast-application email error", mailErr);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
  } catch (err) {
    console.error("podcast-application unexpected error", err);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500, headers: jsonHeaders });
  }
});
