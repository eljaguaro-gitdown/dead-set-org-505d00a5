/**
 * What a "new comment" email may say, decided from stored data (#114).
 *
 * notify-comment used to email a setlist's owner whatever the caller sent:
 * nothing checked that `commentId` existed, belonged to `setlistId`, or was
 * written by the caller, and `commenterName` and `preview` came from the
 * request. Now the comment is loaded, must be on that setlist and written by
 * the caller, and the preview and name come from it and the caller's profile.
 * The request's own name and preview are ignored.
 *
 * The email was already keyed to the comment (`comment-notify-<id>`), so each
 * real comment sends at most one.
 *
 * Kept free of Deno APIs, with the lookups passed in, so the Vitest suite can
 * run it.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CommentResolveDeps {
  getComment: (commentId: string) => Promise<{ setlist_id: string; user_id: string; content: string } | null>;
  /** The user's profile display name, if they have one. */
  displayName: (userId: string) => Promise<string | null>;
}

export type CommentNotification =
  | { ok: true; commenterName: string; preview: string }
  | { ok: false; status: 400 | 403 | 404; error: string };

export const resolveCommentNotification = async (
  caller: { id: string; email?: string | null },
  setlistId: unknown,
  commentId: unknown,
  deps: CommentResolveDeps,
): Promise<CommentNotification> => {
  if (typeof setlistId !== "string" || !UUID.test(setlistId) || typeof commentId !== "string" || !UUID.test(commentId)) {
    return { ok: false, status: 400, error: "Invalid setlist or comment" };
  }

  const comment = await deps.getComment(commentId);
  if (!comment) return { ok: false, status: 404, error: "Comment not found" };
  if (comment.setlist_id !== setlistId || comment.user_id !== caller.id) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const commenterName = (await deps.displayName(caller.id)) || caller.email?.split("@")[0] || "A Deadhead";
  return { ok: true, commenterName, preview: comment.content.slice(0, 200) };
};
