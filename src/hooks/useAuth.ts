import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { markConversion } from "@/lib/abTest";
import { trackAuthEvent, consumePendingOAuth } from "@/lib/authFunnel";

const SESSION_FLAG = "dead_set_active_session";

type AuthSnapshot = {
  user: User | null;
  loading: boolean;
};

// Welcome and admin-notification emails are now sent server-side via a
// database trigger on auth.users (handle_new_user_emails). No client-side
// dispatch is needed — every signup reliably fires both emails regardless
// of provider or page lifecycle timing.

let authSnapshot: AuthSnapshot = {
  user: null,
  loading: true,
};

let isInitialized = false;
let initPromise: Promise<void> | null = null;
const listeners = new Set<(snapshot: AuthSnapshot) => void>();

const emitSnapshot = () => {
  listeners.forEach((listener) => listener(authSnapshot));
};

const setSnapshot = (next: AuthSnapshot) => {
  authSnapshot = next;
  emitSnapshot();
};

const isOAuthReturn = () => {
  if (typeof window === "undefined") return false;

  return (
    window.location.hash.includes("access_token") ||
    window.location.hash.includes("refresh_token") ||
    new URLSearchParams(window.location.search).has("code")
  );
};

const setActiveSessionFlag = () => {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_FLAG, "1");
};

const clearActiveSessionFlag = () => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_FLAG);
};

const hasActiveSessionFlag = () => {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(SESSION_FLAG) === "1";
};

const ensureAuthInitialized = () => {
  if (isInitialized) return Promise.resolve();
  if (initPromise) return initPromise;

  if (typeof window === "undefined") {
    isInitialized = true;
    return Promise.resolve();
  }

  if (isOAuthReturn()) {
    setActiveSessionFlag();
  }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
      if (session) {
        setActiveSessionFlag();
      }

      if (event === "SIGNED_IN" && session?.user) {
        markConversion(session.user.id);

        // Funnel instrumentation: detect what kind of sign-in this was
        const pendingOAuth = consumePendingOAuth();
        const createdAt = session.user.created_at
          ? new Date(session.user.created_at).getTime()
          : 0;
        const confirmedAt = (session.user as any).email_confirmed_at
          ? new Date((session.user as any).email_confirmed_at).getTime()
          : 0;
        const isFreshAccount = createdAt > 0 && Date.now() - createdAt < 60_000;

        if (pendingOAuth) {
          void trackAuthEvent("oauth_returned", {
            provider: pendingOAuth,
            userId: session.user.id,
            metadata: { isFreshAccount },
          });
        }
        if (confirmedAt > 0 && Date.now() - confirmedAt < 60_000) {
          void trackAuthEvent("email_confirmed", {
            provider: pendingOAuth ?? "email",
            userId: session.user.id,
          });
        }

        // Link this signup to its visitor attribution (Lovable referral tracking, etc.)
        const visitorId = typeof window !== "undefined"
          ? localStorage.getItem("ds_visitor_id")
          : null;
        if (visitorId) {
          supabase.rpc("link_visitor_to_user", { _visitor_id: visitorId }).then(
            () => null,
            () => null,
          );
        }
      }
    }

    if (event === "SIGNED_OUT") {
      clearActiveSessionFlag();
    }

    setSnapshot({
      user: session?.user ?? null,
      loading: false,
    });
  });

  initPromise = supabase.auth
    .getSession()
    .then(async ({ data: { session } }) => {
      if (session && !hasActiveSessionFlag() && !isOAuthReturn()) {
        await supabase.auth.signOut();
        setSnapshot({ user: null, loading: false });
        return;
      }

      setSnapshot({
        user: session?.user ?? null,
        loading: false,
      });
    })
    .catch(() => {
      setSnapshot({ user: null, loading: false });
    })
    .finally(() => {
      isInitialized = true;
    });

  return initPromise;
};

const signOut = async () => {
  clearActiveSessionFlag();
  await supabase.auth.signOut();
};

export const useAuth = () => {
  const [snapshot, setLocalSnapshot] = useState(authSnapshot);

  useEffect(() => {
    const listener = (next: AuthSnapshot) => setLocalSnapshot(next);
    listeners.add(listener);

    ensureAuthInitialized();

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    user: snapshot.user,
    loading: snapshot.loading,
    signOut,
  };
};
