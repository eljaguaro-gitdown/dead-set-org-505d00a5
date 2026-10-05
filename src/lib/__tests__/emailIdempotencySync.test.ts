import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The signup emails are fired from THREE independent producers on purpose, so
 * that one failing path cannot leave a new Deadhead with no welcome:
 *
 *   1. the `handle_new_user_emails` trigger on auth.users (SQL, covers every provider)
 *   2. the `useAuth` client backfill        (src/hooks/useAuth.ts)
 *   3. the email-signup path               (src/components/AuthModal.tsx)
 *
 * Exactly one of them may actually send, and the thing that arbitrates is the
 * idempotency key: `claim_email_idempotency` lets a given key through once.
 *
 * That makes the key format a SHARED FORMAT with three copies — the same shape
 * as the `encodeArchiveNotes` duplicate and the two player bars. If one
 * producer drifts to `welcome_<id>` or `Welcome-<id>`, dedupe silently stops
 * working and the duplicates come back with no error anywhere. Nothing else in
 * the suite can see that, because each producer is independently "correct".
 *
 * So: assert the producers AGREE, not that any one of them works.
 */

const REPO = join(__dirname, "..", "..", "..");

/** `'welcome-' || NEW.id::text` -> `welcome-{}` */
const canonicalizeSql = (expr: string): string =>
  expr
    .split("||")
    .map((part) => {
      const t = part.trim();
      const literal = t.match(/^'((?:[^']|'')*)'$/);
      return literal ? literal[1].replace(/''/g, "'") : "{}";
    })
    .join("");

/** `` `welcome-${session.user.id}` `` -> `welcome-{}` */
const canonicalizeTs = (tpl: string): string =>
  tpl.replace(/\$\{[^}]*\}/g, "{}");

/** Newest migration that (re)defines the trigger function. */
const newestTriggerMigration = (): string => {
  const dir = join(REPO, "supabase", "migrations");
  const hits = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) =>
      readFileSync(join(dir, f), "utf8").includes(
        "FUNCTION public.handle_new_user_emails",
      ),
    )
    .sort();
  expect(
    hits.length,
    "no migration defines handle_new_user_emails",
  ).toBeGreaterThan(0);
  return readFileSync(join(dir, hits[hits.length - 1]), "utf8");
};

const sqlKeys = (sql: string): string[] =>
  [...sql.matchAll(/'idempotencyKey',\s*([^\n]+?),?\s*$/gm)].map((m) =>
    canonicalizeSql(m[1].replace(/,\s*$/, "")),
  );

