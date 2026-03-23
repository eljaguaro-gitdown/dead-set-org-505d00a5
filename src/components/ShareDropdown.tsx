import { useState, useRef, useEffect } from "react";
import { Share2, Copy, Check, Twitter, Facebook } from "lucide-react";
import { toast } from "sonner";

interface ShareDropdownProps {
  url: string;
  title: string;
  description?: string;
}

const ShareDropdown = ({ url, title, description }: ShareDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleShare = async () => {
    // Mobile: native share sheet
    if (navigator.share) {
      try {
        await navigator.share({ title, text: description || title, url });
        return;
      } catch {
        // User cancelled or not supported — fall through to dropdown
      }
    }
    // Desktop: toggle dropdown
    setOpen((o) => !o);
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => { setCopied(false); setOpen(false); }, 1500);
  };

  const shareTwitter = () => {
    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer,width=550,height=420");
    setOpen(false);
  };

  const shareFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(fbUrl, "_blank", "noopener,noreferrer,width=550,height=420");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleShare}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body bg-card/80 border border-border text-foreground hover:border-primary/40 transition-colors"
      >
        <Share2 className="w-3 h-3" /> Share
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-scale-in">
          <button
            onClick={copyLink}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-body text-foreground hover:bg-muted/50 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={shareTwitter}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-body text-foreground hover:bg-muted/50 transition-colors"
          >
            <Twitter className="w-4 h-4 text-muted-foreground" />
            Share on X
          </button>
          <button
            onClick={shareFacebook}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-body text-foreground hover:bg-muted/50 transition-colors"
          >
            <Facebook className="w-4 h-4 text-muted-foreground" />
            Share on Facebook
          </button>
        </div>
      )}
    </div>
  );
};

export default ShareDropdown;
