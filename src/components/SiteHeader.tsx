import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Shield, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import StealYourFace from "@/components/StealYourFace";
import ShareAppButton from "@/components/ShareAppButton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
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
  const { user } = useAuth();
  const { playingSlot, playlistMode, playlistIndex, playlistSlots } = useAudioPlayer();
  const [isAdmin, setIsAdmin] = useState(false);

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
      className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors tracking-wider uppercase"
      title="Messages"
    >
      <MessageCircle className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Messages</span>
    </button>
  ) : null;

  const nowPlaying = playingSlot ? (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 max-w-[180px] sm:max-w-[220px]"
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
    </motion.div>
  ) : null;

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
          Dead Set
        </span>
      </button>
      {(children || adminLink || messagesLink || nowPlaying) && (
        <>
          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-4 sm:gap-6">
            {nowPlaying}
            <ShareAppButton />
            {messagesLink}
            {adminLink}
            {children}
          </div>
          {/* Mobile hamburger */}
          <div className="sm:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <button className="p-2 text-foreground" aria-label="Open menu">
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[260px] bg-background border-border p-0">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex flex-col gap-1 p-4 pt-12">
                  {nowPlaying}
                  <ShareAppButton variant="full" className="w-full justify-start" />
                  {messagesLink}
                  {adminLink}
                  {children}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </>
      )}
    </header>
  );
};

export default SiteHeader;
