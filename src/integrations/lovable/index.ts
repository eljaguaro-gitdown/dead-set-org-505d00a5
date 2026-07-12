// Auth via Lovable Cloud's OAuth gateway. Lovable hosting serves
// `/~oauth/*` natively on both the *.lovable.app domain and the custom
// domain (dead-set.org / www.dead-set.org), so the SDK's same-origin default
// works everywhere. The flow is a same-origin popup + `web_message`
// handshake: opener and popup must share an origin for the postMessage that
// hands tokens back, so do NOT set an `oauthBrokerUrl` pointing at a
// different host — that creates a cross-origin popup and the tokens are
// silently dropped (blank return page).

import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "../supabase/client";
const lovableAuth = createLovableAuth();


type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple" | "microsoft",
      opts?: SignInOptions,
    ) => {
      const result = await lovableAuth.signInWithOAuth(provider, {
        redirect_uri: opts?.redirect_uri,
        extraParams: {
          ...opts?.extraParams,
        },
      });

      if (result.redirected) {
        return result;
      }

      if (result.error) {
        return result;
      }

      try {
        await supabase.auth.setSession(result.tokens);
      } catch (e) {
        return { error: e instanceof Error ? e : new Error(String(e)) };
      }
      return result;
    },
  },
};
