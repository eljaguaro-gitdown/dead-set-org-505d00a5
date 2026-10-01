import { useCallback, useState } from "react";
import { toast } from "sonner";

// App Store guideline 1.2: users must agree to terms that make clear there is
// no tolerance for objectionable content or abusive users, and the agreement
// must be presented before registering or logging in. A passive "by
// continuing you agree" line under the buttons did not count — the app was
// rejected with it in place (2026-09-30).
//
// Remembered per device so a returning fan is not asked every time. The key
// carries the Terms' date: when the Terms change materially, change the key
// and everyone agrees again.
export const TERMS_VERSION = "2026-09-30";
const STORAGE_KEY = `deadset.termsAgreed.${TERMS_VERSION}`;

const readAgreed = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

export const useTermsAgreement = () => {
  const [agreed, setAgreedState] = useState(readAgreed);
  const [nudged, setNudged] = useState(false);

  const setAgreed = useCallback((value: boolean) => {
    setAgreedState(value);
    if (value) setNudged(false);
    try {
      if (value) localStorage.setItem(STORAGE_KEY, "1");
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage blocked: the agreement still holds for this visit.
    }
  }, []);

  /** Call before any sign-in or sign-up. True when agreed; otherwise flags the box and says why. */
  const requireAgreement = useCallback((): boolean => {
    if (agreed) return true;
    setNudged(true);
    toast.error("Tick the box to agree to the Terms of Use first.");
    return false;
  }, [agreed]);

  return { agreed, setAgreed, nudged, requireAgreement };
};
