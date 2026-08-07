import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { setActiveSessionFlag } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import PageLayout from "@/components/PageLayout";
import StealYourFace from "@/components/StealYourFace";


const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase will auto-exchange the recovery token from the URL hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    // Also check if already in a recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setActiveSessionFlag();
      toast.success("Password updated! You're all set.");
      navigate("/builder");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-3">
            <StealYourFace size={80} />
            <h1 className="font-display text-4xl text-primary">Dead-Set.Org</h1>
            <p className="font-hand text-xl text-foreground/85">
              Pick a new password.
            </p>
          </div>

          {ready ? (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="font-body text-foreground">
                  New Password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-card/80 backdrop-blur-sm border-border text-card-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="font-body text-foreground">
                  Confirm Password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-card/80 backdrop-blur-sm border-border text-card-foreground"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-body"
                disabled={loading}
              >
                {loading ? "..." : "Update Password"}
              </Button>
            </form>
          ) : (
            <p className="text-center text-foreground/75 font-body">
              Loading your reset session...
            </p>
          )}

          <div className="flex flex-col items-center">
            <button
              onClick={() => navigate("/")}
              className="font-mono text-[10px] text-foreground/60 hover:text-foreground tracking-widest uppercase transition-colors"
            >
              ← Back to Dead Set
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default ResetPassword;
