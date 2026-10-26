import { useEffect, useState } from "react";
import { fetchCommunityFixes, shortShowDate, type CommunityFix } from "@/lib/playbackIssues";
import { isNativeApp } from "@/lib/nativeApp";

/**
 * "Credit your contribution, with your approval." Tapes that would not play,
 * flagged by fans, fixed, and heard playing again, with the names of the fans
 * who said yes when the oops card asked. Community is the hero: the line is
 * theirs, not ours.
 *
 * Renders nothing until there is at least one credited fix. Titles come from
 * `songs` and names from `profiles` (community_fixes()), so nothing a report
 * carried is printed here.
 *
 * Web only. In the iOS app a printed fan name is user-generated content under
 * App Review 1.2, which wants a way to report it, hide it, and withdraw it,
 * and this list has none of them yet. So the native app shows no credits at
 * all, and does not fetch them. The names stay on dead-set.org.
 */
const CommunityFixesList = () => {
  const [fixes, setFixes] = useState<CommunityFix[]>([]);
  const native = isNativeApp();

  useEffect(() => {
    if (native) return;
    let cancelled = false;
    void fetchCommunityFixes().then((list) => {
      if (!cancelled) setFixes(list);
    });
    return () => {
      cancelled = true;
    };
  }, [native]);

  if (native || fixes.length === 0) return null;

  return (
    <section aria-labelledby="community-fixes" className="mb-8 bg-[#0d0d0d] border border-[#2a2410] rounded-lg px-5 py-4">
      <h2 id="community-fixes" className="font-mono text-xs text-[#a09880] uppercase tracking-wider border-b border-[#1e1c10] pb-1 mb-3">
        Fixed with the community
      </h2>
      <ul className="space-y-2">
        {fixes.map((f) => {
          const date = shortShowDate(f.showDate);
          return (
            <li key={f.issueId} className="font-body text-sm text-[#b0ac9a]">
              <span className="text-[#c9a84c]">
                {f.songTitle}
                {date ? ` · ${date}` : ""}
              </span>{" "}
              plays again. Flagged by {f.credited.join(", ")}.
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default CommunityFixesList;
