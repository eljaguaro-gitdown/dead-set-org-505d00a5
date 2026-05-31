import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Link2, Share2, ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ShowPlate from "./ShowPlate";
import { trackShare } from "@/lib/trackShare";
import { shareToInstagram } from "@/lib/instagramShare";
import SendToFriendDialog from "./SendToFriendDialog";
import { useAuth } from "@/hooks/useAuth";

interface ShareFlowProps {
  open: boolean;
  onClose: () => void;
  setlistId: string;
  setlistName: string;
  showDate?: string;
  venueName?: string;
  venueState?: string;
  eraName?: string | null;
  creatorName?: string;
  songCount?: number;
  description?: string | null;
}

const ShareFlow = ({
  open, onClose, setlistId, setlistName,
  showDate = "", venueName = "", venueState = "",
  eraName, creatorName, songCount, description,
}: ShareFlowProps) => {
  const [plateDataUrl, setPlateDataUrl] = useState<string | null>(null);
  const [dmOpen, setDmOpen] = useState(false);
  const { user } = useAuth();

  // Distill Charlie's liner notes into a show one-liner for sharing
  const getShowOneLiner = (): string => {
    if (description) {
      // Grab the first sentence as the spirit of the show
      const firstSentence = description.split(/(?<=[.!?])\s+/)[0] || "";
      // Trim to ~120 chars for share-friendliness
      const oneLiner = firstSentence.length > 120
        ? firstSentence.slice(0, 117).replace(/[,\s]+$/, "") + "…"
        : firstSentence;
      if (oneLiner) return oneLiner;
    }
    return setlistName;
  };

  const shareUrl = `https://dead-set.org/setlist/${setlistId}`;
  const shareTitle = setlistName;
  const oneLiner = getShowOneLiner();
  const shareText = oneLiner && oneLiner !== setlistName
    ? `${oneLiner} ⚡ ${setlistName} on Dead-Set.Org`
    : `${setlistName} on Dead-Set.Org`;

  const handleImageReady = useCallback((dataUrl: string) => {
    setPlateDataUrl(dataUrl);
  }, []);

  const handleDownload = () => {
    if (!plateDataUrl) return;
    const a = document.createElement("a");
    const slug = setlistName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30);
    a.download = `deadset-${slug}.png`;
    a.href = plateDataUrl;
    a.click();
    trackShare({ shareType: "poster", channel: "download_plate", setlistId });
    toast.success("Plate saved!");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      trackShare({ shareType: "setlist", channel: "copy_link", setlistId });
      toast.success("Link copied!");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        trackShare({ shareType: "setlist", channel: "native_share", setlistId });
      } catch { /* cancelled */ }
    } else {
      handleCopyLink();
    }
  };

  const handleTwitter = () => {
    const text = encodeURIComponent(`${shareText} ${shareUrl}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
    trackShare({ shareType: "setlist", channel: "twitter", setlistId });
  };

  const handleFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, "_blank");
    trackShare({ shareType: "setlist", channel: "facebook", setlistId });
  };

  const handleTikTok = () => {
    // TikTok doesn't have a direct share URL — download the plate for upload
    handleDownload();
    trackShare({ shareType: "poster", channel: "tiktok", setlistId });
    toast.success("Plate saved — upload it to TikTok!");
  };

  const handleInstagram = async () => {
    await shareToInstagram({
      context: "setlist",
      imageDataUrl: plateDataUrl || undefined,
      setlistName,
      setlistId,
      posterUrl: shareUrl,
    });
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg bg-card border border-border rounded-2xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="font-display text-lg text-foreground">Your Show Plate</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Plate */}
          <div className="p-6 bg-[#0F0E0C]">
            <ShowPlate
              showDate={showDate}
              venueName={venueName}
              venueState={venueState}
              setlistName={setlistName}
              size="full"
              onImageReady={handleImageReady}
            />
          </div>

          {/* Info */}
          <div className="px-6 pt-4 pb-2 text-center">
            <p className="font-hand text-xl text-foreground">{setlistName}</p>
            {showDate && venueName && (
              <p className="font-mono text-xs text-muted-foreground mt-1">
                {showDate}  ·  {venueName}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 flex gap-2">
            <Button variant="outline" className="flex-1 gap-2 font-body" onClick={handleDownload}>
              <Download className="w-4 h-4" /> Save Plate
            </Button>
            <Button variant="outline" className="flex-1 gap-2 font-body" onClick={handleCopyLink}>
              <Link2 className="w-4 h-4" /> Copy Link
            </Button>
            <Button className="flex-1 gap-2 font-body" onClick={handleNativeShare}>
              <Share2 className="w-4 h-4" /> Share
            </Button>
          </div>

          {/* Social */}
          <div className="px-6 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px flex-1 bg-border" />
              <span className="font-mono text-[10px] text-muted-foreground/50 tracking-widest uppercase">or share to</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-wrap gap-2">
              {user && (
                <Button variant="outline" size="sm" className="flex-1 font-body text-xs gap-1.5" onClick={() => setDmOpen(true)}>
                  <MessageCircle className="w-3.5 h-3.5" /> Message
                </Button>
              )}
              <Button variant="outline" size="sm" className="flex-1 font-body text-xs" onClick={handleTwitter}>
                𝕏 / Twitter
              </Button>
              <Button variant="outline" size="sm" className="flex-1 font-body text-xs" onClick={handleFacebook}>
                Facebook
              </Button>
              <Button variant="outline" size="sm" className="flex-1 font-body text-xs" onClick={handleTikTok}>
                TikTok ↓
              </Button>
              <Button variant="outline" size="sm" className="flex-1 font-body text-xs gap-1" onClick={handleInstagram}>
                Instagram
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/50 font-body text-center mt-2">
              For TikTok: save the plate and upload. For Instagram: caption copied + image ready to share.
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 pb-4">
            <button onClick={onClose} className="w-full text-center font-mono text-[10px] text-muted-foreground/40 hover:text-muted-foreground tracking-widest uppercase transition-colors">
              <ArrowLeft className="w-3 h-3 inline mr-1" /> Back to Setlist
            </button>
          </div>

          {user && (
            <SendToFriendDialog
              open={dmOpen}
              onOpenChange={setDmOpen}
              shareUrl={shareUrl}
              shareText={shareText}
              setlistId={setlistId}
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ShareFlow;
