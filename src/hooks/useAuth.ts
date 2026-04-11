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
  localStorage.setItem(key, "1");

  // Only send for users created in the last 60s (new signups, not returning logins)
  const createdAt = new Date(user.created_at).getTime();
  if (Date.now() - createdAt > 60_000) return;

  const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "Deadhead";
  await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "welcome-email",
      recipientEmail: user.email,
      idempotencyKey: `welcome-${user.id}`,
      templateData: { displayName },
    },
  }).catch(() => {});
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
