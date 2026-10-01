import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isObjectionable, OBJECTIONABLE_MESSAGE } from "@/lib/contentFilter";
import { toast } from "sonner";

/**
 * Run the objectionable-language filter over what a fan is about to post.
 * Returns true when it is clean; otherwise says why and returns false. The
 * database triggers enforce the same list, so this is the friendly half —
 * it stops the post before a bare error can.
 */
export const passesContentFilter = (...texts: Array<string | null | undefined>): boolean => {
  if (texts.some(isObjectionable)) {
    toast.error(OBJECTIONABLE_MESSAGE);
    return false;
  }
  return true;
};

// content_reports / blocked_users are newer than the generated Database
// types — regenerate src/integrations/supabase/types.ts via the Supabase
// CLI to drop this cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type ReportContentType = "setlist" | "comment" | "message" | "profile";

/** File a report against a piece of content. Returns true on success. */
export const submitReport = async (
  contentType: ReportContentType,
  contentId: string,
  reason?: string,
): Promise<boolean> => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    toast.error("Sign in to report content");
    return false;
  }
  const { error } = await db.from("content_reports").insert({
    reporter_id: user.id,
    content_type: contentType,
    content_id: contentId,
    reason: reason?.trim() || null,
  });
  if (error) {
    console.error("[moderation] report failed:", error);
    toast.error("Couldn't send the report — try again");
    return false;
  }
  toast.success("Reported. We'll take a look.");
  return true;
};

/**
 * The current user's block list, plus block/unblock actions.
 *
 * A block does three things, which is what App Store guideline 1.2 asks of it:
 * - the blocked user's setlists and comments disappear from every feed — RLS
 *   hides them server-side, and every cached query is refetched so nothing
 *   stale lingers on screen;
 * - they can no longer message the blocker (RLS on direct_messages);
 * - the team is notified: a trigger files a report on the blocked account,
 *   which emails the admins and lands in the moderation queue.
 */
export const useBlockedUsers = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    if (!user) {
      setBlockedIds(new Set());
      return;
    }
    const { data } = await db
      .from("blocked_users")
      .select("blocked_id")
      .eq("blocker_id", user.id);
    setBlockedIds(new Set((data ?? []).map((r: { blocked_id: string }) => r.blocked_id)));
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const block = useCallback(
    async (userId: string) => {
      if (!user) {
        toast.error("Sign in to block users");
        return false;
      }
      const { error } = await db
        .from("blocked_users")
        .upsert({ blocker_id: user.id, blocked_id: userId });
      if (error) {
        toast.error("Couldn't block this user");
        return false;
      }
      setBlockedIds((prev) => new Set(prev).add(userId));
      void queryClient.invalidateQueries();
      toast.success("Blocked. Their setlists and comments are gone from your view, they can't message you, and we'll review their content.");
      return true;
    },
    [user, queryClient],
  );

  const unblock = useCallback(
    async (userId: string) => {
      if (!user) return false;
      const { error } = await db
        .from("blocked_users")
        .delete()
        .eq("blocker_id", user.id)
        .eq("blocked_id", userId);
      if (error) {
        toast.error("Couldn't unblock this user");
        return false;
      }
      setBlockedIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      void queryClient.invalidateQueries();
      toast.success("Unblocked");
      return true;
    },
    [user, queryClient],
  );

  return { blockedIds, block, unblock, reload };
};
