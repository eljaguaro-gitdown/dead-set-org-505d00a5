import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const LastUpdatedBadge = () => {
  const navigate = useNavigate();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("changelog_entries")
        .select("week_stats_updates, week_number")
        .eq("published", true)
        .order("week_number", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        setCount(data[0].week_stats_updates);
      }
    };
    fetch();
  }, []);

  if (count === null) return null;

  return (
    <button
      onClick={() => navigate("/updates")}
      className="inline-flex items-center gap-1.5 font-mono text-xs text-[#c9a84c] hover:text-[#d4b050] transition-colors"
      title="View build notes"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#7ab87a] animate-pulse" />
      Updated {count} times this week
    </button>
  );
};

export default LastUpdatedBadge;
