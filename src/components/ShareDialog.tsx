import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareLink: string;
}

const ShareDialog = ({ open, onOpenChange, shareLink }: ShareDialogProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = shareLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join my Dead Set setlist!",
          text: "Collaborate on this Grateful Dead dream setlist",
          url: shareLink,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Share & Collaborate</DialogTitle>
          <DialogDescription className="font-body text-muted-foreground text-sm">
            Share this link to invite collaborators. They'll need to sign in to edit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="flex gap-2">
            <Input
              readOnly
              value={shareLink}
              className="bg-background border-border text-foreground font-body text-sm"
            />
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="border-border text-foreground shrink-0 gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-green-500" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy
                </>
              )}
            </Button>
          </div>
          <Button
            onClick={handleShare}
            className="w-full bg-primary text-primary-foreground font-body gap-2"
          >
            <Link className="w-4 h-4" /> Share Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