const tsKeys = (src: string): string[] =>
  [...src.matchAll(/idempotencyKey:\s*`([^`]*)`/g)].map((m) =>
    canonicalizeTs(m[1]),
  );

describe("signup email idempotency keys agree across all three producers", () => {
  const trigger = sqlKeys(newestTriggerMigration());
  const useAuth = tsKeys(
    readFileSync(join(REPO, "src", "hooks", "useAuth.ts"), "utf8"),
  );
  const authModal = tsKeys(
    readFileSync(join(REPO, "src", "components", "AuthModal.tsx"), "utf8"),
  );

  it("found keys in every producer (guards against a silently empty match)", () => {
    expect(trigger.length, "trigger migration").toBeGreaterThanOrEqual(2);
    expect(useAuth.length, "useAuth.ts").toBeGreaterThanOrEqual(2);
    expect(authModal.length, "AuthModal.tsx").toBeGreaterThanOrEqual(1);
  });

  it("the welcome-email key has one shape everywhere", () => {
    const welcome = (keys: string[]) => keys.filter((k) => k.includes("welcome"));
    const shapes = new Set([
      ...welcome(trigger),
      ...welcome(useAuth),
      ...welcome(authModal),
    ]);
    expect(welcome(trigger).length).toBeGreaterThan(0);
    expect(welcome(useAuth).length).toBeGreaterThan(0);
    expect(welcome(authModal).length).toBeGreaterThan(0);
    // One distinct shape across all three, or dedupe cannot match them.
    expect([...shapes]).toEqual(["welcome-{}"]);
  });

  it("the admin-notification key has one shape in both producers that send it", () => {
    const notify = (keys: string[]) => keys.filter((k) => k.includes("signup-notify"));
    const shapes = new Set([...notify(trigger), ...notify(useAuth)]);
    expect(notify(trigger).length).toBeGreaterThan(0);
    expect(notify(useAuth).length).toBeGreaterThan(0);
    // Keyed per admin address, so the shape carries two placeholders.
    expect([...shapes]).toEqual(["new-signup-notify-{}-{}"]);
  });
});

describe("the sender actually enforces the key it is handed", () => {
  const sender = readFileSync(
    join(REPO, "supabase", "functions", "send-transactional-email", "index.ts"),
    "utf8",
  );

  // Anchored to the actual rpc call, with the closing quote, on purpose.
  // A bare /claim_email_idempotency/ substring match is satisfied by a mere
  // mention in a comment AND by a rename to claim_email_idempotency_DISABLED
  // — both of which leave the gate doing nothing. Verified: the loose form
  // survived that exact mutation.
  const CLAIM_CALL = /supabase\s*\.\s*rpc\(\s*'claim_email_idempotency'/;

  it("claims the key by actually calling claim_email_idempotency", () => {
    // "Defined but never called" is its own class of bug: every producer
    // passed a key for four releases and nothing consumed one.
    expect(sender).toMatch(CLAIM_CALL);
  });

  it("claims BEFORE enqueueing, not after", () => {
    const claim = sender.search(CLAIM_CALL);
    const enqueue = sender.indexOf("'enqueue_email'");
    expect(claim, "claim_email_idempotency rpc call not found").toBeGreaterThan(-1);
    expect(enqueue, "enqueue_email not found").toBeGreaterThan(-1);
    // Claiming after the enqueue would dedupe nothing — the mail is already away.
    expect(claim).toBeLessThan(enqueue);
  });

  it("skips the send when the claim comes back already-held", () => {
    // Greping for the string only proves the string is present. The gate
    // changed `claimed === false` to `claimed === 'never'` — which can never be
    // true, so nothing is ever suppressed — and this test stayed green. Pin the
    // comparison, not the label.
    expect(sender).toMatch(/duplicate_suppressed/);
    expect(sender).toMatch(/claimed\s*===\s*false/);
  });

  it("hands the key back when the send does not happen", () => {
    // Claiming must precede the render and the enqueue or two paths could both
    // get through — but that means a render throw or an enqueue error leaves a
    // key claimed for a message nobody sent, and the redundant signup paths
    // then retry into duplicate_suppressed and lose the welcome email for good.
    expect(sender).toMatch(/releaseIdempotency/);
    const release = sender.indexOf("const releaseIdempotency");
    expect(release, "releaseIdempotency not defined").toBeGreaterThan(-1);
    // Both failure exits must hand the key back. Scoped to the enqueue-error
    // BLOCK, not merely "somewhere before it": searching the whole prefix found
    // the render path's release and stayed green when the enqueue one was
    // deleted. Verified by deleting exactly that line.
    const blockStart = sender.indexOf("if (enqueueError) {");
    expect(blockStart, "enqueue-error block not found").toBeGreaterThan(-1);
    // Anchor on the 500 RETURN, not the first mention of the phrase — it also
    // appears in the console.error and the log row two lines in, which made the
    // slice two lines long and the assertion vacuous.
    const enqueueReturn = sender.indexOf(
      "return new Response(JSON.stringify({ error: 'Failed to enqueue email' })",
      blockStart,
    );
    expect(enqueueReturn, "enqueue-error 500 return not found").toBeGreaterThan(-1);
    const enqueueBlock = sender.slice(blockStart, enqueueReturn);
    expect(
      enqueueBlock,
      "the enqueue-failure path does not release the idempotency key",
    ).toMatch(/await releaseIdempotency\(\)/);
    expect(sender).toMatch(/catch \(renderError\)[\s\S]{0,200}releaseIdempotency/);
  });
});
