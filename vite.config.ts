import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { componentTagger } from "lovable-tagger";

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

// Resolve HEAD from the .git directory without the git binary. Lovable's
// publish build has been seen with neither `git rev-parse` nor `git log`
// working, which stamped the live site "unknown" and blinded the admin sync
// badge. If the repo is present but git is not, this still finds the sha.
function readGitSha(): string {
  try {
    let gitDir = path.resolve(__dirname, ".git");
    if (fs.statSync(gitDir).isFile()) {
      // Worktree or submodule: .git is a file pointing at the real dir.
      const pointer = fs.readFileSync(gitDir, "utf8").match(/^gitdir:\s*(.+)$/m);
      if (!pointer) return "";
      gitDir = path.resolve(__dirname, pointer[1].trim());
    }
    const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
    if (/^[0-9a-f]{40}$/.test(head)) return head;
    const ref = head.match(/^ref:\s*(.+)$/)?.[1];
    if (!ref) return "";
    // A worktree keeps HEAD locally but refs in the common dir.
    const commonFile = path.join(gitDir, "commondir");
    const commonDir = fs.existsSync(commonFile)
      ? path.resolve(gitDir, fs.readFileSync(commonFile, "utf8").trim())
      : gitDir;
    for (const dir of [gitDir, commonDir]) {
      const loose = path.join(dir, ref);
      if (fs.existsSync(loose)) return fs.readFileSync(loose, "utf8").trim();
    }
    const packed = path.join(commonDir, "packed-refs");
    if (fs.existsSync(packed)) {
      for (const line of fs.readFileSync(packed, "utf8").split("\n")) {
        const [sha, name] = line.split(" ");
        if (name === ref && /^[0-9a-f]{40}$/.test(sha)) return sha;
      }
    }
  } catch {
    // fall through
  }
  return "";
}

const BUILD_SHA =
  process.env.VITE_BUILD_SHA || safeExec("git rev-parse HEAD") || readGitSha() || "unknown";
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
