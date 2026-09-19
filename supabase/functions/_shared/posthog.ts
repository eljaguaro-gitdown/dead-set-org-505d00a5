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

  const posthog = new PostHog(projectToken, { host });
  posthog.capture({ distinctId, event, properties });
  await posthog.shutdown();
};
