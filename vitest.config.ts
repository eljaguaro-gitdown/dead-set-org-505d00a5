import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Vite's SSR transform hoists a module's imports to just after its hashbang,
 * which it finds with /^#!.*\n/. On a CRLF checkout (Windows, core.autocrlf)
 * the `\r` stops that matching, the imports land above the `#!`, and the
 * module fails to parse: "SyntaxError: Invalid or unexpected token", reported
 * against the test file that imported it. scripts/backfill-song-stats.mjs is
 * the one script with a hashbang today. Dropping that one `\r` keeps every
 * line where it was, so the source map still lines up.
 */
const crlfHashbang = {
  name: "crlf-hashbang",
  enforce: "pre" as const,
  transform: (code: string) => {
    const fixed = code.replace(/^(#!.*)\r\n/, "$1\n");
    return fixed === code ? undefined : fixed;
  },
};

export default defineConfig({
  plugins: [crlfHashbang, react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
