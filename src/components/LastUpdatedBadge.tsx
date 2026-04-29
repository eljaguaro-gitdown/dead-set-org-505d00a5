import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const LastUpdatedBadge = () => {
  const navigate = useNavigate();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      // Get the most recent published week
      const { data: latest } = await supabase
        .from("changelog_entries")
        .select("week_number")
        .eq("published", true)
        .order("week_number", { ascending: false })
        .limit(1);

      if (!latest || latest.length === 0) return;
      const latestWeek = latest[0].week_number;

      // Count actual entries in that week (live count, not stored stat)
      const { count: entryCount } = await supabase
        .from("changelog_entries")
        .select("id", { count: "exact", head: true })
        .eq("published", true)
        .eq("week_number", latestWeek);

      if (entryCount !== null) setCount(entryCount);
    };
    fetch();
  }, []);

  if (count === null || count === 0) return null;

  return (
    <button
      onClick={() => navigate("/updates")}
      className="inline-flex items-center gap-1.5 font-mono text-xs text-[#c9a84c] hover:text-[#d4b050] transition-colors"
      title="View build notes"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#7ab87a] animate-pulse" />
      Updated {count} {count === 1 ? "time" : "times"} this week
    </button>
  );
};

export default LastUpdatedBadge;
