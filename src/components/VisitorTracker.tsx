import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const getVisitorId = (): string => {
  const key = "ds_visitor_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
};

const VisitorTracker = () => {
  useEffect(() => {
    const track = async () => {
      const visitorId = getVisitorId();
      const pagePath = window.location.pathname;
      const referrer = document.referrer || null;
      const refParam = new URLSearchParams(window.location.search).get("ref");

      try {
        await supabase.functions.invoke("track-visit", {
          body: {
            visitor_id: visitorId,
            page_path: pagePath,
            user_agent: navigator.userAgent,
            referrer,
            ref_param: refParam,
          },
        });
      } catch {
        // Silently fail — analytics should never block UX
      }
    };

    track();
  }, []);

  return null;
};

export default VisitorTracker;
