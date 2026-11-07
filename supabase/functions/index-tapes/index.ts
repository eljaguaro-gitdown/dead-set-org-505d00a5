// index-tapes: fill public.tape_index, so a fan's tap never waits on an
// Archive search (docs/playback-sprint).
//
// POST { song_id, show_date, identifier? }      on demand, public
//   The player asks for this after an index miss, then resolves live itself;
//   the answer is for the NEXT fan. Validated, and a night verified in the
//   last 6 hours is not asked again, so a loop of calls costs one lookup.
// POST { mode: "refresh", limit }               hourly cron, internal only
//   Walks tape_index_candidates(): every night the product can offer that
//   is missing or older than 7 days. Requires x-dead-set-internal, a hash of
//   the service key (internalSend.ts explains why not the bearer).
//
// verify_jwt = false (config.toml): on-demand calls come from anonymous fans.
// Writes go through the service role; the table refuses anon writes.
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveNight, resolveSong, type TapeIndexRow } from "../_shared/tapeIndexResolve.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const IDENT = /^[A-Za-z0-9._-]{1,200}$/;
const COOLDOWN_MS = 6 * 60 * 60 * 1000;
const BUDGET_MS = 120_000;

async function internalToken(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`index-tapes:${key}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
async function store(db: any, songId: string, day: string, rows: TapeIndexRow[]) {
  if (rows.length === 0) return null;
  const now = new Date().toISOString();
  if (rows.some((r) => r.is_song_default)) {
    const { error } = await db.from("tape_index").update({ is_song_default: false }).eq("song_id", songId).eq("is_song_default", true);
    if (error) return error.message;
  }
  // The night's answer may have changed: clear the old default first, so the
  // one-default index never refuses the new one.
  if (rows.some((r) => r.is_default)) {
    const { error } = await db.from("tape_index").update({ is_default: false }).eq("song_id", songId).eq("show_date", day).eq("is_default", true);
    if (error) return error.message;
  }
  const { error } = await db.from("tape_index").upsert(rows.map((r) => ({ ...r, verified_at: now })), { onConflict: "song_id,show_date,identifier" });
  return error?.message ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  if (body.mode === "refresh") {
    const presented = req.headers.get("x-dead-set-internal") ?? "";
    if (!presented || presented !== (await internalToken(serviceKey))) {
      console.warn("index-tapes refresh refused: internal header", presented ? "did not match" : "absent");
      return json({ error: "internal only" }, 401);
    }
    const limit = Math.min(Math.max(Number(body.limit) || 40, 1), 200);
    const { data: keys, error } = await db.rpc("tape_index_candidates", { p_limit: limit });
    if (error) return json({ error: error.message }, 500);
    const started = Date.now();
    const out = { picked: keys?.length ?? 0, stored: 0, unreachable: 0, errors: 0, requests: 0 };
    for (const k of keys ?? []) {
      if (Date.now() - started > BUDGET_MS) break;
      const r = k.show_date
        ? await resolveNight(fetch, { songId: k.song_id, songTitle: k.song_title, showDate: k.show_date, storedIdentifier: k.stored_identifier })
        : await resolveSong(fetch, { songId: k.song_id, songTitle: k.song_title });
      out.requests += r.requests;
      if (r.rows.length === 0) { if (r.unreachable) out.unreachable++; continue; }
      const err = await store(db, k.song_id, r.rows[0].show_date, r.rows);
      if (err) { out.errors++; console.warn("index-tapes store failed", err); } else out.stored++;
      await new Promise((res) => setTimeout(res, 150)); // stewardship
    }
    return json(out);
  }

  const songId = String(body.song_id ?? "");
  const day = String(body.show_date ?? "").slice(0, 10);
  const ident = body.identifier ? String(body.identifier) : null;
  if (!UUID.test(songId) || !DAY.test(day) || day < "1965-01-01" || day > "1995-12-31" || (ident && !IDENT.test(ident))) {
    return json({ error: "bad key" }, 400);
  }
  // The cooldown applies to a named recording too, keyed by its own row. It
  // used to be skipped whenever an identifier was supplied, so one public
  // caller could loop a valid key and make this function read the Archive
  // on every call (pre-release gate, 2026-11-07).
  let freshQ = db.from("tape_index").select("verified_at").eq("song_id", songId).eq("show_date", day);
  if (ident) freshQ = freshQ.eq("identifier", ident);
  const { data: fresh } = await freshQ.order("verified_at", { ascending: false }).limit(1);
  if (fresh?.[0] && Date.now() - Date.parse(fresh[0].verified_at) < COOLDOWN_MS) return json({ cached: true });
  const { data: song } = await db.from("songs").select("title").eq("id", songId).maybeSingle();
  if (!song?.title) return json({ error: "unknown song" }, 404);
  const r = await resolveNight(fetch, { songId, songTitle: song.title, showDate: day, storedIdentifier: ident });
  if (r.unreachable && r.rows.length === 0) return json({ unreachable: true }, 503);
  const err = await store(db, songId, day, r.rows);
  return err ? json({ error: err }, 500) : json({ stored: r.rows.length, status: r.rows.find((x) => x.is_default)?.status ?? null });
});
