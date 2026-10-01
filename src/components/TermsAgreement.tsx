import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface TermsAgreementProps {
  agreed: boolean;
  onAgreedChange: (agreed: boolean) => void;
  /** Someone tried to continue without agreeing — draw the eye here. */
  nudged?: boolean;
  /** Sitting on the cream card (the auth modal) rather than the dark page. */
  onCard?: boolean;
}

/**
 * The Terms agreement shown above every sign-in and sign-up button. Pair it
 * with useTermsAgreement(), whose requireAgreement() gates the buttons.
 */
const TermsAgreement = ({ agreed, onAgreedChange, nudged = false, onCard = false }: TermsAgreementProps) => (
  <label
    className={cn(
      // The foreground token is cream and so is the card, so the two tones
      // are not interchangeable: cream text on the card is unreadable.
      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
      onCard ? "bg-muted/40" : "bg-foreground/5",
      nudged && !agreed ? "border-dead-gold ring-2 ring-dead-gold/40" : "border-border/60",
    )}
  >
    <Checkbox
      checked={agreed}
      onCheckedChange={(value) => onAgreedChange(value === true)}
      className={cn(
        "mt-0.5 data-[state=checked]:border-primary",
        onCard ? "border-card-foreground/60" : "border-foreground/70",
      )}
      aria-label="I agree to the Terms of Use and Privacy Policy"
    />
    <span
      className={cn(
        "font-body text-xs leading-relaxed",
        onCard ? "text-card-foreground" : "text-foreground/85",
      )}
    >
      I agree to the{" "}
      <a href="/terms" className="underline underline-offset-2">
        Terms of Use
      </a>{" "}
      and{" "}
      <a href="/privacy" className="underline underline-offset-2">
        Privacy Policy
      </a>
      . Dead Set has <strong>zero tolerance</strong> for objectionable content or abusive users.
    </span>
  </label>
);

export default TermsAgreement;
