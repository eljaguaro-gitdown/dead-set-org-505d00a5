import { useState } from "react";
import { Share2, Check, Copy, MessageCircle, Instagram } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { trackShare } from "@/lib/trackShare";
import { shareToInstagram } from "@/lib/instagramShare";

const SHARE_URL = "https://dead-set.org";
const SHARE_TITLE = "Dead-Set.Org — The Music Never Stops";
const SHARE_TEXT =
  "Check out Dead-Set.Org — built by Deadheads, for Deadheads. Discover rare gems, build your dream show, and explore 50 years of live recordings from the Archive. ⚡🌹";

interface ShareAppButtonProps {
  variant?: "icon" | "full";
  className?: string;
}

const ShareAppButton = ({ variant = "icon", className = "" }: ShareAppButtonProps) => {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = SHARE_URL;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast.success("Link copied!");
    trackShare({ shareType: "app_link", channel: "copy_link" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL });
      trackShare({ shareType: "app_link", channel: "native_share" });
      setOpen(false);
    } catch {
      // user cancelled
    }
  };

  const handleSMS = () => {
    const body = encodeURIComponent(`${SHARE_TEXT}\n${SHARE_URL}`);
    window.open(`sms:?body=${body}`, "_blank");
    trackShare({ shareType: "app_link", channel: "sms" });
    setOpen(false);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(`${SHARE_TEXT}\n${SHARE_URL}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
    trackShare({ shareType: "app_link", channel: "whatsapp" });
    setOpen(false);
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(SHARE_TITLE);
    const body = encodeURIComponent(`${SHARE_TEXT}\n\n${SHARE_URL}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
    trackShare({ shareType: "app_link", channel: "email" });
    setOpen(false);
  };

  const handleTwitter = () => {
    const text = encodeURIComponent(`${SHARE_TEXT}\n${SHARE_URL}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
    trackShare({ shareType: "app_link", channel: "twitter" });
    setOpen(false);
  };

  const handleInstagram = async () => {
    await shareToInstagram({ context: "app" });
    setOpen(false);
  };

  // On mobile with native share, just trigger it directly
  if (hasNativeShare) {
    if (variant === "full") {
      return (
        <Button
          variant="outline"
          onClick={handleNativeShare}
          className={`gap-2 border-border text-foreground hover:bg-muted font-body ${className}`}
        >
          <Share2 className="w-4 h-4" />
          Share with a Friend
        </Button>
      );
    }
    return (
      <button
        onClick={handleNativeShare}
        className={`flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-primary transition-colors tracking-wider uppercase ${className}`}
        title="Share Dead Set"
      >
        <Share2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Share</span>
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "full" ? (
          <Button
            variant="outline"
            className={`gap-2 border-border text-foreground hover:bg-muted font-body ${className}`}
          >
            <Share2 className="w-4 h-4" />
            Share with a Friend
          </Button>
        ) : (
          <button
            className={`flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-primary transition-colors tracking-wider uppercase ${className}`}
            title="Share Dead Set"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share</span>
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[220px] bg-card border-border p-2 space-y-1"
      >
        <p className="font-display text-sm text-foreground px-2 pt-1 pb-2">
          Share Dead Set
        </p>

        {/* Copy link */}
        <button
          onClick={handleCopyLink}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-body text-foreground hover:bg-muted transition-colors"
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span key="check" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                <Check className="w-4 h-4 text-green-500" />
              </motion.span>
            ) : (
              <motion.span key="copy" initial={{ scale: 0.8 }} animate={{ scale: 1 }}>
                <Copy className="w-4 h-4 text-muted-foreground" />
              </motion.span>
            )}
          </AnimatePresence>
          {copied ? "Copied!" : "Copy Link"}
        </button>

        {/* Text / SMS */}
        <button
          onClick={handleSMS}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-body text-foreground hover:bg-muted transition-colors"
        >
          <MessageCircle className="w-4 h-4 text-muted-foreground" />
          Text a Friend
        </button>

        {/* WhatsApp */}
        <button
          onClick={handleWhatsApp}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-body text-foreground hover:bg-muted transition-colors"
        >
          <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          WhatsApp
        </button>

        {/* Email */}
        <button
          onClick={handleEmail}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-body text-foreground hover:bg-muted transition-colors"
        >
          <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
          Email
        </button>

        {/* Twitter/X */}
        <button
          onClick={handleTwitter}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-body text-foreground hover:bg-muted transition-colors"
        >
          <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Twitter / X
        </button>

        {/* Instagram */}
        <button
          onClick={handleInstagram}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-body text-foreground hover:bg-muted transition-colors"
        >
          <Instagram className="w-4 h-4 text-muted-foreground" />
          Instagram
        </button>

        {/* Native share fallback for desktop if available */}
        {hasNativeShare && (
          <>
            <div className="h-px bg-border mx-2" />
            <button
              onClick={handleNativeShare}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-body text-foreground hover:bg-muted transition-colors"
            >
              <Share2 className="w-4 h-4 text-muted-foreground" />
              More options…
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default ShareAppButton;
