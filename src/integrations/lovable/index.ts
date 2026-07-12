// Auth via Lovable Cloud's OAuth gateway. The SDK redirects the browser to
// `${origin}/~oauth/initiate`; after migrating hosting to Netlify, that path is
// re-pointed at Lovable's still-published gateway via a redirect in netlify.toml
// (`/~oauth/*` -> dead-set-org.lovable.app). This keeps social login working
// without standing up our own Google OAuth client. (Temporary — revisit to move
// fully onto native Supabase OAuth + our own Google/Apple credentials.)

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
