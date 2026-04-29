import { useNavigate, useLocation } from "react-router-dom";
import { trackCtaClick } from "@/lib/trackCtaClick";
import { ChevronRight } from "lucide-react";

export const COMMUNITY_SECTION_ID = "top-community";
const STORAGE_KEY = "ds_browse_community_clicked";

interface BrowseCommunityLinkProps {
  /** Where this link lives, for analytics (e.g. "hero", "footer", "personal_note") */
  source: string;
  /** Optional override label */
  label?: string;
  className?: string;
  showArrow?: boolean;
}

/**
 * Inline deep-link to the community section on the landing page.
 * - Logs a tracked CTA click
 * - Marks the visitor as a "community-interested" returner (localStorage)
 * - On the same page, smooth-scrolls to the section
 * - From elsewhere, navigates home with #top-community hash
 */
const BrowseCommunityLink = ({
  source,
  label = "Browse community setlists",
  className = "",
  showArrow = true,
}: BrowseCommunityLinkProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    trackCtaClick(`browse_community_${source}`, `/#${COMMUNITY_SECTION_ID}`);

    // Remember intent so subsequent visits to "/" auto-scroll
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore quota / privacy mode
    }

    if (location.pathname === "/") {
      const el = document.getElementById(COMMUNITY_SECTION_ID);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // update hash without full navigation
        window.history.replaceState(null, "", `#${COMMUNITY_SECTION_ID}`);
        return;
      }
    }
    navigate(`/#${COMMUNITY_SECTION_ID}`);
  };

  return (
    <a
      href={`/#${COMMUNITY_SECTION_ID}`}
      onClick={handleClick}
      className={
        className ||
        "inline-flex items-center gap-1 text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary transition-colors font-body"
      }
      data-cta={`browse_community_${source}`}
    >
      {label}
      {showArrow && <ChevronRight className="w-3.5 h-3.5" />}
    </a>
  );
};

export default BrowseCommunityLink;
export { STORAGE_KEY as BROWSE_COMMUNITY_STORAGE_KEY };
