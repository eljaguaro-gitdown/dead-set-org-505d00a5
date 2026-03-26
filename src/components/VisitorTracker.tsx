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

      await supabase.from("page_visits").insert({
        visitor_id: visitorId,
        page_path: pagePath,
        user_agent: navigator.userAgent,
      });
    };

    track();
  }, []);

  return null;
};

export default VisitorTracker;
