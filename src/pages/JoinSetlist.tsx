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
      navigate(`/auth?redirect=/join/${token}`);
      return;
    }
    if (!token) {
      setError("Invalid link");
      return;
    }

    const join = async () => {
      setJoining(true);

      const { data, error: invokeError } = await supabase.functions.invoke("join-setlist", {
        body: { token },
      });

      if (invokeError || !data?.setlist_id) {
        setError(data?.error || "Unable to join. The link may be invalid.");
        setJoining(false);
        return;
      }

      if (data.already_owner || data.already_member) {
        navigate(`/builder/${data.setlist_id}`);
        return;
      }

      toast.success(`Joined "${data.title}"!`);
      navigate(`/builder/${data.setlist_id}`);
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
