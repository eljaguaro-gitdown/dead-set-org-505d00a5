import { supabase } from "@/integrations/supabase/client";

/**
 * Determines the best post-auth redirect for a user.
 * First-time users (0 setlists) → /builder (AI welcome overlay)
 * Returning users (1+ setlists) → /my-setlists
 */
export const getPostAuthRedirect = async (userId: string): Promise<string> => {
  const { count } = await supabase
    .from("setlists")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", userId);

  return (count && count > 0) ? "/my-setlists" : "/builder?wizard=true";
};
