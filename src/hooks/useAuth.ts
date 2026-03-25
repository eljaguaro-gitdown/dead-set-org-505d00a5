import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const SESSION_FLAG = "dead_set_active_session";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const didInit = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        sessionStorage.setItem(SESSION_FLAG, "1");
      }
      if (event === "SIGNED_OUT") {
        sessionStorage.removeItem(SESSION_FLAG);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // On first mount: if no active session flag in sessionStorage,
    // clear any persisted auth so users always start fresh.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && !sessionStorage.getItem(SESSION_FLAG) && !didInit.current) {
        didInit.current = true;
        await supabase.auth.signOut();
        setUser(null);
        setLoading(false);
      } else {
        didInit.current = true;
        setUser(session?.user ?? null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    sessionStorage.removeItem(SESSION_FLAG);
    await supabase.auth.signOut();
  };

  return { user, loading, signOut };
};
