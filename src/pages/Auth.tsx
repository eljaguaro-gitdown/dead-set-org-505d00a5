import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import PageLayout from "@/components/PageLayout";
import StealYourFace from "@/components/StealYourFace";
import { getPostAuthRedirect } from "@/lib/postAuthRedirect";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const explicitRedirect = searchParams.get("redirect");
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const smartRedirect = async (userId: string) => {
    if (explicitRedirect) {
      navigate(explicitRedirect);
    } else {
      const path = await getPostAuthRedirect(userId);
      navigate(path);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email for a reset link!");
        setIsForgot(false);
      } else if (isSignUp) {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        // Send welcome email regardless of session
        if (data.user) {
          const displayName = data.user.user_metadata?.full_name || email.split("@")[0];
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "welcome-email",
              recipientEmail: email,
              idempotencyKey: `welcome-${data.user.id}`,
              templateData: { displayName },
            },
          }).catch(() => {});
          // Notify admin of new signup
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "new-signup-notification",
              recipientEmail: "grateful_jaguaro@dead-set.org",
              idempotencyKey: `new-signup-notify-${data.user.id}`,
              templateData: {
                userEmail: email,
                displayName,
                provider: "email",
                signupTime: data.user.created_at,
              },
            },
          }).catch(() => {});
        }
        if (data.session && data.session.user) {
          await smartRedirect(data.session.user.id);
        } else {
          toast.success("Check your email to confirm your account!");
        }
      } else {
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session?.user) {
          await smartRedirect(data.session.user.id);
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error(error.message);
  };

  const handleAppleLogin = async () => {
    const { error } = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (error) toast.error(error.message);
  };

  return (
    <PageLayout>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-3">
            <StealYourFace size={80} />
            <h1 className="font-display text-4xl text-primary">Dead-Set.Org</h1>
            <p className="font-hand text-xl text-muted-foreground">
              {isForgot ? "We'll get you back in." : isSignUp ? "Come on in. There's room." : "The music never stopped."}
            </p>
            <p className="font-body text-sm text-muted-foreground/70">
              {isForgot ? "Enter your email to reset your password" : isSignUp ? "Create your account" : "Sign in to your setlists"}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-body text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-card/80 backdrop-blur-sm border-border text-foreground"
              />
            </div>
            {!isForgot && (
              <div className="space-y-2">
                <Label htmlFor="password" className="font-body text-foreground">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-card/80 backdrop-blur-sm border-border text-foreground"
                />
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-body"
              disabled={loading}
            >
              {loading ? "..." : isForgot ? "Send Reset Link" : isSignUp ? "Sign Up" : "Sign In"}
            </Button>
            {!isSignUp && !isForgot && (
              <button
                type="button"
                onClick={() => setIsForgot(true)}
                className="w-full text-center text-sm text-muted-foreground hover:text-primary font-body transition-colors"
              >
                Forgot your password?
              </button>
            )}
          </form>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10px] text-muted-foreground/50 tracking-widest uppercase">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full border-border text-foreground hover:bg-muted font-body gap-2"
              onClick={handleGoogleLogin}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </Button>

            <Button
              variant="outline"
              className="w-full border-border text-foreground hover:bg-muted font-body gap-2"
              onClick={handleAppleLogin}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Continue with Apple
            </Button>
          </div>

          <div className="flex flex-col items-center gap-3">
            <p className="text-center text-sm text-muted-foreground font-body">
              {isForgot ? (
                <button
                  onClick={() => setIsForgot(false)}
                  className="text-primary hover:underline"
                >
                  Back to sign in
                </button>
              ) : (
                <>
                  {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                  <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-primary hover:underline"
                  >
                    {isSignUp ? "Sign in" : "Sign up"}
                  </button>
                </>
              )}
            </p>
            <button
              onClick={() => navigate("/")}
              className="font-mono text-[10px] text-muted-foreground/40 hover:text-muted-foreground tracking-widest uppercase transition-colors"
            >
              ← Back to Dead-Set.Org
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Auth;
