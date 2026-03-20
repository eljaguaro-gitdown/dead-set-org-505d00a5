import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Shield, Music, Pause } from "lucide-react";
import { motion } from "framer-motion";
import StealYourFace from "@/components/StealYourFace";
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
      className="flex items-center gap-1.5 text-xs font-body text-primary/80 hover:text-primary transition-colors"
      title="Admin Dashboard"
    >
      <Shield className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Admin</span>
    </button>
  ) : null;

  return (
    <header className="border-b border-border/50 px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 sm:gap-4 group"
      >
        <StealYourFace size={large ? (isMobile ? 40 : 64) : (isMobile ? 32 : 48)} />
        <span
          className={`font-display text-foreground tracking-wide transition-colors group-hover:text-primary ${
            large ? "text-xl sm:text-3xl md:text-4xl" : "text-lg sm:text-2xl md:text-3xl"
          }`}
        >
          Dead Set
        </span>
      </button>
      {(children || adminLink) && (
        <>
          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-3 sm:gap-5">
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
