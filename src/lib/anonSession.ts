// Anonymous session management for draft setlists.
// The session id is the secret used by RLS to authorize draft access via
// the `x-anon-session-id` request header.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const STORAGE_KEY = "ds_anon_session_id";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (RFC4122 v4)
  const bytes = new Uint8Array(16);
  (crypto || (globalThis as any).msCrypto).getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Get (or create) the persistent anonymous session id stored in localStorage. */
export function getAnonSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(STORAGE_KEY) ?? "";
  if (!UUID_RE.test(id)) {
    id = generateUuid();
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/** Clear the anon session (call after a successful draft transfer on signup). */
export function clearAnonSessionId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

let cachedClient: ReturnType<typeof createClient<Database>> | null = null;
let cachedFor: string | null = null;

/**
 * Returns a Supabase client that sends `x-anon-session-id` on every request,
 * allowing the draft_setlists RLS policies to authorize the row.
 *
 * Use this client ONLY for `draft_setlists` reads/writes. For everything else,
 * keep using the default `supabase` client from `@/integrations/supabase/client`.
 */
export function getAnonDraftClient() {
  const sessionId = getAnonSessionId();
  if (cachedClient && cachedFor === sessionId) return cachedClient;

  cachedClient = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        // Drafts are anonymous; do not interfere with the main auth session.
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          "x-anon-session-id": sessionId,
        },
      },
    },
  );
  cachedFor = sessionId;
  return cachedClient;
}
