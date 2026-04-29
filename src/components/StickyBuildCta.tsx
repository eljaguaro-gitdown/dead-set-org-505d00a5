import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { trackCtaClick } from "@/lib/trackCtaClick";

/**
 * Sticky bottom mobile CTA — "Build with Cosmic Charlie".
 * Appears on mobile after the user scrolls past the header,
 * so the primary action is always reachable.
 *
 * Hidden on:
 *  - /builder (CTA is the page itself; MiniSetlistBar lives there)
 *  - /auth, /reset-password (focused flows)
 */
const HIDDEN_PREFIXES = ["/builder", "/auth", "/reset-password"];
const SHOW_AFTER_PX = 320;

const StickyBuildCta = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  const isHidden = HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (isHidden) {
      setVisible(false);
      return;
    }
    const onScroll = () => {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHidden, location.pathname]);

  if (isHidden) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed left-0 right-0 z-40 px-4 sm:hidden pointer-events-none"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
        >
          <button
            onClick={() => {
              trackCtaClick("sticky_build_mobile");
              navigate("/builder?wizard=true");
            }}
            className="pointer-events-auto w-full flex items-center justify-center gap-2 font-display italic text-base tracking-wide text-[#0D0D0D] bg-gradient-to-r from-[#C9A84C] to-[#E8D48B] hover:from-[#E8D48B] hover:to-[#C9A84C] transition-all duration-300 rounded-xl px-5 py-3.5 min-h-[52px] shadow-[0_8px_28px_rgba(201,168,76,0.45)]"
            aria-label="Build a setlist with Cosmic Charlie"
          >
            <Sparkles className="w-4 h-4" />
            <span>Build with Cosmic Charlie</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StickyBuildCta;
