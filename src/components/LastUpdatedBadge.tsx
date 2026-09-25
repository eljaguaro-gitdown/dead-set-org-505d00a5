import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchReleaseActivity, type ReleaseActivity } from "@/lib/webReleases";

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const LastUpdatedBadge = () => {
  const navigate = useNavigate();
  const [activity, setActivity] = useState<ReleaseActivity | null>(null);

  useEffect(() => {
    // Counts web releases, not Build Notes entries. Notes stopped in April and
    // the badge either claimed an April week as "this week" or disappeared;
    // a release is what fans actually get, and one is recorded every publish.
    fetchReleaseActivity().then(setActivity);
  }, []);

  if (!activity || (!activity.thisWeek && !activity.lastReleasedAt)) return null;

  const label = activity.thisWeek
    ? `Updated ${activity.thisWeek} ${activity.thisWeek === 1 ? "time" : "times"} this week`
    : `Last updated ${formatDay(activity.lastReleasedAt!)}`;

  return (
    <button
      onClick={() => navigate("/updates")}
      className="inline-flex items-center gap-1.5 font-mono text-xs text-[#c9a84c] hover:text-[#d4b050] transition-colors"
      title="View build notes"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#7ab87a] animate-pulse" />
      {label}
    </button>
  );
};

export default LastUpdatedBadge;
