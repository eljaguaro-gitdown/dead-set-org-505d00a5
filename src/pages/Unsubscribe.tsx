import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import StealYourFace from "@/components/StealYourFace";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const kind = searchParams.get("kind") === "dispatch" ? "dispatch" : "email";
  const fnName =
    kind === "dispatch" ? "handle-dispatch-unsubscribe" : "handle-email-unsubscribe";
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/${fnName}?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      })
      .catch(() => setStatus("error"));
  }, [token, fnName]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke(fnName, {
        body: { token },
      });
      if (data?.success) {
        // Fire PostHog dispatch_unsubscribed only for dispatch flow.
        if (kind === "dispatch" && typeof window !== "undefined") {
          const ph = (window as any).posthog;
          try {
            ph?.capture?.("dispatch_unsubscribed", {
              dispatch_id: searchParams.get("dispatch_id") ?? null,
              user_id: data?.user_id ?? null,
            });
          } catch {
            /* ignore */
          }
        }
        setStatus("success");
      } else if (data?.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <PageLayout>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-6">
          <StealYourFace size={64} />
          {status === "loading" && (
            <p className="font-body text-muted-foreground">Checking your request…</p>
          )}
          {status === "valid" && (
            <>
              <h1 className="font-display text-2xl text-foreground">Unsubscribe</h1>
              <p className="font-body text-muted-foreground">
                You'll stop receiving app emails from Dead-Set.Org. Auth emails (password resets, etc.) are not affected.
              </p>
              <Button onClick={handleUnsubscribe} disabled={processing} className="w-full">
                {processing ? "Processing…" : "Confirm Unsubscribe"}
              </Button>
            </>
          )}
          {status === "success" && (
            <>
              <h1 className="font-display text-2xl text-foreground">You're unsubscribed</h1>
              <p className="font-body text-muted-foreground">
                We won't send you any more app emails. The music never stopped — but the emails did. ⚡
              </p>
            </>
          )}
          {status === "already" && (
            <>
              <h1 className="font-display text-2xl text-foreground">Already unsubscribed</h1>
              <p className="font-body text-muted-foreground">
                You've already unsubscribed from app emails.
              </p>
            </>
          )}
          {status === "invalid" && (
            <>
              <h1 className="font-display text-2xl text-foreground">Invalid link</h1>
              <p className="font-body text-muted-foreground">
                This unsubscribe link is invalid or expired.
              </p>
            </>
          )}
          {status === "error" && (
            <>
              <h1 className="font-display text-2xl text-foreground">Something went wrong</h1>
              <p className="font-body text-muted-foreground">
                We couldn't process your request. Please try again later.
              </p>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default Unsubscribe;
