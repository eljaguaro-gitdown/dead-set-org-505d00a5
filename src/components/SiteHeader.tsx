import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Shield, MessageCircle, LogOut, User, Download } from "lucide-react";
import { motion } from "framer-motion";
import StealYourFace from "@/components/StealYourFace";
import ShareAppButton from "@/components/ShareAppButton";
import AnnouncementsBell from "@/components/AnnouncementsBell";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetTitle,
} from "@/components/ui/sheet";

interface SiteHeaderProps {
  children?: React.ReactNode;
  large?: boolean;
}

const SiteHeader = ({ children, large = false }: SiteHeaderProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();
  const { playingSlot, playlistMode, playlistIndex, playlistSlots, activeSetlistId } = useAudioPlayer();
  const [isAdmin, setIsAdmin] = useState(false);
  const { unreadCount } = useUnreadMessages(user);
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const adminLink = isAdmin ? (
    <button
      onClick={() => navigate("/admin")}
      className="flex items-center gap-1.5 text-xs font-mono text-primary/80 hover:text-primary transition-colors tracking-wider uppercase"
      title="Admin Dashboard"
    >
      <Shield className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Admin</span>
    </button>
  ) : null;

  const messagesLink = user ? (
    <button
      onClick={() => navigate("/messages")}
      className="relative flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase"
      title="Messages"
    >
      <MessageCircle className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Messages</span>
      {unreadCount > 0 && (
        <>
          <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-mono flex items-center justify-center z-10">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
          <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-primary animate-ping opacity-75" />
        </>
      )}
    </button>
  ) : null;

  const nowPlaying = playingSlot ? (
    <motion.button
      type="button"
      onClick={() => activeSetlistId && navigate(`/setlist/${activeSetlistId}`)}
      disabled={!activeSetlistId}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 max-w-[180px] sm:max-w-[220px] hover:bg-primary/20 hover:border-primary/40 transition-colors disabled:cursor-default disabled:hover:bg-primary/10 disabled:hover:border-primary/20"
      title={activeSetlistId ? "Open setlist" : "Now playing"}
      aria-label={activeSetlistId ? `Open setlist for ${playingSlot.song.title}` : `Now playing: ${playingSlot.song.title}`}
    >
      {/* Animated equalizer bars */}
      <div className="flex items-end gap-[2px] h-3 shrink-0">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-[2px] bg-primary rounded-full"
            animate={{ height: ["4px", "12px", "6px", "10px", "4px"] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
          />
        ))}
      </div>
      <span className="text-[10px] sm:text-xs font-body text-foreground truncate">
        {playingSlot.song.title}
      </span>
      {playlistMode && (
        <span className="text-[9px] font-mono text-muted-foreground tabular-nums shrink-0">
          {playlistIndex + 1}/{playlistSlots.length}
        </span>
      )}
    </motion.button>
  ) : null;

  const isRepeatVisitor = typeof window !== "undefined" && !!localStorage.getItem("dead_set_visited");

  useEffect(() => {
    localStorage.setItem("dead_set_visited", "1");
  }, []);

  return (
    <header className="border-b border-border/50 px-6 sm:px-12 py-4 sm:py-5 flex items-center justify-between">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-3 sm:gap-4 group"
      >
        <StealYourFace size={large ? (isMobile ? 36 : 48) : (isMobile ? 28 : 40)} />
        <span
          className={`font-display text-foreground tracking-tight transition-colors group-hover:text-primary ${
            large ? "text-xl sm:text-2xl md:text-3xl" : "text-lg sm:text-xl md:text-2xl"
          }`}
        >
          Dead-Set.Org
        </span>
      </button>
      {(children || adminLink || messagesLink || nowPlaying) && (
        <>
          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-4 sm:gap-6">
            {nowPlaying}
            <ShareAppButton />
            {user && <AnnouncementsBell variant="desktop" />}
            {messagesLink}
            {adminLink}
            {children}
            {user && (
              <button
                onClick={async () => { await signOut(); navigate("/"); }}
                className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
          {/* Mobile: persistent top-level actions + hamburger */}
          <div className="sm:hidden flex items-center gap-3">
            {/* Persistent mobile: Announcements + Messages for logged-in, Sign In for repeat guests */}
            {user ? (
              <>
                <AnnouncementsBell variant="mobile" />
                <button
                  onClick={() => navigate("/messages")}
                  className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
                  title="Messages"
                >
                  <MessageCircle className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <>
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-mono flex items-center justify-center z-10">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary animate-ping opacity-75" />
                    </>
                  )}
                </button>
              </>
            ) : isRepeatVisitor ? (
              <button
                onClick={() => navigate("/auth")}
                className="font-mono text-[10px] tracking-[0.15em] text-primary border border-primary/40 rounded-md px-3 py-1.5 hover:bg-primary/10 transition-colors uppercase"
              >
                Sign In
              </button>
            ) : null}
            <Sheet>
              <SheetTrigger asChild>
                <button className="p-2 text-foreground" aria-label="Open menu">
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] bg-background border-border p-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <nav className="flex flex-col gap-1 p-5 pt-14">
                  {nowPlaying && <div className="mb-2">{nowPlaying}</div>}
                  {React.Children.map(children, (child) =>
                    child ? (
                      <SheetClose asChild>
                        <div className="min-h-[44px] flex items-center">{child}</div>
                      </SheetClose>
                    ) : null
                  )}
                  <div className="h-px bg-border/40 my-2" />
                  {messagesLink && (
                    <SheetClose asChild>
                      <div className="min-h-[44px] flex items-center">{messagesLink}</div>
                    </SheetClose>
                  )}
                  {adminLink && (
                    <SheetClose asChild>
                      <div className="min-h-[44px] flex items-center">{adminLink}</div>
                    </SheetClose>
                  )}
                  {!window.matchMedia("(display-mode: standalone)").matches && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && (
                    <SheetClose asChild>
                      <button
                        onClick={() => {
                          const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
                          if (standalone) return;
                          // Try native prompt if available
                          const evt = (window as any).__pwaInstallPrompt;
                          if (evt) {
                            evt.prompt();
                          } else if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                            alert('Tap the Share button (square with arrow) then "Add to Home Screen"');
                          } else {
                            alert('Tap the browser menu (⋮) then "Add to Home Screen"');
                          }
                        }}
                        className="min-h-[44px] flex items-center gap-1.5 text-xs font-mono text-primary hover:text-primary/80 transition-colors tracking-wider uppercase"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Install App
                      </button>
                    </SheetClose>
                  )}
                  <SheetClose asChild>
                    <div className="min-h-[44px] flex items-center">
                      <ShareAppButton variant="full" className="w-full justify-start" />
                    </div>
                  </SheetClose>
                  {user && (
                    <>
                      <div className="h-px bg-border/40 my-2" />
                      <SheetClose asChild>
                        <button
                          onClick={() => navigate("/profile")}
                          className="min-h-[44px] flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase"
                        >
                          <User className="w-3.5 h-3.5" />
                          Profile
                        </button>
                      </SheetClose>
                      <SheetClose asChild>
                        <button
                          onClick={async () => { await signOut(); navigate("/"); }}
                          className="min-h-[44px] flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Sign Out
                        </button>
                      </SheetClose>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </>
      )}
    </header>
  );
};

export default SiteHeader;
