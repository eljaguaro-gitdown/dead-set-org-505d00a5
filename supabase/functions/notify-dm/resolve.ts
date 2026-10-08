/**
 * What a "new message" email may say, decided from stored data (#114).
 *
 * notify-dm used to email any registered user whatever the caller sent:
 * `recipientUserId`, `senderName` and `messagePreview` all came from the
 * request, and nothing checked that the two people had ever talked. Now the
 * recipient must share a conversation with the caller, the caller must have
 * written in it in the last few minutes, and the preview and name come from
 * that stored message and the caller's profile. The request's own name and
 * preview are ignored.
 *
 * The email is keyed to the message, so each real message sends at most one
 * email per recipient, however many times this is called.
 *
 * Kept free of Deno APIs, with the lookups passed in, so the Vitest suite can
 * run it.
 */

/** How long after a message its notification may still be sent. */
export const DM_NOTIFY_WINDOW_MS = 10 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DmResolveDeps {
  /**
   * The conversations a user belongs to, by member row or as user_one/user_two,
   * limited to `within` when it is given.
   */
  conversationIdsOf: (userId: string, within?: string[]) => Promise<string[]>;
  /** The newest message `senderId` wrote in any of `conversationIds` since `sinceIso`. */
  latestMessageFrom: (
    senderId: string,
    conversationIds: string[],
    sinceIso: string,
  ) => Promise<{ id: string; content: string } | null>;
  /** The user's profile display name, if they have one. */
  displayName: (userId: string) => Promise<string | null>;
  now?: () => Date;
}

export type DmNotification =
  | { ok: true; senderName: string; messagePreview: string; idempotencyKey: string }
  | { ok: false; status: 400 | 403; error: string };

export const resolveDmNotification = async (
  caller: { id: string; email?: string | null },
  recipientUserId: unknown,
  deps: DmResolveDeps,
): Promise<DmNotification> => {
  if (typeof recipientUserId !== "string" || !UUID.test(recipientUserId)) {
    return { ok: false, status: 400, error: "Invalid recipient" };
  }

  const mine = await deps.conversationIdsOf(caller.id);
  const theirs = mine.length === 0 ? [] : await deps.conversationIdsOf(recipientUserId, mine);
  // Intersected here as well, so a lookup that ignored `within` still cannot
  // widen who may be emailed.
  const shared = theirs.filter((id) => mine.includes(id));
  if (shared.length === 0) return { ok: false, status: 403, error: "No conversation with this recipient" };

  const now = deps.now ? deps.now() : new Date();
  const since = new Date(now.getTime() - DM_NOTIFY_WINDOW_MS).toISOString();
  const message = await deps.latestMessageFrom(caller.id, shared, since);
  if (!message) return { ok: false, status: 403, error: "No recent message to this recipient" };

  const senderName = (await deps.displayName(caller.id)) || caller.email?.split("@")[0] || "A Deadhead";
  return {
    ok: true,
    senderName,
    messagePreview: message.content.slice(0, 200),
    idempotencyKey: `dm-notify-${message.id}-${recipientUserId}`,
  };
};
