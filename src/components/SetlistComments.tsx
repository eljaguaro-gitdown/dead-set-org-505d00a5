import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface SetlistCommentsProps {
  setlistId: string;
  isPublic: boolean;
}

const SetlistComments = ({ setlistId, isPublic }: SetlistCommentsProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from("setlist_comments")
      .select("id, content, created_at, user_id")
      .eq("setlist_id", setlistId)
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) {
      setComments([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set(data.map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.user_id, p])
    );

    setComments(
      data.map((c) => ({
        ...c,
        profile: profileMap.get(c.user_id) || { display_name: null, avatar_url: null },
      }))
    );
    setLoading(false);
  }, [setlistId]);

  useEffect(() => {
    if (isPublic) fetchComments();
    else setLoading(false);
  }, [isPublic, fetchComments]);

  useEffect(() => {
    if (!user) return;
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const handlePost = async () => {
    if (!user || !newComment.trim()) return;
    const trimmed = newComment.trim();
    if (trimmed.length > 500) {
      toast.error("Comment must be under 500 characters");
      return;
    }

    setPosting(true);
    const { error } = await supabase.from("setlist_comments").insert({
      setlist_id: setlistId,
      user_id: user.id,
      content: trimmed,
    });

    if (error) {
      toast.error("Couldn't post comment");
    } else {
      setNewComment("");
      await fetchComments();
    }
    setPosting(false);
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase
      .from("setlist_comments")
      .delete()
      .eq("id", commentId);
    if (error) {
      toast.error("Couldn't delete comment");
    } else {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  };

  if (!isPublic) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.5 }}
      className="mt-10 max-w-2xl mx-auto px-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-4 h-4 text-primary/60" />
        <h3 className="font-display text-sm tracking-[0.15em] text-muted-foreground uppercase">
          Community Notes
        </h3>
        {comments.length > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground/50 ml-1">
            ({comments.length})
          </span>
        )}
      </div>

      {/* Comment list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 bg-muted/20 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {comments.map((comment) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="group flex gap-3 p-3 rounded-lg bg-card/40 border border-border/30"
              >
                {/* Avatar */}
                <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
                  {comment.profile?.avatar_url ? (
                    <img
                      src={comment.profile.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-display text-primary/60">
                      {(comment.profile?.display_name || "?")[0].toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xs text-foreground/80 truncate">
                      {comment.profile?.display_name || "Unknown Head"}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/40">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="font-body text-sm text-foreground/70 mt-0.5 break-words">
                    {comment.content}
                  </p>
                </div>

                {/* Delete button for own comments or admin */}
                {user && (user.id === comment.user_id || isAdmin) && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground/40 hover:text-destructive"
                    title="Delete comment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {comments.length === 0 && !loading && (
            <p className="text-center text-xs font-body text-muted-foreground/40 py-6">
              No comments yet — be the first to drop a note.
            </p>
          )}
        </div>
      )}

      {/* Post input */}
      {user ? (
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handlePost()}
            placeholder="Drop a comment..."
            maxLength={500}
            className="flex-1 bg-card/60 border border-border/40 rounded-lg px-3 py-2.5 text-sm font-body text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 transition-colors"
          />
          <button
            onClick={handlePost}
            disabled={posting || !newComment.trim()}
            className="shrink-0 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <p className="mt-4 text-center text-xs font-body text-muted-foreground/40">
          <a href="/auth" className="text-primary/60 hover:text-primary transition-colors underline underline-offset-2">
            Sign in
          </a>{" "}
          to leave a comment
        </p>
      )}
    </motion.section>
  );
};

export default SetlistComments;
