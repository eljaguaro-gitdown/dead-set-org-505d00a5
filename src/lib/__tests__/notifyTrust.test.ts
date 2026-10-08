import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { DM_NOTIFY_WINDOW_MS, resolveDmNotification, type DmResolveDeps } from "../../../supabase/functions/notify-dm/resolve";
import { resolveCommentNotification, type CommentResolveDeps } from "../../../supabase/functions/notify-comment/resolve";

/**
 * notify-dm and notify-comment used to email any registered user whatever
 * the caller said: the recipient, sender name and preview of a "new message",
 * and the comment id, name and preview of a "new comment", all came from the
 * request (#114). These call the real decisions; the last block pins that the
 * two functions use them.
 */
const CALLER = { id: "11111111-1111-4111-8111-111111111111", email: "fan@example.com" };
const FRIEND = "22222222-2222-4222-8222-222222222222";
const STRANGER = "33333333-3333-4333-8333-333333333333";
const CONV = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-10-08T07:00:00.000Z");

const CALLER_ONLY_CONV = "99999999-9999-4999-8999-999999999999";
const FRIEND_ONLY_CONV = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/**
 * Conversations per user. It ignores `within` on purpose: the decision must
 * intersect the two lists itself, so a lookup that drops the filter cannot
 * widen who may be emailed.
 */
const membership: Record<string, string[]> = {
  [CALLER.id]: [CONV, CALLER_ONLY_CONV],
  [FRIEND]: [CONV, FRIEND_ONLY_CONV],
  [STRANGER]: [FRIEND_ONLY_CONV],
};

const dmDeps = (over: Partial<DmResolveDeps> = {}): DmResolveDeps => ({
  conversationIdsOf: vi.fn(async (userId: string) => membership[userId.toLowerCase()] ?? []),
  latestMessageFrom: vi.fn(async () => ({ id: "msg-1", content: "Hey Now, check out 5/8/77" })),
  displayName: vi.fn(async () => "Jolly Mon"),
  now: () => NOW,
  ...over,
});

describe("resolveDmNotification", () => {
  it("refuses a recipient that is not a user id, before any lookup", async () => {
    for (const bad of ["abc", `${FRIEND},user_two.eq.${STRANGER}`, `${FRIEND})`, "", 123, null, undefined, {}]) {
      const d = dmDeps();
      expect(await resolveDmNotification(CALLER, bad, d), String(bad)).toEqual({ ok: false, status: 400, error: "Invalid recipient" });
      expect(d.conversationIdsOf).not.toHaveBeenCalled();
    }
  });

  it("refuses someone the caller has no conversation with, even when both are in other conversations", async () => {
    const d = dmDeps();
    expect(await resolveDmNotification(CALLER, STRANGER, d)).toEqual({ ok: false, status: 403, error: "No conversation with this recipient" });
    expect(d.latestMessageFrom).not.toHaveBeenCalled();
  });

  it("looks up the caller's conversations, then the recipient's within them", async () => {
    const d = dmDeps();
    await resolveDmNotification(CALLER, FRIEND, d);
    expect(d.conversationIdsOf).toHaveBeenNthCalledWith(1, CALLER.id);
    expect(d.conversationIdsOf).toHaveBeenNthCalledWith(2, FRIEND, [CONV, CALLER_ONLY_CONV]);
  });

  it("only looks in conversations both belong to, whatever the lookup returns", async () => {
    const d = dmDeps();
    await resolveDmNotification(CALLER, FRIEND, d);
    expect(d.latestMessageFrom).toHaveBeenCalledWith(CALLER.id, [CONV], expect.any(String));
  });

  it("refuses when the caller is in no conversations at all, without asking about the recipient", async () => {
    const d = dmDeps({ conversationIdsOf: vi.fn(async (userId: string) => (userId === CALLER.id ? [] : [CONV])) });
    expect((await resolveDmNotification(CALLER, FRIEND, d)).ok).toBe(false);
    expect(d.conversationIdsOf).toHaveBeenCalledTimes(1);
  });

  it("refuses when the caller has written nothing there in the last ten minutes", async () => {
    const d = dmDeps({ latestMessageFrom: vi.fn(async () => null) });
    expect(await resolveDmNotification(CALLER, FRIEND, d)).toEqual({ ok: false, status: 403, error: "No recent message to this recipient" });
    expect(DM_NOTIFY_WINDOW_MS).toBe(10 * 60 * 1000);
    expect(d.latestMessageFrom).toHaveBeenCalledWith(CALLER.id, [CONV], "2026-10-08T06:50:00.000Z");
  });

  it("says what the stored message says, in the sender's profile name, keyed to that message", async () => {
    const d = dmDeps();
    expect(await resolveDmNotification(CALLER, FRIEND, d)).toEqual({
      ok: true,
      senderName: "Jolly Mon",
      messagePreview: "Hey Now, check out 5/8/77",
      idempotencyKey: `dm-notify-msg-1-${FRIEND}`,
    });
    expect(d.displayName).toHaveBeenCalledWith(CALLER.id);
  });

  it("cuts a long message to 200 characters", async () => {
    const d = dmDeps({ latestMessageFrom: vi.fn(async () => ({ id: "m", content: "x".repeat(500) })) });
    const r = await resolveDmNotification(CALLER, FRIEND, d);
    expect(r.ok && r.messagePreview).toBe("x".repeat(200));
  });

  it("falls back to the email name, then to 'A Deadhead'", async () => {
    const noName = dmDeps({ displayName: vi.fn(async () => null) });
    const a = await resolveDmNotification(CALLER, FRIEND, noName);
    expect(a.ok && a.senderName).toBe("fan");
    const b = await resolveDmNotification({ id: CALLER.id, email: null }, FRIEND, dmDeps({ displayName: vi.fn(async () => "") }));
    expect(b.ok && b.senderName).toBe("A Deadhead");
  });

  it("accepts an upper-case user id", async () => {
    const lettered = "abcdef12-abcd-4abc-8abc-abcdefabcdef";
    expect(lettered.toUpperCase()).not.toBe(lettered);
    const d = dmDeps({ conversationIdsOf: vi.fn(async () => [CONV]) });
    expect((await resolveDmNotification(CALLER, lettered.toUpperCase(), d)).ok).toBe(true);
  });
});

