import { useState, useRef, useEffect } from "react";
import { Share2, Copy, Check, Twitter, Facebook, MessageCircle, Smartphone, Instagram } from "lucide-react";
import { toast } from "sonner";
import { trackShare, setlistIdFromShareUrl } from "@/lib/trackShare";
import type { SharePayload } from "@/lib/shareCopy";
import { shareToInstagram } from "@/lib/instagramShare";
import { useAuth } from "@/hooks/useAuth";
import SendToFriendDialog from "./SendToFriendDialog";

interface ShareDropdownProps {
  url: string;
  /** URL with OG meta tags for social crawlers (edge function). Falls back to url. */
  ogUrl?: string;
  /** Document/heading title. The SHARE's title comes from `share`. */
  title: string;
  /**
   * The share's own copy, from `@/lib/shareCopy` — REQUIRED, and the only
   * source of what a share says. The clipboard, the native sheet, the DM and
   * the socials all read it, so every surface sells what it is passing on
   * instead of each one inventing a line. There is deliberately no fallback:
   * a new caller must add a function to shareCopy rather than assemble a
   * string here. See the rule at the top of that module.
   */
  share: SharePayload;
}

const ShareDropdown = ({ url, ogUrl, title, share }: ShareDropdownProps) => {
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
  // Derived, not a prop: see setlistIdFromShareUrl. Undefined for non-setlist
  // share urls such as /songbook/<slug>, which is correct — those are not
  // setlists and must not be attributed to one.
  const setlistId = setlistIdFromShareUrl(linkToShare);
  // `body` carries no url; `text` does. A field that also takes the link
  // separately gets `body`, a field that takes one string gets `text`.
  const shareBody = share.body;
  const shareText = share.text;

  /**
   * Copy the TEXT and the link, not the bare link.
   *
   * A pasted bare url leaves the receiving app to say what it is, and the
   * unfurl it generates is the SITEWIDE meta in index.html (the homepage's
   * title and description), because every route here is client-rendered and
   * a crawler does not run JS. So a shared Songbook issue read as the app
   * rather than as the song.
   * Prepending the text is what actually puts "Played 382 times between 1973
   * and 1995" in front of the person receiving it, and it works in every app
   * including the ones that unfurl nothing at all.
   *
   * The real fix for the unfurl itself is per-route meta served before the SPA
   * fallback, which this app does not have for any route.
   */
  const copyPayload = shareText;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(copyPayload);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = copyPayload;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast.success("Copied — ready to paste");
    trackShare({ shareType: "setlist", channel: "copy_link", setlistId });
    setTimeout(() => { setCopied(false); setOpen(false); }, 1500);
  };

  const socialUrl = linkToShare;

  const shareTwitter = () => {
    // body, not title: X takes the link in its own `url` param, and a title like
    // "Bertha on Dead-Set.Org" gets linkified into a SECOND link to the home
    // page — the same defect as the WhatsApp one, one surface over.
    const tweetUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(shareBody)}&url=${encodeURIComponent(socialUrl)}`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer,width=550,height=420");
    trackShare({ shareType: "setlist", channel: "twitter", setlistId });
    setOpen(false);
  };

  const shareFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(socialUrl)}`;
    window.open(fbUrl, "_blank", "noopener,noreferrer,width=550,height=420");
    trackShare({ shareType: "setlist", channel: "facebook", setlistId });
    setOpen(false);
  };

  const shareNative = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: share.title, text: shareBody, url: linkToShare });
      trackShare({ shareType: "setlist", channel: "native_share", setlistId });
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
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-body text-card-foreground hover:bg-muted/50 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-primary" />
              Send to a Deadhead
            </button>
          )}
          <button
            onClick={copyLink}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-body text-card-foreground hover:bg-muted/50 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button
            onClick={shareTwitter}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-body text-card-foreground hover:bg-muted/50 transition-colors"
          >
            <Twitter className="w-4 h-4 text-muted-foreground" />
            Share on X
          </button>
          <button
            onClick={shareFacebook}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-body text-card-foreground hover:bg-muted/50 transition-colors"
          >
            <Facebook className="w-4 h-4 text-muted-foreground" />
            Share on Facebook
          </button>
          <button
            onClick={shareInstagram}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-body text-card-foreground hover:bg-muted/50 transition-colors"
          >
            <Instagram className="w-4 h-4 text-muted-foreground" />
            Share to Instagram
          </button>
          {hasNativeShare && (
            <button
              onClick={shareNative}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-body text-card-foreground hover:bg-muted/50 transition-colors border-t border-border/50"
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
          shareBody={shareBody}
          setlistId={setlistId}
        />
      )}
    </div>
  );
};

export default ShareDropdown;
