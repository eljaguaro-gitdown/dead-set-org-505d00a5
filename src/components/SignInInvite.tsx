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
 * Two intents, because the honest answer differs between them:
 *
 * - `share`: /versions/:slug is a PUBLIC url. Anyone can read it signed out,
 *   and on a phone it is two taps out of the address bar. So signing in is not
 *   a technical requirement here and the copy must not pretend it is — what it
 *   actually buys is credit, which is the real thing and the better offer.
 *   The plain link stays available, because walling a public url costs goodwill
 *   at the exact moment someone is most excited.
 * - `save`: a listening guide is a row owned by a user. It genuinely cannot
 *   exist without an account, so there is no second door and the copy says so.
 */
export const SignInInvite = ({
  intent,
  open,
  onOpenChange,
  onSignIn,
  onSecondary,
}: {
  intent: InviteIntent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignIn: () => void;
  /** Only wired for `share` — the plain-link door. */
  onSecondary?: () => void;
}) => {
  const copy = INVITE_COPY[intent];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* bg-card is cream, so text-card-foreground is not optional here: the
          page's --foreground is cream too and would render invisible. */}
      <SheetContent
        side="bottom"
        className="bg-card text-card-foreground border-t border-border rounded-t-sm px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto w-full max-w-md">
          <SheetHeader className="text-left space-y-2">
            {/* text-dead-dark, not text-primary: the brand red measures
                4.09:1 on the cream card, and this is 10px uppercase — under
                the 4.5:1 bar with no large-text exemption to lean on. The deep
                red is the same family at 13.66:1. */}
            <p className="font-ticket text-[10px] uppercase tracking-[0.18em] text-dead-dark">
              Hey Now
            </p>
            <SheetTitle className="font-header text-[1.75rem] leading-tight text-card-foreground">
              {copy.title}
            </SheetTitle>
            <SheetDescription className="font-body text-sm leading-relaxed text-card-foreground/85">
              {copy.body}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-2">
            <Button
              onClick={onSignIn}
              className="w-full min-h-[48px] bg-primary text-primary-foreground font-ticket text-[11px] uppercase tracking-[0.1em]"
            >
              {copy.primary}
            </Button>
            {copy.secondary && onSecondary && (
              <Button
                variant="ghost"
                onClick={onSecondary}
                className="w-full min-h-[44px] text-card-foreground/80 hover:text-card-foreground hover:bg-card-foreground/5 font-body text-sm"
              >
                {copy.secondary}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SignInInvite;