const SETLIST = "55555555-5555-4555-8555-555555555555";
const OTHER_SETLIST = "66666666-6666-4666-8666-666666666666";
const COMMENT = "77777777-7777-4777-8777-777777777777";

const commentDeps = (over: Partial<CommentResolveDeps> = {}): CommentResolveDeps => ({
  getComment: vi.fn(async (id: string) =>
    id === COMMENT ? { setlist_id: SETLIST, user_id: CALLER.id, content: "That Scarlet > Fire is the aha moment" } : null,
  ),
  displayName: vi.fn(async () => "Jolly Mon"),
  ...over,
});

describe("resolveCommentNotification", () => {
  it("refuses ids that are not ids, before any lookup", async () => {
    for (const [s, c] of [["x", COMMENT], [SETLIST, "y"], [SETLIST, null], [null, COMMENT], [SETLIST, `${COMMENT},x`]] as const) {
      const d = commentDeps();
      expect(await resolveCommentNotification(CALLER, s, c, d), `${s} ${c}`).toEqual({ ok: false, status: 400, error: "Invalid setlist or comment" });
      expect(d.getComment).not.toHaveBeenCalled();
    }
  });

  it("refuses a comment that does not exist", async () => {
    const missing = "88888888-8888-4888-8888-888888888888";
    expect(await resolveCommentNotification(CALLER, SETLIST, missing, commentDeps())).toEqual({ ok: false, status: 404, error: "Comment not found" });
  });

  it("refuses a comment on a different setlist", async () => {
    expect(await resolveCommentNotification(CALLER, OTHER_SETLIST, COMMENT, commentDeps())).toEqual({ ok: false, status: 403, error: "Forbidden" });
  });

  it("refuses a comment someone else wrote", async () => {
    const d = commentDeps({ getComment: vi.fn(async () => ({ setlist_id: SETLIST, user_id: STRANGER, content: "hi" })) });
    expect(await resolveCommentNotification(CALLER, SETLIST, COMMENT, d)).toEqual({ ok: false, status: 403, error: "Forbidden" });
  });

  it("says what the stored comment says, in the commenter's profile name", async () => {
    expect(await resolveCommentNotification(CALLER, SETLIST, COMMENT, commentDeps())).toEqual({
      ok: true,
      commenterName: "Jolly Mon",
      preview: "That Scarlet > Fire is the aha moment",
    });
  });

  it("cuts a long comment to 200 characters and falls back to the email name", async () => {
    const d = commentDeps({
      getComment: vi.fn(async () => ({ setlist_id: SETLIST, user_id: CALLER.id, content: "y".repeat(300) })),
      displayName: vi.fn(async () => null),
    });
    expect(await resolveCommentNotification(CALLER, SETLIST, COMMENT, d)).toEqual({ ok: true, commenterName: "fan", preview: "y".repeat(200) });
  });
});

