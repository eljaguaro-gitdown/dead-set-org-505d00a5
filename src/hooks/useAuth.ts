import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const SESSION_FLAG = "dead_set_active_session";
const WELCOME_SENT_PREFIX = "dead_set_welcome_sent_";

const maybeSendWelcomeEmail = async (user: User) => {
  const provider = user.app_metadata?.provider;
  if (!provider || provider === "email") return;

  const key = `${WELCOME_SENT_PREFIX}${user.id}`;
  if (localStorage.getItem(key)) return;

  // Allow up to 5 minutes for OAuth redirects to complete
  const createdAt = new Date(user.created_at).getTime();
  if (Date.now() - createdAt > 300_000) return;

  try {
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "welcome-email",
        recipientEmail: user.email,
        idempotencyKey: `welcome-${user.id}`,
        templateData: {
          displayName: user.user_metadata?.full_name || user.email?.split("@")[0] || "Deadhead",
        },
      },
    });
    // Only mark as sent after successful invocation
    localStorage.setItem(key, "1");
  } catch {
    // Don't set the flag so it retries next sign-in
  }
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const didInit = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        sessionStorage.setItem(SESSION_FLAG, "1");
        if (session?.user) {
          maybeSendWelcomeEmail(session.user);
        }
      }
      if (event === "SIGNED_OUT") {
        sessionStorage.removeItem(SESSION_FLAG);
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

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
