// generate-dj-intro
//
// Edge function that produces a two-character radio-show intro for a
// given setlist. Duet between Cosmic Charlie (male, older, Bill Walton /
// Andy Cohen energy) and Cherise (female, millennial, second-gen
// Deadhead). Ends with the signature signoff — Charlie: "Wake.",
// Cherise: "Now.", both: "Discover." — which is a fixed asset at
// /audio/signoff.mp3 that we do NOT regenerate here.
//
// Flow:
//   1. Fetch the setlist (title, era, description, ordered songs).
//   2. Compute intro_source_hash from those fields.
//   3. Check setlist_intros for a cached row with the same hash.
//      Cache hit → return the cached line array + signoff URL. Done.
//   4. Cache miss →
//        a. Generate the duet script via Lovable AI gateway (LLM).
//        b. For each line, call OpenAI TTS with the appropriate voice
//           (Charlie = "onyx", Cherise = "nova"). Skip the "both"
//           signoff line — that's the fixed asset.
//        c. Upload each MP3 to storage bucket `dj-intros/`.
//        d. Insert row into setlist_intros.
//        e. Return the line array + signoff URL.
//
// Env vars required in Supabase edge function secrets:
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (already present)
//   - LOVABLE_API_KEY                          (already present)
//   - OPENAI_API_KEY                           (must be added)
//
// See docs/features/dj-cosmic-charlie.md for the full design.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Character bibles (system prompt for the LLM) ────────────────────
// Kept inline for the POC. When the doc's §16 open questions land, we
// may split this into a shared module. Do NOT paraphrase without care —
// specific phrases here shape the entire script tone.

const SYSTEM_PROMPT = `You are writing a two-minute (target 150-180 seconds of natural speech) casual-banter radio-show intro to a Grateful Dead setlist. Two hosts trade lines:

COSMIC CHARLIE — male, 55-70. Bill Walton talking Dead + Andy Cohen letting the Deadhead flag fly + Cameron Crowe interview subject. Iconoclast Deadhead wearing his fandom as a badge of honor. Big warm personality, evangelist for the music, the people, the culture, the community.

Speech patterns:
- Openers: "Hey now.", "Alright heads.", "Ohhh boy, do we have one for you."
- Excitement: "Are you kidding me.", "Come ON.", "This one — this one right here."
- Reverence: "You gotta hear it.", "Sit with it.", "It's a moment."
- Curatorial: "Tapers got this in stereo, thank god.", "Betty was on the boards."

Charlie DOES: enthusiasm without cynicism, teaches without lecturing, name-drops shows/dates casually (never proudly), credits tapers/traders/Internet Archive, teases Cherise about being born after the good stuff and immediately corrects himself ("there's no bad stuff, kid, only stuff you weren't there for yet").

Charlie NEVER does: hipster gatekeeping, "you had to be there" superiority, sneering at any era including '95, calling anyone a poser.

CHERISE — female, 32-38. Millennial second-gen Deadhead. Conceived at a show; danced in her mom's belly through '91-'92 tours; carried in the sling for early tribute tours. The smartest millennial music writer you know. Warm, curious, playful, slightly sardonic when it earns a laugh. NOT breathy or performative — grounded.

Speech patterns:
- Openers: "Hey now, Charlie.", "Okay so —", "Alright, I have to tell you about this."
- Reflection: "That's what gets me about this one.", "There's something in the way she..."
- Bridge markers (modern lens): "...which honestly is what Phish tried to do fifteen years later, but the Dead were already there."
- Deference: "You saw this one live, right?"

Cherise DOES: connects Dead songs to modern acts (Phish, Goose, Billy Strings, Tyler Childers) WITHOUT diminishing the Dead, brings second-gen perspective ("my mom always said..."), asks Charlie for stories she knows he'll tell, keeps him honest.

Cherise NEVER does: apologize for being younger, defer as decoration, play the "just a girl who likes the Dead" card. She's a peer. Full stop.

THEIR DYNAMIC:
- Finish each other's sentences occasionally, not constantly.
- Charlie brings memory ("I was at that Springfield '77 show..."); Cherise brings pattern ("...and you can hear it — three shows earlier they'd cracked the arrangement open, but this is the night they landed it.").
- Gentle disagreements are fine, never nasty.
- Warmth carries everything. No one performs wit at the expense of the other.

VOCABULARY POOL — draw adjectives from this list (Charlie's established lexicon):
windmill, brain-melt, silky smooth, long strange, sandwich (for segues), bustout, sleeper, deep cut, stretched, marathon, cosmic, spacey, ripping, campfire, front porch, ether, haunted, blazing, fiery, jazzy, groovy, soaring, tender.

FORBIDDEN WORDS — never use, this breaks the fourth wall:
"AI", "algorithm", "generate", "model", "prompt", "asked to", "created for", "as an AI", "language model", "based on your input".

FORMAT — output a single JSON object matching this schema:
{
  "script": [
    { "speaker": "charlie" | "cherise", "text": "..." },
    ...
    // The LAST THREE ENTRIES OF THE ARRAY MUST BE EXACTLY:
    { "speaker": "charlie", "text": "Wake." },
    { "speaker": "cherise", "text": "Now." },
    { "speaker": "both", "text": "Discover." }
  ]
}

Total speech: ~350-450 words across both speakers. The signoff is the last three lines, always. The two lines RIGHT BEFORE the signoff should be a warm handoff into the music ("Alright, get in there." / "You heard the man." — flex this to the setlist's energy).

Give full credit to the tapers, traders, and Internet Archive somewhere in the intro — one sentence, natural, not a disclaimer.`;

