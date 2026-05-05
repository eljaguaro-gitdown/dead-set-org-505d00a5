import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trackAuthEvent, markOAuthRedirect } from "@/lib/authFunnel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: () => void;
  /** Called right before an OAuth redirect so the caller can persist state */
  onBeforeRedirect?: () => void;
}

const SESSION_FLAG = "dead_set_active_session";

const AuthModal = ({ open, onOpenChange, onAuthenticated, onBeforeRedirect }: AuthModalProps) => {
  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) void trackAuthEvent("auth_modal_opened");
  }, [open]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    void trackAuthEvent(
      isSignUp ? "signup_email_attempted" : "signin_email_attempted",
      { provider: "email" },
    );
    try {
      if (isSignUp) {
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
        if (data.session) {
          sessionStorage.setItem(SESSION_FLAG, "1");
          void trackAuthEvent("signup_email_succeeded", {
            provider: "email",
            userId: data.user?.id ?? null,
          });
          onOpenChange(false);
          onAuthenticated();
        } else {
          void trackAuthEvent("signup_email_needs_confirmation", {
            provider: "email",
            userId: data.user?.id ?? null,
          });
          toast.success("Check your email to confirm your account!");
        }
      } else {
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.session) {
          sessionStorage.setItem(SESSION_FLAG, "1");
        }
        void trackAuthEvent("signin_email_succeeded", {
          provider: "email",
          userId: data.user?.id ?? null,
        });
        onOpenChange(false);
        onAuthenticated();
      }
    } catch (err: any) {
      void trackAuthEvent(
        isSignUp ? "signup_email_failed" : "signin_email_failed",
        { provider: "email", metadata: { message: err?.message } },
      );
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    onBeforeRedirect?.();
    markOAuthRedirect("google");
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/builder`,
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-card border-border rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader className="text-center pb-2">
          <SheetTitle className="font-display text-2xl text-foreground">
            {isSignUp ? "Create your account" : "Welcome back"}
          </SheetTitle>
          <SheetDescription className="font-body text-muted-foreground">
            {isSignUp
              ? "Join the community — it's free."
              : "Sign in to pick up where you left off."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 pt-4 max-w-sm mx-auto">
          {/* Toggle: prominent tab-style switcher */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2.5 text-sm font-body font-medium transition-colors ${
                isSignUp
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              🎟️ New here? Sign up
            </button>
            <button
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2.5 text-sm font-body font-medium transition-colors ${
                !isSignUp
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign in
            </button>
          </div>

          {/* Google OAuth */}
          <Button
            variant="outline"
            className="w-full border-border text-foreground hover:bg-muted font-body gap-2 py-6 text-base"
            onClick={handleGoogleLogin}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>

          {/* Apple OAuth */}
          <Button
            variant="outline"
            className="w-full border-border text-foreground hover:bg-muted font-body gap-2 py-6 text-base"
            onClick={handleAppleLogin}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Continue with Apple
          </Button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground font-body">
              or use email
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Email/password */}
          <form onSubmit={handleAuth} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="auth-email" className="font-body text-foreground text-sm">
                Email
              </Label>
              <Input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-card/80 backdrop-blur-sm border-border text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-password" className="font-body text-foreground text-sm">
                Password
              </Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-card/80 backdrop-blur-sm border-border text-foreground"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-body"
              disabled={loading}
            >
              {loading ? "..." : isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>

          <div className="pb-4" />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AuthModal;
