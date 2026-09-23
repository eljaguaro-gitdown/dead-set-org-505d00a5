import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const LastUpdatedBadge = () => {
  const navigate = useNavigate();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      // Count notes published in the last seven days. This used to count the
      // entries in the latest published week, whatever its date, so the
      // footer said "Updated 2 times this week" from April to September on
      // the strength of Week 2's two notes. Entries are inserted at publish
      // time, so created_at is when a fan could first read them.
      const since = new Date(Date.now() - WEEK_MS).toISOString();
      const { count: entryCount } = await supabase
        .from("changelog_entries")
        .select("id", { count: "exact", head: true })
        .eq("published", true)
        .gte("created_at", since);

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
