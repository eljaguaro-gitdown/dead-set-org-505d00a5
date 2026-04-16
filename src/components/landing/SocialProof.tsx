import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const SocialProof = () => {
  const [stats, setStats] = useState<{ setlists: number; users: number } | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const [setlistRes, profileRes] = await Promise.all([
        supabase.from("setlists").select("id", { count: "exact", head: true }).eq("is_public", true),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        setlists: setlistRes.count || 0,
        users: profileRes.count || 0,
      });
    };
    fetch();
  }, []);

  // Hidden until we cross meaningful scale — restore once both thresholds are met.
  const SETLIST_THRESHOLD = 10000;
  const USER_THRESHOLD = 5000;
  if (!stats) return null;
  if (stats.setlists < SETLIST_THRESHOLD || stats.users < USER_THRESHOLD) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="flex items-center justify-center gap-6 font-mono text-sm tracking-wide text-muted-foreground/70"
    >
      {stats.setlists > 0 && (
        <span>
          <strong className="text-primary font-bold">{stats.setlists.toLocaleString()}</strong>{" "}
          setlists built
        </span>
      )}
      {stats.users > 0 && (
        <span>
          <strong className="text-primary font-bold">{stats.users.toLocaleString()}</strong>{" "}
          Deadheads
        </span>
      )}
    </motion.div>
  );
};

export default SocialProof;
