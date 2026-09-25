import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, GitBranch, RefreshCw, Loader2 } from "lucide-react";
import { classifyCompare, type SyncVerdict } from "@/lib/githubSync";
import { fetchLatestRelease, releaseCoversBuild, type RecordedRelease } from "@/lib/webReleases";

declare const __BUILD_SHA__: string;
declare const __BUILD_SHA_SHORT__: string;
declare const __BUILD_TIME__: string;

const REPO = "eljaguaro-gitdown/dead-set-org-505d00a5";
const BRANCH = "main";

type Status = "loading" | "in-sync" | "behind" | "ahead" | "diverged" | "error";

interface RemoteInfo {
  sha: string;
  shortSha: string;
  committedAt: string;
  message: string;
  url: string;
}

const timeAgo = (iso: string): string => {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
};

const plural = (n: number, noun: string): string =>
  `${n} ${noun}${n === 1 ? "" : "s"}`;

const GitHubSyncBadge = () => {
  const localSha = typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "unknown";
  const localShort = typeof __BUILD_SHA_SHORT__ !== "undefined" ? __BUILD_SHA_SHORT__ : "unknown";
  const buildTime = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "";

  const [remote, setRemote] = useState<RemoteInfo | null>(null);
  const [verdict, setVerdict] = useState<SyncVerdict | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [checkedAt, setCheckedAt] = useState<string>("");
  const [error, setError] = useState<string>("");
  /** Set when the build has no stamped sha and the release log stood in for it. */
  const [fromLog, setFromLog] = useState<RecordedRelease | null>(null);

  const check = async () => {
    setStatus("loading");
    setError("");
    setFromLog(null);
    try {
      let sha = localSha;
      let short = localShort;
      if (!sha || sha === "unknown") {
        // Lovable sometimes builds without the repo's .git, so neither
        // `git rev-parse` nor readGitSha() can stamp a sha. The release log
        // (web_releases, written after each publish is confirmed live) knows
        // what shipped — but only use it if it covers THIS build.
        const release = await fetchLatestRelease();
        if (!release) {
          throw new Error("this build carries no commit sha, and no release is recorded");
        }
        if (!releaseCoversBuild(release, buildTime)) {
          throw new Error(
            `this build is newer than the last recorded release (${release.commitSha.slice(0, 7)}) — record it (RELEASING.md 2a)`
          );
        }
        setFromLog(release);
        sha = release.commitSha;
        short = sha.slice(0, 7);
      }

      // Build first, branch second. This direction is required, not stylistic:
      // GitHub's `files` is the diff from the merge base to HEAD, so the side
      // you want the file list FOR has to be HEAD. Asking
      // `compare/${BRANCH}...${sha}` — which this badge did until
      // 2026-09-22 — makes the build HEAD, and a behind build is an ancestor
      // of the branch, so the merge base is the build itself and `files` is
      // empty. That printed a green "nothing that ships" over six changed
      // source files. See the header comment in lib/githubSync.ts.
      //
      // `sha` is this build's commit, which the release-log fallback above may
      // have supplied in place of a missing stamp — either way it is the side
      // being asked about, so it stays the base.
      //
      // Still one request. Unauthenticated GitHub allows 60 an hour per IP and
      // this badge re-checks on every Refresh.
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/compare/${sha}...${BRANCH}`,
        { headers: { Accept: "application/vnd.github+json" } }
      );
      if (!res.ok) {
        // A 403 with no quota left is the unauthenticated 60-per-hour limit,
        // which the Check button actively invites people into — worth naming
        // rather than surfacing as a bare status code. Ported from PR #37,
        // which diagnosed this same badge independently.
        if (res.status === 403 && res.headers.get("X-RateLimit-Remaining") === "0") {
          throw new Error("GitHub rate limit reached — try again in an hour");
        }
        throw new Error(
          res.status === 404
            ? `${short} is not on GitHub`
            : `GitHub ${res.status}`
        );
      }
      const data = await res.json();

      // The branch is HEAD now, so it is no longer `base_commit` — that is this
      // build. The comparison lists commits oldest-first, so the branch tip is
      // the last one; when the two are identical there are no commits at all
      // and the merge base is the branch tip.
      const commits = Array.isArray(data?.commits) ? data.commits : [];
      const base = commits.length > 0
        ? commits[commits.length - 1]
        : data?.merge_base_commit ?? data?.base_commit;
      const mainSha: string = base?.sha ?? "";
      setRemote({
        sha: mainSha,
        shortSha: mainSha.slice(0, 7),
        committedAt: base?.commit?.committer?.date ?? "",
        message: (base?.commit?.message ?? "").split("\n")[0],
        url: base?.html_url ?? `https://github.com/${REPO}/commits/${BRANCH}`,
      });

      const next = classifyCompare(data);
      setVerdict(next);
      setCheckedAt(new Date().toISOString());
      // Docs moved on main but nothing shipped did: the app running here IS
      // main's app code, so this is not a warning.
      setStatus(next.docsOnly ? "in-sync" : next.status);
    } catch (e) {
      setError((e as Error)?.message ?? "Failed to reach GitHub");
      setStatus("error");
      setCheckedAt(new Date().toISOString());
    }
  };

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusMeta = {
    loading: {
      label: "Checking…",
      Icon: Loader2,
      tone: "text-muted-foreground border-border",
      spin: true,
    },
    "in-sync": {
      label: verdict?.docsOnly ? "App code in sync" : "In sync with main",
      Icon: CheckCircle2,
      tone: "text-emerald-600 border-emerald-600/40 bg-emerald-500/5",
      spin: false,
    },
    behind: {
      label: "Behind main",
      Icon: AlertTriangle,
      tone: "text-amber-700 border-amber-600/40 bg-amber-500/10",
      spin: false,
    },
    ahead: {
      label: "Ahead of main",
      Icon: GitBranch,
      tone: "text-sky-700 border-sky-600/40 bg-sky-500/10",
      spin: false,
    },
    diverged: {
      label: "Diverged from main",
      Icon: AlertTriangle,
      tone: "text-amber-700 border-amber-600/40 bg-amber-500/10",
      spin: false,
    },
    error: {
      label: "Sync unknown",
      Icon: AlertTriangle,
      tone: "text-destructive border-destructive/40 bg-destructive/5",
      spin: false,
    },
  }[status];

  const { Icon } = statusMeta;

  return (
    <div className={`rounded-lg border ${statusMeta.tone} paper-grain p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${statusMeta.spin ? "animate-spin" : ""}`} />
          <div className="min-w-0">
            <div className="font-mono text-xs uppercase tracking-wider">{statusMeta.label}</div>
            <div className="text-[11px] font-mono opacity-70 truncate">
              {REPO} · {BRANCH}
            </div>
          </div>
        </div>
        <button
          onClick={check}
          disabled={status === "loading"}
          className="shrink-0 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider border border-current/40 rounded px-2 py-1 hover:bg-current/10 transition-colors disabled:opacity-50"
          title="Re-check GitHub"
        >
          <RefreshCw className={`w-3 h-3 ${status === "loading" ? "animate-spin" : ""}`} />
          Check
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
        <div className="rounded border border-current/20 bg-background/40 p-2">
          <div className="opacity-60 uppercase tracking-wider text-[10px]">This build</div>
          <div className="mt-0.5 tabular-nums">
            {fromLog ? fromLog.commitSha.slice(0, 7) : localShort}
          </div>
          <div className="opacity-60 text-[10px] mt-1">
            {fromLog
              ? `not stamped — from release log, live ${timeAgo(fromLog.publishedAt)}`
              : `built ${timeAgo(buildTime)}`}
          </div>
        </div>
        <div className="rounded border border-current/20 bg-background/40 p-2">
          <div className="opacity-60 uppercase tracking-wider text-[10px]">GitHub main</div>
          <div className="mt-0.5 tabular-nums">
            {remote ? (
              <a
                href={remote.url}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted underline-offset-2"
              >
                {remote.shortSha}
              </a>
            ) : status === "loading" ? (
              "…"
            ) : (
              "—"
            )}
          </div>
          <div className="opacity-60 text-[10px] mt-1 truncate">
            {remote?.committedAt
              ? `pushed ${timeAgo(remote.committedAt)}`
              : error || "unavailable"}
          </div>
        </div>
      </div>

      {verdict && (verdict.ahead > 0 || verdict.behind > 0) && (
        <div className="text-[11px] font-mono opacity-70">
          {verdict.ahead > 0 && verdict.behind === 0
            ? `this build is ${plural(verdict.ahead, "commit")} ahead of ${BRANCH}`
            : verdict.behind > 0 && verdict.ahead === 0
              ? `${BRANCH} is ${plural(verdict.behind, "commit")} ahead — ${
                  verdict.docsOnly
                    ? "nothing that ships"
                    : `${plural(verdict.appFiles.length, "app file")} changed`
                }`
              : `diverged — ${plural(verdict.ahead, "commit")} ahead, ${verdict.behind} behind`}
        </div>
      )}

      {remote?.message && (
        <div className="text-[11px] font-mono opacity-70 truncate">
          latest: {remote.message}
        </div>
      )}

      <div className="text-[10px] font-mono opacity-50">
        checked {checkedAt ? timeAgo(checkedAt) : "—"}
      </div>
    </div>
  );
};

export default GitHubSyncBadge;
