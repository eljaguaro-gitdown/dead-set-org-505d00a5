import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitReport, type ReportContentType } from "@/hooks/useModeration";

interface ReportDialogProps {
  contentType: ReportContentType;
  contentId: string;
  /** What the user is reporting, for the dialog copy — e.g. "this setlist" */
  label?: string;
  children: ReactNode;
}

/** Wrap any trigger element; opens a report dialog for the given content. */
const ReportDialog = ({ contentType, contentId, label = "this", children }: ReportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setBusy(true);
    const ok = await submitReport(contentType, contentId, reason);
    setBusy(false);
    if (ok) {
      setOpen(false);
      setReason("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Report {label}</DialogTitle>
          <DialogDescription className="font-body">
            Tell us what's wrong and we'll take a look. Reports are reviewed promptly, and
            content that breaks the house rules gets removed.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="What's the problem? (optional)"
          className="bg-background/50 border-border font-body text-sm min-h-[80px]"
          maxLength={500}
        />
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="font-body"
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={busy} className="font-body">
            {busy ? "Sending..." : "Send Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportDialog;
