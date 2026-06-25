import { useState, useRef, useEffect } from "react";
import { Share2, Copy, Check, Twitter, Facebook, MessageCircle, Smartphone, Instagram } from "lucide-react";
import { toast } from "sonner";
import { trackShare } from "@/lib/trackShare";
import { shareToInstagram } from "@/lib/instagramShare";
import { useAuth } from "@/hooks/useAuth";
import SendToFriendDialog from "./SendToFriendDialog";

interface ShareDropdownProps {
  url: string;
  /** URL with OG meta tags for social crawlers (edge function). Falls back to url. */
  ogUrl?: string;
  title: string;
  description?: string;
}

const ShareDropdown = ({ url, ogUrl, title, description }: ShareDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Always show our menu so users can pick in-app DM, copy, socials, or native share.
  const handleToggle = () => setOpen((o) => !o);

  // Always share the canonical app URL (e.g. https://dead-set.org/setlist/:id).
  // Previously we shared the Supabase og-image function URL hoping for richer
  // unfurls, but iMessage treats that domain as a generic file download and
  // attaches it as "og-image · Text Document" instead of rendering a preview.
  // The canonical URL unfurls cleanly with sitewide OG tags (brand + logo).
  // `ogUrl` is kept in the props for backward compatibility but intentionally
  // unused — it belongs in <meta property="og:image">, not as the shared link.
  void ogUrl;
  const linkToShare = url;
  const setlistTitle = title.replace(/\s+—\s+Dead-Set\.Org$/i, "").trim() || title;
  const setlistShareText = description
    ? `${description}\n\n${setlistTitle} on Dead-Set.Org`
    : `${setlistTitle} on Dead-Set.Org`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(linkToShare);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = linkToShare;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast.success("Link copied!");
    trackShare({ shareType: "setlist", channel: "copy_link" });
    setTimeout(() => { setCopied(false); setOpen(false); }, 1500);
  };

  const socialUrl = linkToShare;

  const shareTwitter = () => {
    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(`${setlistTitle} on Dead-Set.Org`)}&url=${encodeURIComponent(socialUrl)}`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer,width=550,height=420");
    trackShare({ shareType: "setlist", channel: "twitter" });
    setOpen(false);
  };

  const shareFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(socialUrl)}`;
    window.open(fbUrl, "_blank", "noopener,noreferrer,width=550,height=420");
    trackShare({ shareType: "setlist", channel: "facebook" });
    setOpen(false);
  };

  const shareNative = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: setlistTitle, text: setlistShareText, url: linkToShare });
      trackShare({ shareType: "setlist", channel: "native_share" });
    } catch {
      // user cancelled — keep menu open so they can pick another option
      return;
    }
    setOpen(false);
  };

  const shareInstagram = async () => {
    await shareToInstagram({
      context: "setlist",
      setlistName: title,
      posterUrl: url,
    });
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body bg-card/80 border border-border text-card-foreground hover:border-primary/40 transition-colors"
      >
        <Share2 className="w-3 h-3" /> Share
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-scale-in">
          {user && (
            <button
              onClick={() => { setOpen(false); setDmOpen(true); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-body text-foreground hover:bg-muted/50 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-primary" />
              Send to a Deadhead
            </button>
          )}
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
          <button
            onClick={shareInstagram}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-body text-foreground hover:bg-muted/50 transition-colors"
          >
            <Instagram className="w-4 h-4 text-muted-foreground" />
            Share to Instagram
          </button>
          {hasNativeShare && (
            <button
              onClick={shareNative}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-body text-foreground hover:bg-muted/50 transition-colors border-t border-border/50"
            >
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              More apps…
            </button>
          )}
        </div>
      )}

      {user && (
        <SendToFriendDialog
          open={dmOpen}
          onOpenChange={setDmOpen}
          shareUrl={url}
          shareText={setlistShareText}
        />
      )}
    </div>
  );
};

export default ShareDropdown;