// Comments are stripped, so a commented-out call does not count.
const source = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

describe("notify-dm uses the decision", () => {
  const src = source("supabase/functions/notify-dm/index.ts");
  const serve = src.slice(src.indexOf("Deno.serve("));

  it("decides before looking up the recipient or sending, and returns its refusal", () => {
    expect(src).toMatch(/import \{ resolveDmNotification \} from '\.\/resolve\.ts'/);
    const gate = serve.indexOf("await resolveDmNotification(caller, recipientUserId, {");
    expect(gate).toBeGreaterThan(-1);
    expect(serve.indexOf("auth.admin.getUserById(")).toBeGreaterThan(gate);
    expect(serve.indexOf("functions.invoke('send-transactional-email'")).toBeGreaterThan(gate);
    expect(serve).toMatch(/if \(!notice\.ok\) \{\s*return new Response\(JSON\.stringify\(\{ error: notice\.error \}\), \{\s*status: notice\.status,/);
  });

  it("sends the decided name, preview and key, and never the request's", () => {
    expect(serve).toMatch(/idempotencyKey: notice\.idempotencyKey,\s*templateData: \{\s*senderName: notice\.senderName,\s*messagePreview: notice\.messagePreview,\s*\}/);
    expect(serve).not.toMatch(/body\.(senderName|messagePreview)|\{ recipientUserId, senderName|Date\.now\(\)/);
  });

  it("finds a user's conversations by member rows and by user_one/user_two, within the given ones, with no string-built filter", () => {
    expect(serve).toMatch(
      /if \(within\) \{\s*members = members\.in\('conversation_id', within\)\s*asOne = asOne\.in\('id', within\)\s*asTwo = asTwo\.in\('id', within\)\s*\}/,
    );
    expect(serve).toMatch(/from\('conversation_members'\)\.select\('conversation_id'\)\.eq\('user_id', userId\)/);
    expect(serve).toMatch(/from\('conversations'\)\.select\('id'\)\.eq\('user_one', userId\)/);
    expect(serve).toMatch(/from\('conversations'\)\.select\('id'\)\.eq\('user_two', userId\)/);
    expect(serve).toMatch(/\.from\('direct_messages'\)\s*\.select\('id, content'\)\s*\.eq\('sender_id', senderId\)\s*\.in\('conversation_id', conversationIds\)\s*\.gte\('created_at', sinceIso\)\s*\.order\('created_at', \{ ascending: false \}\)/);
    expect(src).not.toMatch(/\.or\(/);
  });
});

describe("notify-comment uses the decision", () => {
  const src = source("supabase/functions/notify-comment/index.ts");
  const serve = src.slice(src.indexOf("Deno.serve("));

  it("decides before reading the setlist or sending, and returns its refusal", () => {
    expect(src).toMatch(/import \{ resolveCommentNotification \} from '\.\/resolve\.ts'/);
    const gate = serve.indexOf("await resolveCommentNotification(caller, setlistId, commentId, {");
    expect(gate).toBeGreaterThan(-1);
    expect(serve.indexOf(".from('setlists')")).toBeGreaterThan(gate);
    expect(serve.indexOf("functions.invoke('send-transactional-email'")).toBeGreaterThan(gate);
    expect(serve).toMatch(/if \(!notice\.ok\) \{\s*return new Response\(JSON\.stringify\(\{ error: notice\.error \}\), \{\s*status: notice\.status,/);
  });

  it("loads the comment by id and sends the decided name and preview", () => {
    expect(serve).toMatch(/\.from\('setlist_comments'\)\s*\.select\('setlist_id, user_id, content'\)\s*\.eq\('id', id\)/);
    expect(serve).toMatch(/commenterName: notice\.commenterName,/);
    expect(serve).toMatch(/preview: notice\.preview,/);
    expect(serve).not.toMatch(/body\.(commenterName|preview)|\{ setlistId, commentId, commenterName/);
  });
});