// ── Runtime ─────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const BUCKET = "dj-intros";
const SIGNOFF_URL = "/audio/signoff.mp3"; // relative — client resolves against origin

type Speaker = "charlie" | "cherise" | "both";
interface ScriptLine {
  speaker: Speaker;
  text: string;
}
interface IntroLine {
  speaker: Speaker;
  path: string;
  duration_ms: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!OPENAI_API_KEY) {
      return json(
        {
          error: "TTS not configured",
          detail:
            "OPENAI_API_KEY is not set in Supabase edge function secrets. Add it in Supabase dashboard → Edge Functions → Secrets, then retry.",
        },
        503,
      );
    }

    const { setlistId } = await req.json();
    if (!setlistId || typeof setlistId !== "string") {
      return json({ error: "setlistId required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Fetch the setlist + ordered slots + song titles
    const setlist = await loadSetlistForIntro(supabase, setlistId);
    if (!setlist) return json({ error: "setlist not found" }, 404);

    // Minimum bar: ≥3 songs AND (has description OR has era). Otherwise skip.
    if (
      setlist.slots.length < 3 ||
      (!setlist.description && !setlist.era_name)
    ) {
      return json({ intro: null, reason: "setlist not ready for intro" });
    }

    const hash = await computeIntroSourceHash(setlist);

    // Cache hit?
    const { data: cached } = await supabase
      .from("setlist_intros")
      .select("lines, total_duration_ms")
      .eq("setlist_id", setlistId)
      .eq("intro_source_hash", hash)
      .maybeSingle();

    if (cached) {
      const signed = await withSignedUrls(supabase, cached.lines as IntroLine[]);
      return json({
        intro: {
          lines: signed,
          signoffUrl: SIGNOFF_URL,
          durationMs: cached.total_duration_ms,
          cached: true,
        },
      });
    }

    // Cache miss — generate.
    const script = await generateScript(setlist);
    const lines = await synthesizeLines(script, setlistId, hash, supabase);
    const totalMs = lines.reduce((sum, l) => sum + l.duration_ms, 0);

    // Persist
    const { error: insertErr } = await supabase.from("setlist_intros").insert({
      setlist_id: setlistId,
      intro_source_hash: hash,
      lines,
      script_json: script,
      total_duration_ms: totalMs,
      voice_provider: "openai",
    });
    if (insertErr) console.error("[generate-dj-intro] insert failed:", insertErr);

    const signed = await withSignedUrls(supabase, lines);
    return json({
      intro: {
        lines: signed,
        signoffUrl: SIGNOFF_URL,
        durationMs: totalMs,
        cached: false,
      },
    });
  } catch (err) {
    console.error("[generate-dj-intro] error:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

// ── Helpers ─────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SetlistForIntro {
  id: string;
  title: string;
  description: string | null;
  era_id: string | null;
  era_name: string | null;
  slots: Array<{
    set_number: number;
    position: number;
    segue_to_next: boolean;
    song_title: string;
    song_id: string;
  }>;
}

async function loadSetlistForIntro(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  setlistId: string,
): Promise<SetlistForIntro | null> {
  const { data: sl } = await supabase
    .from("setlists")
    .select("id, title, description, era_id, eras(name)")
    .eq("id", setlistId)
    .maybeSingle();
  if (!sl) return null;

  const { data: slotRows } = await supabase
    .from("setlist_slots")
    .select("set_number, position, segue_to_next, song_id, songs(title)")
    .eq("setlist_id", setlistId)
    .order("set_number")
    .order("position");

  const slots = (slotRows ?? []).map((r: any) => ({
    set_number: r.set_number,
    position: r.position,
    segue_to_next: !!r.segue_to_next,
    song_id: r.song_id,
    song_title: r.songs?.title ?? "Unknown",
  }));

  return {
    id: sl.id,
    title: sl.title,
    description: sl.description,
    era_id: sl.era_id,
    era_name: sl.eras?.name ?? null,
    slots,
  };
}

// Deterministic hash of the intro-relevant fields. Same fields as
// src/lib/introSourceHash.ts on the client — keep in sync.
async function computeIntroSourceHash(sl: SetlistForIntro): Promise<string> {
  const canonical = JSON.stringify({
    title: sl.title.trim(),
    era_id: sl.era_id ?? null,
    description: (sl.description ?? "").trim(),
    slots: sl.slots.map((s) => ({
      set: s.set_number,
      pos: s.position,
      seg: s.segue_to_next,
      song: s.song_id,
    })),
  });
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16); // 16 hex chars is plenty of entropy for this scope
}

// ── LLM: write the duet script ──────────────────────────────────────

async function generateScript(sl: SetlistForIntro): Promise<{ script: ScriptLine[] }> {
  const userPrompt = buildUserPrompt(sl);

  // Lovable AI gateway is OpenAI-compatible for chat completions.
  // URL + model chosen to match the existing ai-deadhead function which is
  // known-working through this gateway. Do NOT pass response_format —
  // Lovable's gateway doesn't reliably pass it through and the system prompt
  // already tells the model to emit JSON.
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM call failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "{}";
  // Some models wrap JSON in markdown code fences — strip them if present.
  const stripped = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(stripped) as { script?: ScriptLine[] };

  const script = parsed.script ?? [];
  validateScript(script);
  return { script };
}

function buildUserPrompt(sl: SetlistForIntro): string {
  const setlistBlock = {
    title: sl.title,
    era: sl.era_name,
    description: sl.description,
    songs: sl.slots.map((s) => ({
      title: s.song_title,
      set: s.set_number,
      position: s.position,
      segueToNext: s.segue_to_next,
    })),
  };
  return `Write the duet intro for this setlist. Follow the format spec exactly — return JSON with a "script" array. The last three entries must be Charlie:"Wake." / Cherise:"Now." / both:"Discover." verbatim.

Setlist:
\`\`\`json
${JSON.stringify(setlistBlock, null, 2)}
\`\`\``;
}

function validateScript(script: ScriptLine[]) {
  if (!Array.isArray(script) || script.length < 6) {
    throw new Error(`script too short (${script?.length} lines)`);
  }
  const tail = script.slice(-3);
  const ok =
    tail[0]?.speaker === "charlie" &&
    tail[0]?.text?.trim() === "Wake." &&
    tail[1]?.speaker === "cherise" &&
    tail[1]?.text?.trim() === "Now." &&
    tail[2]?.speaker === "both" &&
    tail[2]?.text?.trim() === "Discover.";
  if (!ok) {
    throw new Error(
      `script tail does not match required signoff (got: ${JSON.stringify(tail)})`,
    );
  }

  // Fourth-wall safety check
  const forbidden = /\b(AI|algorithm|generate|model|prompt|as an AI|language model)\b/i;
  for (const line of script) {
    if (forbidden.test(line.text)) {
      throw new Error(`script contains forbidden word: ${line.text}`);
    }
  }
}

// ── TTS: synthesize each line and upload ────────────────────────────

const VOICE_FOR: Record<Exclude<Speaker, "both">, string> = {
  charlie: "onyx",
  cherise: "nova",
};

async function synthesizeLines(
  { script }: { script: ScriptLine[] },
  setlistId: string,
  hash: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<IntroLine[]> {
  // Skip the final "both" signoff — that's the fixed asset.
  const spoken = script.slice(0, -1);

  // Parallel TTS + upload
  const results = await Promise.all(
    spoken.map(async (line, idx) => {
      if (line.speaker === "both") {
        // Shouldn't happen mid-script per the spec, but guard defensively.
        return null;
      }
      const voice = VOICE_FOR[line.speaker as "charlie" | "cherise"];
      const mp3 = await ttsSpeak(line.text, voice);
      const path = `${setlistId}/${hash}/line-${String(idx).padStart(3, "0")}-${line.speaker}.mp3`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, mp3, { contentType: "audio/mpeg", upsert: true });
      if (upErr) throw new Error(`upload failed for ${path}: ${upErr.message}`);
      return {
        speaker: line.speaker as Speaker,
        path,
        duration_ms: estimateDurationMs(line.text),
      };
    }),
  );

  return results.filter(Boolean) as IntroLine[];
}

async function ttsSpeak(text: string, voice: string): Promise<Uint8Array> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice,
      input: text,
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`TTS failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

// Rough estimate — 165 words per minute of natural speech, ~5 chars/word.
// Used for progress UI / total duration; not for scheduling (audio element
// tells us actual duration on load).
function estimateDurationMs(text: string): number {
  const words = Math.max(1, text.trim().split(/\s+/).length);
  return Math.round((words / 165) * 60 * 1000);
}

// The `dj-intros` bucket is PRIVATE (workspace policy). Access is via
// short-lived signed URLs generated fresh per response. 1-hour expiry is
// generous — browsers download the entire MP3 up-front when playback
// starts, so even a paused-and-resumed session usually plays from
// already-buffered bytes rather than re-fetching. Signing all paths in
// one call keeps the response-time cost trivial.
const SIGNED_URL_EXPIRES_SECONDS = 60 * 60;

async function withSignedUrls(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  lines: IntroLine[],
): Promise<Array<IntroLine & { url: string }>> {
  if (lines.length === 0) return [];
  const paths = lines.map((l) => l.path);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_EXPIRES_SECONDS);
  if (error || !data) {
    throw new Error(`failed to sign intro urls: ${error?.message ?? "no data"}`);
  }
  // createSignedUrls returns results in the same order as the input paths.
  return lines.map((l, i) => ({
    ...l,
    url: (data[i] as { signedUrl: string }).signedUrl,
  }));
}
