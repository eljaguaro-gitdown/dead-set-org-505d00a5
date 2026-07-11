import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, ExternalLink, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useCommentNotifications } from "@/hooks/useCommentNotifications";
import { useAuth } from "@/hooks/useAuth";
import { trackCtaClick } from "@/lib/trackCtaClick";

interface AnnouncementsBellProps {
  variant?: "desktop" | "mobile";
}

const AnnouncementsBell = ({ variant = "desktop" }: AnnouncementsBellProps) => {
  const { user } = useAuth();
  const { announcements, readIds, unreadCount: annUnread, markAllRead: markAnnRead } = useAnnouncements(user);
  const {
    notifications: commentNotifs,
    unreadCount: commentUnread,
    markAllRead: markCommentsRead,
  } = useCommentNotifications(user);
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const unreadCount = annUnread + commentUnread;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && unreadCount > 0) {
      setTimeout(() => {
        markAnnRead();
        markCommentsRead();
      }, 800);
    }
  };

  const isMobile = variant === "mobile";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        {isMobile ? (
          <button
            className="relative p-2 text-foreground/75 hover:text-foreground transition-colors"
            title="Announcements"
            aria-label="Announcements"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <>
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-mono flex items-center justify-center z-10">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary animate-ping opacity-75" />
              </>
            )}
          </button>
        ) : (
          <button
            className="relative flex items-center gap-1.5 text-xs font-mono text-foreground/75 hover:text-foreground transition-colors tracking-wider uppercase"
            title="Announcements"
            aria-label="Announcements"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <>
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-mono flex items-center justify-center z-10">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-primary animate-ping opacity-75" />
              </>
            )}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[340px] sm:w-[380px] p-0 bg-card border-border max-h-[70vh] overflow-hidden flex flex-col"
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-display text-sm text-card-foreground">From Grateful Jaguaro</h3>
          {unreadCount > 0 && (
            <span className="font-mono text-[10px] text-accent-foreground tracking-wider uppercase">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Comment notifications */}
          {commentNotifs.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-muted/20 border-b border-border/40 flex items-center gap-2">
                <MessageCircle className="w-3.5 h-3.5 text-primary/70" />
                <span className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase">
                  Notes on your setlists
                </span>
                {commentUnread > 0 && (
                  <span className="font-mono text-[10px] text-accent-foreground tracking-wider uppercase ml-auto">
                    {commentUnread} new
                  </span>
                )}
              </div>
              <ul className="divide-y divide-border/40">
                {commentNotifs.slice(0, 10).map((n) => (
                  <li
                    key={n.id}
                    className={`px-4 py-3 ${!n.read ? "bg-primary/[0.04]" : ""}`}
                  >
                    <Link
                      to={`/setlist/${n.setlist_id}`}
                      onClick={() => {
                        trackCtaClick(`comment_notif:${n.id}`, `/setlist/${n.setlist_id}`);
                        setOpen(false);
                      }}
                      className="flex items-start gap-2 group"
                    >
                      {!n.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm text-card-foreground leading-snug group-hover:text-primary transition-colors">
                          {n.commenter_name || "A Deadhead"} on{" "}
                          <span className="text-accent-foreground">
                            {n.setlist_title || "your setlist"}
                          </span>
                        </h4>
                        {n.preview && (
                          <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-2">
                            "{n.preview}"
                          </p>
                        )}
                        <p className="font-mono text-[10px] text-muted-foreground mt-2 tracking-wider uppercase">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Announcements section */}
          {announcements.length === 0 && commentNotifs.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="font-body text-sm text-muted-foreground">
                No notifications yet.
              </p>
              <p className="font-body text-xs text-muted-foreground mt-1">
                The music never stops — check back soon.
              </p>
            </div>
          ) : announcements.length > 0 ? (
            <>
              {commentNotifs.length > 0 && (
                <div className="px-4 py-2 bg-muted/20 border-b border-t border-border/40 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase">
                    From Grateful Jaguaro
                  </span>
                </div>
              )}
              <ul className="divide-y divide-border/40">
                {announcements.map((a) => {
                  const isUnread = !readIds.has(a.id);
                  return (
                    <li
                      key={a.id}
                      className={`px-4 py-3 ${isUnread ? "bg-primary/[0.04]" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        {isUnread && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0"
                            aria-label="Unread"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <h4 className="font-display text-sm text-card-foreground leading-snug">
                            {a.title}
                          </h4>
                          <p className="font-body text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                            {a.body}
                          </p>
                          {a.cta_url && a.cta_label && (
                            <a
                              href={a.cta_url}
                              target={a.cta_url.startsWith("http") ? "_blank" : undefined}
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 font-mono text-[11px] text-accent-foreground hover:text-accent-foreground/80 tracking-wider uppercase"
                              onClick={() => {
                                trackCtaClick(`announcement:${a.id}`, a.cta_url!);
                                setOpen(false);
                              }}
                            >
                              {a.cta_label}
                              {a.cta_url.startsWith("http") && (
                                <ExternalLink className="w-3 h-3" />
                              )}
                            </a>
                          )}
                          <p className="font-mono text-[10px] text-muted-foreground mt-2 tracking-wider uppercase">
                            {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AnnouncementsBell;
