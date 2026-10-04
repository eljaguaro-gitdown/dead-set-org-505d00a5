import { Instagram } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { INVITE_COPY, type InviteIntent } from "@/lib/signInInviteCopy";

/**
 * The sign-in prompt, for the moment someone tries to do something that needs
 * an account.
 *
 * It exists because the old path was: fire a toast, then `navigate('/auth')` on
 * the very next line. Nobody reads a toast racing a full-page route change, so
 * from the reader's side the tape they had just discovered simply vanished and
 * a login form took its place. The page they were excited about has to stay on
 * screen while they decide.
 *
 * The benefits are listed, not argued. A plain link and an Instagram post both
 * cost nothing, so signing in has to be worth something a reader can see in
 * two seconds — and the plain door says what it gives up, rather than sitting
 * there as an unexplained equal.
 */
export const SignInInvite = ({
  intent,
  open,
  onOpenChange,
  onSignIn,
  onPlainLink,
  onInstagram,
}: {
  intent: InviteIntent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignIn: () => void;
  /** Share only — the link with nobody's name on it. */
  onPlainLink?: () => void;
  /** Share only — post the card without an account. */
  onInstagram?: () => void;
}) => {
  const copy = INVITE_COPY[intent];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* bg-card is cream, so text-card-foreground is not optional here: the
          page's --foreground is cream too and would render invisible. */}
      <SheetContent
        side="bottom"
        className="bg-card text-card-foreground border-t border-border rounded-t-sm px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] max-h-[92vh] overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-md">
          <SheetHeader className="text-left space-y-2">
            {/* text-dead-dark, not text-primary: the brand red measures 4.09:1
                on the cream card and this is 10px uppercase, under the bar
                with no large-text exemption. The deep red is 13.66:1. */}
            <p className="font-ticket text-[10px] uppercase tracking-[0.18em] text-dead-dark">
              Hey Now
            </p>
            <SheetTitle className="font-header text-[1.75rem] leading-tight text-card-foreground">
              {copy.title}
            </SheetTitle>
            <SheetDescription className="font-body text-[15px] leading-relaxed text-card-foreground/85">
              {copy.body}
            </SheetDescription>
          </SheetHeader>

          <ul className="mt-4 space-y-2">
            {copy.benefits.map((b) => (
              <li key={b} className="flex gap-2.5 items-start">
                <span aria-hidden="true" className="text-dead-dark leading-[1.4] shrink-0">
                  ◆
                </span>
                <span className="font-body text-[15px] leading-snug text-card-foreground/90">{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 space-y-2">
            <Button
              onClick={onSignIn}
              className="w-full min-h-[48px] bg-primary text-primary-foreground font-ticket text-[11px] uppercase tracking-[0.1em]"
            >
              {copy.primary}
            </Button>

            {(onInstagram || onPlainLink) && (
              <div className="flex items-center gap-3 pt-2 pb-1" aria-hidden="true">
                <span className="flex-1 h-px bg-card-foreground/15" />
                <span className="font-ticket text-[10px] uppercase tracking-[0.14em] text-card-foreground/75">
                  or send it as is
                </span>
                <span className="flex-1 h-px bg-card-foreground/15" />
              </div>
            )}

            {onInstagram && copy.instagramLabel && (
              <Button
                variant="outline"
                onClick={onInstagram}
                className="w-full min-h-[44px] border-card-foreground/25 text-card-foreground hover:bg-card-foreground/5 font-body text-sm gap-2"
              >
                <Instagram className="w-4 h-4" /> {copy.instagramLabel}
              </Button>
            )}

            {onPlainLink && copy.plainLabel && (
              <Button
                variant="ghost"
                onClick={onPlainLink}
                className="w-full min-h-[44px] h-auto py-2 flex-col gap-0.5 text-card-foreground/80 hover:text-card-foreground hover:bg-card-foreground/5 font-body text-sm"
              >
                <span>{copy.plainLabel}</span>
                {copy.plainNote && (
                  <span className="font-ticket text-[11px] normal-case text-card-foreground/75">
                    {copy.plainNote}
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SignInInvite;
