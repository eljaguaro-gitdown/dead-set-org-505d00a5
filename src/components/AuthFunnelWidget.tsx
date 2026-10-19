import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The sign-in sheet, step by step: who opened it, who tried, who ended up
 * with a NEW account.
 *
 * Two things this used to get wrong (audited 2026-10-08):
 * - The owner was counted. Pre-sign-in events carry only a browser's
 *   visitor_id, and the owner's browsers were 3 of 6 people the funnel said
 *   had made it through. admin-users now names the internal accounts and every
 *   browser that has signed in to one, and both are excluded here.
 * - Sign-ins counted as sign-ups. `oauth_returned` fires on every Google or
 *   Apple return, and `email_confirmed` for a Google account fires on sign-in,
 *   so "Reached signed-in state" read 6 when 2 accounts were new. A new account
 *   is now: an email sign-up that succeeded or was confirmed, or an OAuth return
 *   flagged `isFreshAccount`. Existing members signing in are shown beside the
 *   funnel, not inside it.
 */

interface AuthFunnelWidgetProps {
  enabled: boolean;
  /** Internal accounts and the browsers that have signed in to them (from admin-users). */
  internalUserIds?: string[];
  internalVisitorIds?: string[];
}

export type AuthEventRow = {
  event_name: string;
  visitor_id: string | null;
  user_id?: string | null;
  provider: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
};

type FunnelStep = {
  key: string;
  label: string;
  visitors: number;
};

/** A count shown beside a funnel — an outcome, not a step, so no drop-off. */
type FunnelNote = { label: string; visitors: number };

type Section = { steps: FunnelStep[]; notes: FunnelNote[] };

const PROVIDERS: Array<"email" | "google" | "apple"> = ["email", "google", "apple"];

const uniqueVisitors = (rows: AuthEventRow[]): number => {
  const set = new Set<string>();
  for (const r of rows) if (r.visitor_id) set.add(r.visitor_id);
  return set.size;
};

const isFresh = (e: AuthEventRow) => e.metadata?.isFreshAccount === true;

/** Did this event create an account? */
export const isNewAccountEvent = (e: AuthEventRow): boolean =>
  e.event_name === "signup_email_succeeded" ||
  (e.event_name === "email_confirmed" && (e.provider === "email" || !e.provider)) ||
  (e.event_name === "oauth_returned" && isFresh(e));

/** Did an existing member sign in? */
const isExistingSignIn = (e: AuthEventRow): boolean =>
  e.event_name === "signin_email_succeeded" || (e.event_name === "oauth_returned" && !isFresh(e));

export const excludeInternal = (
  events: AuthEventRow[],
  internalUserIds: Iterable<string> = [],
  internalVisitorIds: Iterable<string> = [],
): AuthEventRow[] => {
  const users = new Set(internalUserIds);
  const visitors = new Set(internalVisitorIds);
  return events.filter(
    (e) => !(e.user_id && users.has(e.user_id)) && !(e.visitor_id && visitors.has(e.visitor_id)),
  );
};

