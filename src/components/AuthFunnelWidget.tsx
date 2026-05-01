import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AuthFunnelWidgetProps {
  enabled: boolean;
}

type EventRow = {
  event_name: string;
  visitor_id: string | null;
  provider: string | null;
  created_at: string;
};

type FunnelStep = {
  key: string;
  label: string;
  visitors: number;
};

const PROVIDERS: Array<"email" | "google" | "apple"> = ["email", "google", "apple"];

const uniqueVisitors = (rows: EventRow[]): number => {
  const set = new Set<string>();
  for (const r of rows) if (r.visitor_id) set.add(r.visitor_id);
  return set.size;
};

const buildFunnel = (events: EventRow[]): {
  total: FunnelStep[];
  byProvider: Record<string, FunnelStep[]>;
} => {
  const opened = events.filter((e) => e.event_name === "auth_modal_opened");

  // Per-provider funnels
  const byProvider: Record<string, FunnelStep[]> = {};

  // Email funnel
  const emailAttempt = events.filter(
    (e) => e.event_name === "signup_email_attempted" || e.event_name === "signin_email_attempted",
  );
  const emailSignupAttempt = events.filter((e) => e.event_name === "signup_email_attempted");
  const emailSignupSuccess = events.filter((e) => e.event_name === "signup_email_succeeded");
  const emailNeedsConfirm = events.filter((e) => e.event_name === "signup_email_needs_confirmation");
  const emailFailed = events.filter((e) => e.event_name === "signup_email_failed");
  const emailConfirmed = events.filter(
    (e) => e.event_name === "email_confirmed" && (e.provider === "email" || !e.provider),
  );

  byProvider.email = [
    { key: "opened", label: "Opened auth modal", visitors: uniqueVisitors(opened) },
    { key: "attempted", label: "Submitted email form", visitors: uniqueVisitors(emailAttempt) },
    { key: "signup_attempt", label: "Tried to sign up", visitors: uniqueVisitors(emailSignupAttempt) },
    { key: "needs_confirm", label: "Sent confirmation email", visitors: uniqueVisitors(emailNeedsConfirm) },
    { key: "confirmed", label: "Confirmed email link", visitors: uniqueVisitors(emailConfirmed) },
    { key: "succeeded", label: "Signed in (no confirm)", visitors: uniqueVisitors(emailSignupSuccess) },
    { key: "failed", label: "Failed (errors)", visitors: uniqueVisitors(emailFailed) },
  ];

  // Google + Apple funnels
  for (const provider of ["google", "apple"] as const) {
    const redirected = events.filter(
      (e) => e.event_name === "oauth_redirect_started" && e.provider === provider,
    );
    const returned = events.filter(
      (e) => e.event_name === "oauth_returned" && e.provider === provider,
    );
    byProvider[provider] = [
      { key: "opened", label: "Opened auth modal", visitors: uniqueVisitors(opened) },
      { key: "redirected", label: `Clicked ${provider}`, visitors: uniqueVisitors(redirected) },
      { key: "returned", label: "Returned signed in", visitors: uniqueVisitors(returned) },
    ];
  }

  // Total summary
  const allSuccess = events.filter(
    (e) =>
      e.event_name === "signup_email_succeeded" ||
      e.event_name === "email_confirmed" ||
      e.event_name === "oauth_returned",
  );
  const total: FunnelStep[] = [
    { key: "opened", label: "Opened auth modal", visitors: uniqueVisitors(opened) },
    {
      key: "engaged",
      label: "Took an action",
      visitors: uniqueVisitors([
        ...emailAttempt,
        ...events.filter((e) => e.event_name === "oauth_redirect_started"),
      ]),
    },
    { key: "succeeded", label: "Reached signed-in state", visitors: uniqueVisitors(allSuccess) },
  ];

  return { total, byProvider };
};

const StepBar = ({
  step,
  max,
  prev,
}: {
  step: FunnelStep;
  max: number;
  prev: number | null;
}) => {
  const pct = max > 0 ? (step.visitors / max) * 100 : 0;
  const dropPct = prev != null && prev > 0 ? ((prev - step.visitors) / prev) * 100 : null;
  const isDrop = dropPct != null && dropPct > 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-body text-foreground/90">{step.label}</span>
        <span className="text-sm font-body tabular-nums text-foreground">
          {step.visitors}
          {isDrop && (
            <span className="ml-2 text-muted-foreground">
              −{Math.round(dropPct!)}%
            </span>
          )}
        </span>
      </div>
      <div className="h-2 bg-muted/40 rounded-md overflow-hidden">
        <div
          className="h-full bg-primary/80 rounded-md transition-all"
          style={{ width: `${Math.max(pct, step.visitors > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  );
};

const FunnelSection = ({
  title,
  steps,
}: {
  title: string;
  steps: FunnelStep[];
}) => {
  const max = Math.max(...steps.map((s) => s.visitors), 1);
  return (
    <div className="space-y-3">
      <h3 className="font-display text-base text-foreground">{title}</h3>
      <div className="space-y-2.5">
        {steps.map((step, i) => (
          <StepBar
            key={step.key}
            step={step}
            max={max}
            prev={i > 0 ? steps[i - 1].visitors : null}
          />
        ))}
      </div>
    </div>
  );
};

const AuthFunnelWidget = ({ enabled }: AuthFunnelWidgetProps) => {
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("auth_events")
        .select("event_name, visitor_id, provider, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setEvents([]);
        return;
      }
      setEvents((data ?? []) as EventRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const funnel = useMemo(() => (events ? buildFunnel(events) : null), [events]);

  if (!enabled) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-foreground">Sign-up Funnel</h2>
          <p className="text-sm font-body text-muted-foreground mt-0.5">
            Unique visitors per step · last 7 days
          </p>
        </div>
        {events && (
          <span className="text-sm font-body text-muted-foreground tabular-nums">
            {events.length} events
          </span>
        )}
      </div>

      {error && (
        <p className="text-sm font-body text-destructive">Failed to load: {error}</p>
      )}

      {!events ? (
        <p className="text-sm font-body text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-sm font-body text-muted-foreground">
          No auth events recorded in the last 7 days yet. Once visitors interact with the auth modal,
          steps will appear here.
        </p>
      ) : (
        funnel && (
          <div className="space-y-8">
            <FunnelSection title="Overall" steps={funnel.total} />
            <div className="grid gap-6 md:grid-cols-3">
              {PROVIDERS.map((p) => (
                <FunnelSection
                  key={p}
                  title={p === "email" ? "Email" : p === "google" ? "Google" : "Apple"}
                  steps={funnel.byProvider[p]}
                />
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default AuthFunnelWidget;
