import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import StealYourFace from "@/components/StealYourFace";
import { useIsMobile } from "@/hooks/use-mobile";
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
      {children && (
        <>
          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-3 sm:gap-5">{children}</div>
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
