import { Link } from "react-router-dom";

/**
 * The closing invitation under a Songbook issue.
 *
 * Shared because it was on the curated issue only: the community branch of
 * /songbook/:slug renders its own article and simply ended, so a reader who
 * arrived on a community issue hit the bottom of the page with nowhere to go,
 * while a curated one offered the shelf. Same page, same route, two endings.

 * The eyebrow is text-foreground/75, not /55: at 11px on the maroon page /55
 * measures 4.18:1, under the 4.5:1 floor. It came over from the curated page
 * verbatim, so this fixes it in both places at once.
 */
const SongbookFooterCta = () => (
  <div className="text-center mt-9">
    <p className="font-ticket text-[11px] uppercase tracking-[0.12em] text-foreground/75 mb-3">
      A new song every week
    </p>
    <Link
      to="/songbook"
      className="inline-block font-ticket text-[11px] uppercase tracking-[0.12em] px-5 py-3 rounded-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
    >
      Every issue of The Songbook
    </Link>
  </div>
);

export default SongbookFooterCta;
