import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import StealYourFace from "@/components/StealYourFace";
import { getPostAuthRedirect } from "@/lib/postAuthRedirect";
import { detectInAppBrowser } from "@/lib/inAppBrowser";
import { trackAuthEvent, markOAuthRedirect } from "@/lib/authFunnel";

const SESSION_FLAG = "dead_set_active_session";

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const explicitRedirect = searchParams.get("redirect");
  const [isSignUp, setIsSignUp] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { isInApp, appName } = useMemo(() => detectInAppBrowser(), []);

  useEffect(() => {
    void trackAuthEvent("auth_modal_opened", { metadata: { surface: "auth_page" } });
  }, []);

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
        void trackAuthEvent("signup_email_attempted", { provider: "email" });
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) {
          void trackAuthEvent("signup_email_failed", {
            provider: "email",
            metadata: { message: error.message },
          });
          throw error;
        }
        // Welcome + admin notification emails are sent server-side by the
        // handle_new_user_emails trigger on auth.users — no client dispatch needed.
        if (data.session && data.session.user) {
          void trackAuthEvent("signup_email_succeeded", {
            provider: "email",
            userId: data.session.user.id,
          });
          sessionStorage.setItem(SESSION_FLAG, "1");
          await smartRedirect(data.session.user.id);
        } else {
          void trackAuthEvent("signup_email_needs_confirmation", {
            provider: "email",
            userId: data.user?.id ?? null,
          });
          toast.success("Check your email to confirm your account!");
        }
      } else {
        void trackAuthEvent("signin_email_attempted", { provider: "email" });
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          void trackAuthEvent("signin_email_failed", {
            provider: "email",
            metadata: { message: error.message },
          });
          throw error;
        }
        if (data.session?.user) {
          void trackAuthEvent("signin_email_succeeded", {
            provider: "email",
            userId: data.session.user.id,
          });
          sessionStorage.setItem(SESSION_FLAG, "1");
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
    if (isInApp) {
      toast.error(
        `Google sign-in doesn't work inside ${appName}. Tap the ⋯ menu and choose "Open in Safari" — or use email below.`,
        { duration: 7000 }
      );
      return;
    }
    markOAuthRedirect("google");
    sessionStorage.setItem("post_oauth_redirect", "1");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
  };

  const handleAppleLogin = async () => {
    toast.error(
      "Apple sign-in is temporarily unavailable. Please use Google or email/password instead.",
      { duration: 7000 }
    );
  };

  return (
    <PageLayout>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center gap-3">
            <StealYourFace size={80} />
            <h1 className="font-display text-4xl text-primary">Dead-Set.Org</h1>
            <p className="font-hand text-xl text-foreground/85">
              {isForgot ? "We'll get you back in." : isSignUp ? "Come on in. There's room." : "Welcome back."}
            </p>
            <p className="font-body text-sm text-foreground/75">
              {isForgot
                ? "Enter your email to reset your password"
                : isSignUp
                  ? "Create your free account — start building setlists in seconds."
                  : "Sign in to your setlists"}
            </p>
            {isSignUp && !isForgot && (
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="font-body text-sm text-foreground"
              >
                Already have an account?{" "}
                <span className="font-semibold text-dead-gold underline underline-offset-2">
                  Sign in
                </span>
              </button>
            )}
          </div>

          {isInApp && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-body text-sm text-foreground">
                  You're browsing inside {appName}
                </p>
                <p className="font-body text-xs text-foreground/75">
                  Google &amp; Apple sign-in won't work here. Tap <span className="font-mono">⋯</span> &rarr; <span className="text-foreground">Open in Safari</span>, or just use email below — it works everywhere.
                </p>
              </div>
            </div>
          )}

          {/* OAuth — one-tap, kept above the email form so the fastest path is first */}
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-12 text-base border-border/60 text-foreground/60 hover:bg-foreground/5 hover:text-foreground/60 hover:border-border/60 font-body gap-2"
              onClick={handleGoogleLogin}
              title="Google sign-in is temporarily unavailable — please use email/password"
              aria-label="Google sign-in temporarily unavailable"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
              <span className="ml-auto rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-dead-gold">
                Unavailable
              </span>
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 text-base border-border/60 text-foreground/60 hover:bg-foreground/5 hover:text-foreground/60 hover:border-border/60 font-body gap-2"
              onClick={handleAppleLogin}
              title="Apple sign-in is temporarily unavailable — please use Google or email/password"
              aria-label="Apple sign-in temporarily unavailable"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Continue with Apple
              <span className="ml-auto rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-dead-gold">
                Unavailable
              </span>
            </Button>

            <p className="text-center font-body text-xs text-foreground/70 pt-1">
              Google &amp; Apple sign-in are resting — email is wide open.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10px] text-foreground/70 tracking-widest uppercase">or use your email</span>
            <div className="h-px flex-1 bg-border" />
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
                className="h-12 text-base bg-card/80 backdrop-blur-sm border-border text-card-foreground"
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
                  className="h-12 text-base bg-card/80 backdrop-blur-sm border-border text-card-foreground"
                />
              </div>
            )}
            <Button
              type="submit"
              className="w-full h-12 text-base bg-primary text-primary-foreground hover:bg-primary/90 font-body"
              disabled={loading}
            >
              {loading ? "..." : isForgot ? "Send Reset Link" : isSignUp ? "Create my account" : "Sign In"}
            </Button>
            {!isSignUp && !isForgot && (
              <button
                type="button"
                onClick={() => setIsForgot(true)}
                className="w-full text-center text-sm text-foreground/70 hover:text-foreground font-body transition-colors"
              >
                Forgot your password?
              </button>
            )}
          </form>

          <div className="flex flex-col items-center gap-3">
            {isForgot ? (
              <button
                onClick={() => setIsForgot(false)}
                className="text-sm text-dead-gold hover:underline font-body"
              >
                Back to sign in
              </button>
            ) : isSignUp ? (
              <div className="w-full rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-2">
                <p className="font-body text-sm text-card-foreground">
                  Already have an account?
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full font-body border-primary/60 text-accent-foreground hover:bg-primary/10"
                  onClick={() => setIsSignUp(false)}
                >
                  Sign in instead
                </Button>
              </div>
            ) : (
              <p className="text-center text-sm text-foreground/75 font-body">
                New here?{" "}
                <button
                  onClick={() => setIsSignUp(true)}
                  className="text-dead-gold hover:underline font-semibold"
                >
                  Create a free account
                </button>
              </p>
            )}
            <button
              onClick={() => navigate("/")}
              className="font-mono text-[10px] text-foreground/60 hover:text-foreground tracking-widest uppercase transition-colors"
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
