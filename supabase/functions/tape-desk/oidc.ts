/**
 * Verify a GitHub Actions OIDC token (RS256) against GitHub's published keys,
 * then its claims (logic.ts checkClaims).
 *
 * Why OIDC and not a shared secret: a secret would have to be created by the
 * owner and pasted into two places, GitHub and Lovable Cloud, and kept in
 * step. GitHub already signs a token for every workflow run that asks for one,
 * naming the repository, the workflow file and the branch, so the function can
 * check exactly which run is calling, and nothing has to be stored anywhere.
 *
 * WebCrypto only, so Deno and Vitest run the same code.
 */
import { checkClaims, type OidcClaims } from "./logic.ts";

export const GITHUB_JWKS_URL = "https://token.actions.githubusercontent.com/.well-known/jwks";

export interface Jwk {
  kid?: string;
  kty: string;
  n?: string;
  e?: string;
  alg?: string;
}

// A plain ArrayBuffer: WebCrypto and TextDecoder both take one, and it types
// the same under every TypeScript. `Uint8Array<ArrayBuffer>` is what TS 5.7+
// wants for BufferSource, and older TS (Deno 2.1's) rejects it as "not generic".
const b64urlToBytes = (s: string): ArrayBuffer => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return buf;
};
const b64urlJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

export type OidcResult = { ok: true; claims: OidcClaims } | { ok: false; why: string };

export async function verifyGithubOidc(
  authHeader: string | null,
  deps: { jwks: () => Promise<Jwk[]>; nowSec: number },
): Promise<OidcResult> {
  const token = authHeader?.match(/^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/)?.[1];
  if (!token) return { ok: false, why: "no bearer" };
  const [h, p, s] = token.split(".");
  let header: { alg?: string; kid?: string };
  let claims: OidcClaims;
  try {
    header = b64urlJson(h);
    claims = b64urlJson(p);
  } catch {
    return { ok: false, why: "unreadable" };
  }
  // Pin the algorithm: never let the token choose "none" or an HMAC.
  if (header.alg !== "RS256") return { ok: false, why: "alg" };
  let keys: Jwk[];
  try {
    keys = await deps.jwks();
  } catch {
    return { ok: false, why: "keys unavailable" };
  }
  const jwk = keys.find((k) => k.kty === "RSA" && k.kid === header.kid);
  if (!jwk?.n || !jwk.e) return { ok: false, why: "unknown key" };
  let valid = false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToBytes(s),
      new TextEncoder().encode(`${h}.${p}`),
    );
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, why: "signature" };
  const c = checkClaims(claims, deps.nowSec);
  // `in`, not `c.ok ?`: the app's tsconfig is not strict, so a boolean
  // discriminant does not narrow there.
  return "why" in c ? { ok: false, why: c.why } : { ok: true, claims };
}
