import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import StealYourFace from "@/components/StealYourFace";

const JoinSetlist = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Redirect to auth, then back here
      navigate(`/auth?redirect=/join/${token}`);
      return;
    }
    if (!token) {
      setError("Invalid link");
      return;
    }

    const join = async () => {
      setJoining(true);
      // Find setlist by share token
      const { data: setlist, error: findError } = await supabase
        .from("setlists")
        .select("id, title, creator_id")
        .eq("share_token", token)
        .single();

      if (findError || !setlist) {
        setError("Setlist not found or invalid link");
        setJoining(false);
        return;
      }

      // If user is the creator, just redirect
      if (setlist.creator_id === user.id) {
        navigate(`/builder/${setlist.id}`);
        return;
      }

      // Check if already a collaborator
      const { data: existing } = await supabase
        .from("collaborators")
        .select("id")
        .eq("setlist_id", setlist.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        navigate(`/builder/${setlist.id}`);
        return;
      }

      // Add as collaborator — need the owner to add, so we use a workaround:
      // The setlist needs to be collaborative, and we insert via the owner's policy
      // Actually, let's update the setlist to be collaborative and make the insert work
      // We need to adjust the RLS or use a different approach

      // For now, let's make setlists with share tokens auto-accept
      // The insert policy requires the setlist owner to insert, so we need an edge case
      // Let's use the service role via an edge function instead
      // But for MVP, let's make the insert policy more permissive for shared setlists

      const { error: joinError } = await supabase.from("collaborators").insert({
        setlist_id: setlist.id,
        user_id: user.id,
        role: "editor",
      });

      if (joinError) {
        // If RLS blocks, show error
        setError("Unable to join. The setlist owner may need to add you.");
        setJoining(false);
        return;
      }

      toast.success(`Joined "${setlist.title}"!`);
      navigate(`/builder/${setlist.id}`);
    };

    join();
  }, [user, authLoading, token, navigate]);

  return (
    <div className="grain-overlay min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <StealYourFace size={80} />
        {joining && (
          <p className="font-body text-foreground animate-pulse">Joining setlist...</p>
        )}
        {error && (
          <div className="space-y-2">
            <p className="font-body text-primary">{error}</p>
            <button
              onClick={() => navigate("/")}
              className="font-body text-sm text-muted-foreground hover:text-foreground underline"
            >
              Go home
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinSetlist;
