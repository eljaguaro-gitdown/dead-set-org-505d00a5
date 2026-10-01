import { useState } from "react";
import { Flag, UserX } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import ReportDialog from "@/components/ReportDialog";
import { useBlockedUsers, type ReportContentType } from "@/hooks/useModeration";
import { cn } from "@/lib/utils";

interface SafetyMenuProps {
  /** What the flag reports: the setlist on a setlist page, the account on a user page. */
  contentType: ReportContentType;
  contentId: string;
  /** For the report dialog title, e.g. "this setlist". */
  reportLabel: string;
  /** Who posted it — the person a block applies to. */
  ownerId: string;
  ownerName: string;
  /** After a successful block — e.g. leave a page whose content is now hidden. */
  onBlocked?: () => void;
  className?: string;
}

type Step = "closed" | "choose" | "report" | "block";

/**
 * The flag on a setlist or a person: report it, or block whoever posted it.
 * Render it only for content the viewer does not own.
 *
 * App Store guideline 1.2. The first submission's report control on a setlist
 * was a 10px text link under the comments, and there was no way to block a
 * setlist's curator at all — setlists being the main thing people post.
 *
 * A plain button opening a dialog, not a dropdown menu: Radix's menu opens on
 * pointerdown, and a synthetic tap in mobile emulation left it closed. The
 * reviewer's tap is the one that has to work.
 */
const SafetyMenu = ({
  contentType,
  contentId,
  reportLabel,
  ownerId,
  ownerName,
  onBlocked,
  className,
}: SafetyMenuProps) => {
  const { block } = useBlockedUsers();
  const [step, setStep] = useState<Step>("closed");
  const close = (open: boolean) => !open && setStep("closed");

  return (
    <>
      <button
        type="button"
        onClick={() => setStep("choose")}
        className={cn(
          "flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full text-foreground/70 hover:text-foreground transition-colors",
          className,
        )}
        aria-label="Report or block"
        title="Report or block"
      >
        <Flag className="w-4 h-4" />
      </button>

      <Dialog open={step === "choose"} onOpenChange={close}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Something wrong here?</DialogTitle>
            <DialogDescription className="font-body">
              Report it and we act within 24 hours. Block {ownerName} and their setlists and
              comments disappear from your view.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => setStep("report")}
              className="justify-start gap-2 font-body h-11"
            >
              <Flag className="w-4 h-4" /> Report {reportLabel}
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep("block")}
              className="justify-start gap-2 font-body h-11 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <UserX className="w-4 h-4" /> Block {ownerName}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ReportDialog
        contentType={contentType}
        contentId={contentId}
        label={reportLabel}
        open={step === "report"}
        onOpenChange={close}
      />

      <AlertDialog open={step === "block"} onOpenChange={close}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Block {ownerName}?</AlertDialogTitle>
            <AlertDialogDescription className="font-body">
              Their setlists and comments disappear from everything you see, right now, and they
              can't message you. We also get a heads-up to review what they've posted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-body">Never mind</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (await block(ownerId)) onBlocked?.();
              }}
              className="font-body bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SafetyMenu;
