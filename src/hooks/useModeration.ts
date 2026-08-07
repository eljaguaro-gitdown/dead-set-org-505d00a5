import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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

/** The current user's block list, plus block/unblock actions. */
export const useBlockedUsers = () => {
  const { user } = useAuth();
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
      toast.success("Blocked. You won't see them, they can't message you.");
      return true;
    },
    [user],
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
      toast.success("Unblocked");
      return true;
    },
    [user],
  );

  return { blockedIds, block, unblock, reload };
};
