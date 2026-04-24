import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";

const STORAGE_KEY = "dead_set_home_base";
const HOME_BASE_PATH = "/my-setlists";
const EVENT = "dead-set:home-base-changed";

/**
 * Tracks the user's "home base" — the contextual page they were working in.
 * Currently scoped to /my-setlists. When the user visits that page, it's
 * recorded for the session so we can offer a one-click return from elsewhere.
 */
export const useHomeBase = () => {
  const location = useLocation();
  const [homeBase, setHomeBase] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(STORAGE_KEY);
  });

  // Record when the user lands on the home-base page
  useEffect(() => {
    if (location.pathname === HOME_BASE_PATH) {
      sessionStorage.setItem(STORAGE_KEY, HOME_BASE_PATH);
      setHomeBase(HOME_BASE_PATH);
      window.dispatchEvent(new Event(EVENT));
    }
  }, [location.pathname]);

  // Listen for cross-component updates
  useEffect(() => {
    const sync = () => setHomeBase(sessionStorage.getItem(STORAGE_KEY));
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const clearHomeBase = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setHomeBase(null);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const isOnHomeBase = location.pathname === HOME_BASE_PATH;
  const shouldShowReturn = !!homeBase && !isOnHomeBase;

  return { homeBase, isOnHomeBase, shouldShowReturn, clearHomeBase };
};
