import { Link, useInRouterContext, useNavigate } from "react-router-dom";
import { CHARLIE_ABOUT_PATH, CHARLIE_BYLINE } from "@/lib/charlieCredit";

/**
 * The asterisk and byline that go after anything Cosmic Charlie wrote.
 *
 * Renders inline, right after his words: "…the jam goes long. *Cosmic
 * Charlie", with his name linking to the About section that says who he is
 * and where his facts come from. See `src/lib/charlieCredit.ts` for the rule
 * and for what counts as his words.
 *
 * `insideButton` is for a note printed inside a card that is itself a
 * <button>, where an <a> would be invalid HTML. The credit is then a span that
 * navigates on tap and stops the tap from also selecting the card. Use it only
 * there; everywhere else it is a real link.
 */
interface CreditProps {
  className?: string;
  insideButton?: boolean;
}

const BASE =
  "not-italic font-ticket text-[10px] uppercase tracking-[0.12em] whitespace-nowrap align-baseline";
const LINK_LOOK = "underline underline-offset-2 decoration-dotted hover:decoration-solid cursor-pointer";
const LABEL = "Written by Cosmic Charlie. Who he is and where his notes come from";
const TEXT = `*${CHARLIE_BYLINE}`;

/** Inside the app's router: client-side navigation, no reload. */
function RoutedCredit({ className = "", insideButton = false }: CreditProps) {
  const navigate = useNavigate();
  if (insideButton) {
    return (
      <span className={`${BASE} ${className}`} data-charlie-credit="">
        {" "}
        <span
          role="link"
          aria-label={LABEL}
          className={LINK_LOOK}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            navigate(CHARLIE_ABOUT_PATH);
          }}
        >
          {TEXT}
        </span>
      </span>
    );
  }
  return (
    <span className={`${BASE} ${className}`} data-charlie-credit="">
      {" "}
      <Link to={CHARLIE_ABOUT_PATH} onClick={(e) => e.stopPropagation()} className={LINK_LOOK} aria-label={LABEL}>
        {TEXT}
      </Link>
    </span>
  );
}

/**
 * Outside a router (an isolated render, a test): a plain link to the same
 * place. The credit must never be the thing that crashes a page.
 */
function PlainCredit({ className = "", insideButton = false }: CreditProps) {
  if (insideButton) {
    return (
      <span className={`${BASE} ${className}`} data-charlie-credit="">
        {" "}{TEXT}
      </span>
    );
  }
  return (
    <span className={`${BASE} ${className}`} data-charlie-credit="">
      {" "}
      <a href={CHARLIE_ABOUT_PATH} onClick={(e) => e.stopPropagation()} className={LINK_LOOK} aria-label={LABEL}>
        {TEXT}
      </a>
    </span>
  );
}

export function CharlieCredit(props: CreditProps) {
  return useInRouterContext() ? <RoutedCredit {...props} /> : <PlainCredit {...props} />;
}

export default CharlieCredit;
