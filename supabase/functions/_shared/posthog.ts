import { PostHog } from "npm:posthog-node";

export const captureServerEvent = async ({
  distinctId,
  event,
  properties,
}: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}) => {
  const projectToken = Deno.env.get("POSTHOG_PROJECT_TOKEN");
  const host = Deno.env.get("POSTHOG_HOST");

  if (!projectToken || !host) {
    console.error("PostHog server environment is missing; analytics event was not sent");
    return;
  }

  // Never throw. Callers await this after the real work has already
  // committed — the account is deleted, the setlist is joined — and they sit
  // inside the handler's outer try. An unhandled throw here would return a 500
  // for an operation that actually succeeded, telling someone their account
  // deletion failed when it did not, and inviting a retry.
  try {
    const posthog = new PostHog(projectToken, { host });
    posthog.capture({ distinctId, event, properties });
    await posthog.shutdown();
  } catch (e) {
    console.error("PostHog server event failed; continuing:", e instanceof Error ? e.message : e);
  }
};