export const buildFunnel = (events: AuthEventRow[]): {
  total: Section;
  byProvider: Record<string, Section>;
} => {
  const of = (name: string) => events.filter((e) => e.event_name === name);
  const opened = of("auth_modal_opened");
  const newAccounts = events.filter(isNewAccountEvent);

  const emailAttempt = events.filter(
    (e) => e.event_name === "signup_email_attempted" || e.event_name === "signin_email_attempted",
  );
  const emailNewAccounts = newAccounts.filter((e) => e.event_name !== "oauth_returned");

  const byProvider: Record<string, Section> = {
    email: {
      steps: [
        { key: "attempted", label: "Submitted the email form", visitors: uniqueVisitors(emailAttempt) },
        { key: "signup_attempt", label: "Tried to sign up", visitors: uniqueVisitors(of("signup_email_attempted")) },
        { key: "needs_confirm", label: "Sent a confirmation email", visitors: uniqueVisitors(of("signup_email_needs_confirmation")) },
        { key: "new", label: "New account", visitors: uniqueVisitors(emailNewAccounts) },
      ],
      notes: [
        { label: "Hit a sign-up error", visitors: uniqueVisitors(of("signup_email_failed")) },
        { label: "Existing members signed in", visitors: uniqueVisitors(of("signin_email_succeeded")) },
      ],
    },
  };

  for (const provider of ["google", "apple"] as const) {
    const mine = events.filter((e) => e.provider === provider);
    const returned = mine.filter((e) => e.event_name === "oauth_returned");
    byProvider[provider] = {
      steps: [
        { key: "redirected", label: `Chose ${provider === "google" ? "Google" : "Apple"}`, visitors: uniqueVisitors(mine.filter((e) => e.event_name === "oauth_redirect_started")) },
        { key: "returned", label: "Came back signed in", visitors: uniqueVisitors(returned) },
        { key: "new", label: "New account", visitors: uniqueVisitors(returned.filter(isFresh)) },
      ],
      notes: [],
    };
  }

  const total: Section = {
    steps: [
      { key: "opened", label: "Opened the sign-in sheet", visitors: uniqueVisitors(opened) },
      {
        key: "engaged",
        label: "Took an action",
        visitors: uniqueVisitors([...emailAttempt, ...of("oauth_redirect_started")]),
      },
      { key: "new", label: "New account", visitors: uniqueVisitors(newAccounts) },
    ],
    notes: [{ label: "Existing members signed in", visitors: uniqueVisitors(events.filter(isExistingSignIn)) }],
  };

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
        <span className="text-sm font-body text-card-foreground/90">{step.label}</span>
        <span className="text-sm font-body tabular-nums text-card-foreground">
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

const FunnelSection = ({ title, section }: { title: string; section: Section }) => {
  const max = Math.max(...section.steps.map((s) => s.visitors), 1);
  return (
    <div className="space-y-3">
      <h3 className="font-display text-base text-card-foreground">{title}</h3>
      <div className="space-y-2.5">
        {section.steps.map((step, i) => (
          <StepBar
            key={step.key}
            step={step}
            max={max}
            prev={i > 0 ? section.steps[i - 1].visitors : null}
          />
        ))}
      </div>
      {section.notes.length > 0 && (
        <ul className="space-y-1 pt-1 border-t border-border/50">
          {section.notes.map((n) => (
            <li key={n.label} className="flex justify-between text-xs font-body text-muted-foreground tabular-nums">
              <span>{n.label}</span>
              <span>{n.visitors}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const AuthFunnelWidget = ({ enabled, internalUserIds, internalVisitorIds }: AuthFunnelWidgetProps) => {
  const [rawEvents, setRawEvents] = useState<AuthEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("auth_events")
        .select("event_name, visitor_id, user_id, provider, metadata, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setRawEvents([]);
        return;
      }
      setRawEvents((data ?? []) as AuthEventRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const events = useMemo(
    () => (rawEvents ? excludeInternal(rawEvents, internalUserIds, internalVisitorIds) : null),
    [rawEvents, internalUserIds, internalVisitorIds],
  );
  const funnel = useMemo(() => (events ? buildFunnel(events) : null), [events]);
  const excluded = rawEvents && events ? rawEvents.length - events.length : 0;

  if (!enabled) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-card-foreground">Sign-up Funnel</h2>
          <p className="text-sm font-body text-muted-foreground mt-0.5">
            Unique browsers per step · last 7 days · your accounts and devices excluded
          </p>
        </div>
        {events && (
          <span className="text-sm font-body text-muted-foreground tabular-nums">
            {events.length} events{excluded > 0 ? ` (${excluded} of yours left out)` : ""}
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
          No sign-in activity from outside visitors in the last 7 days.
        </p>
      ) : (
        funnel && (
          <div className="space-y-8">
            <FunnelSection title="Overall" section={funnel.total} />
            <div className="grid gap-6 md:grid-cols-3">
              {PROVIDERS.map((p) => (
                <FunnelSection
                  key={p}
                  title={p === "email" ? "Email" : p === "google" ? "Google" : "Apple"}
                  section={funnel.byProvider[p]}
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
