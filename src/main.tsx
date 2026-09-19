import { createRoot } from "react-dom/client";
import { PostHogProvider } from "@posthog/react";
import App from "./App.tsx";
import { initializePostHog, posthogClient } from "./lib/posthog";
import "./index.css";

initializePostHog();

createRoot(document.getElementById("root")!).render(
  <PostHogProvider client={posthogClient}>
    <App />
  </PostHogProvider>,
);
