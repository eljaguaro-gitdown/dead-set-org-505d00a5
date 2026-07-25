#!/usr/bin/env node
/*
 * generate-signoff.mjs
 *
 * Generates the POC seed for the DJ Cosmic Charlie & Cherise signoff
 * clip — "Wake." / "Now." / "Discover." — and drops it at
 * public/audio/signoff.mp3.
 *
 * This is a REFERENCE recording, not production audio. The final
 * signoff will be re-recorded with real humans (see
 * docs/features/dj-cosmic-charlie.md §8.5 → "POC seeding strategy").
 * Same file path, so swap-in is a single file replacement — no code
 * change.
 *
 * Usage:
 *   export OPENAI_API_KEY=sk-...
 *   node scripts/generate-signoff.mjs
 *
 * What it produces:
 *   public/audio/signoff.mp3                       ← final concatenated clip
 *   public/audio/signoff-parts/wake-charlie.mp3    ← individual takes
 *   public/audio/signoff-parts/now-cherise.mp3
 *   public/audio/signoff-parts/discover-charlie.mp3
 *   public/audio/signoff-parts/discover-cherise.mp3
 *
 * The "both" line on "Discover." — for the POC seed we use just
 * Charlie's take in the concatenated file (single voice). When the
 * human recording is made, the real duet replaces the file.
 *
 * Cost: ~$0.0002 per run at OpenAI TTS pricing. Basically free.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const OUT_DIR = join(REPO_ROOT, "public", "audio");
const PARTS_DIR = join(OUT_DIR, "signoff-parts");

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error("ERROR: OPENAI_API_KEY environment variable is not set.");
  console.error("Run:  export OPENAI_API_KEY=sk-...  (or the equivalent on your shell)");
  console.error("Then re-run this script.");
  process.exit(1);
}

// Voices per character (matches supabase/functions/generate-dj-intro/index.ts)
const CHARLIE_VOICE = "onyx"; // deep, warm, resonant
const CHERISE_VOICE = "nova"; // bright, friendly, present

// The three signoff clips we need
const CLIPS = [
  { name: "wake-charlie",     voice: CHARLIE_VOICE, text: "Wake." },
  { name: "now-cherise",      voice: CHERISE_VOICE, text: "Now." },
  { name: "discover-charlie", voice: CHARLIE_VOICE, text: "Discover." },
  { name: "discover-cherise", voice: CHERISE_VOICE, text: "Discover." },
];

async function tts(text, voice) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
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
    throw new Error(`TTS failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });
  if (!existsSync(PARTS_DIR)) await mkdir(PARTS_DIR, { recursive: true });

  console.log("Generating signoff clips via OpenAI TTS...");
  const generated = {};
  for (const clip of CLIPS) {
    process.stdout.write(`  ${clip.name} (${clip.voice}): "${clip.text}"... `);
    const bytes = await tts(clip.text, clip.voice);
    const path = join(PARTS_DIR, `${clip.name}.mp3`);
    await writeFile(path, bytes);
    generated[clip.name] = bytes;
    console.log(`✓ ${(bytes.length / 1024).toFixed(1)} KB`);
  }

  // Concatenate into the final signoff clip.
  // Order: Wake (Charlie) → Now (Cherise) → Discover (Charlie).
  // For POC seed we use only Charlie's "Discover" — the final human
  // recording will be an actual two-voice duet at the same file path.
  //
  // Raw MP3 concatenation via byte-wise append works when all clips
  // share the same codec/bitrate settings, which OpenAI TTS guarantees.
  // Tiny audible seams may exist between clips; acceptable for a
  // reference recording.
  const concat = Buffer.concat([
    Buffer.from(generated["wake-charlie"]),
    Buffer.from(generated["now-cherise"]),
    Buffer.from(generated["discover-charlie"]),
  ]);
  const finalPath = join(OUT_DIR, "signoff.mp3");
  await writeFile(finalPath, concat);
  console.log(`\n✓ Wrote ${finalPath}`);
  console.log(`  Size: ${(concat.length / 1024).toFixed(1)} KB`);
  console.log(`  Total spend on this run: ~$0.0002\n`);
  console.log("Individual clips (for reference / re-mixing):");
  for (const clip of CLIPS) {
    console.log(`  ${join(PARTS_DIR, clip.name + ".mp3")}`);
  }
  console.log(`\nPlay it: open ${finalPath} in any audio player.`);
  console.log(`\nUse this as the reference when you record the real Charlie + Cherise`);
  console.log(`signoff. Replace the file at the same path — no code change needed.`);
}

main().catch((err) => {
  console.error("\n❌", err.message);
  // Node's fetch surfaces low-level network errors as a plain
  // "fetch failed" — the real reason is inside err.cause. Unwrap it.
  if (err.cause) {
    console.error("   caused by:", err.cause.message || err.cause);
    if (err.cause.code) console.error("   code:", err.cause.code);
    if (err.cause.errno) console.error("   errno:", err.cause.errno);
  }
  process.exit(1);
});
