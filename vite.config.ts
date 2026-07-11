import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";
import { componentTagger } from "lovable-tagger";

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

const BUILD_SHA = process.env.VITE_BUILD_SHA || safeExec("git rev-parse HEAD") || "unknown";
const BUILD_SHA_SHORT = BUILD_SHA.slice(0, 7);
const BUILD_TIME =
  process.env.VITE_BUILD_TIME ||
  safeExec("git log -1 --format=%cI") ||
  new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __BUILD_SHA__: JSON.stringify(BUILD_SHA),
    __BUILD_SHA_SHORT__: JSON.stringify(BUILD_SHA_SHORT),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
}));
