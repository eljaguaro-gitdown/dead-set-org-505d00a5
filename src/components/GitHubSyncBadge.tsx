import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, GitBranch, RefreshCw, Loader2 } from "lucide-react";

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

/**
 * GitHub's compare endpoint reports `status` for the HEAD relative to the BASE.
 * With base=main and head=<this build>, "ahead" means the build carries commits
 * main does not -- which is the normal state for a build cut from a branch.
 */
const mapStatus = (s: string): Status =>
  s === "identical"
    ? "in-sync"
    : s === "ahead" || s === "behind" || s === "diverged"
      ? (s as Status)
      : "error";

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

const GitHubSyncBadge = () => {
  const localSha = typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "unknown";
  const localShort = typeof __BUILD_SHA_SHORT__ !== "undefined" ? __BUILD_SHA_SHORT__ : "unknown";
  const buildTime = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "";

  const [remote, setRemote] = useState<RemoteInfo | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [checkedAt, setCheckedAt] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [counts, setCounts] = useState({ ahead: 0, behind: 0 });

  const check = async () => {
    setStatus("loading");
    setError("");
    if (!localSha || localSha === "unknown") {
      setError("build sha unavailable");
      setStatus("error");
      setCheckedAt(new Date().toISOString());
      return;
    }
    try {
      // One compare call, not a branch read. Comparing shas for equality can
      // only answer "same or different", so every divergence used to render as
      // "Behind main" -- including a build cut from a branch that was strictly
      // AHEAD of main. Compare returns the real relationship, and carries
      // main's tip in `base_commit`, so this costs the same single request.
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/compare/${BRANCH}...${localSha}`,
        { headers: { Accept: "application/vnd.github+json" } }
      );
      // Unauthenticated calls get 60/hour per IP, and the Check button invites
      // retaps. Name that case so it does not read as a bug.
      if (res.status === 403 && res.headers.get("X-RateLimit-Remaining") === "0")
        throw new Error("GitHub rate limit reached — try again later");
      if (res.status === 404)
        throw new Error("build commit not found on GitHub");
      if (!res.ok) throw new Error(`GitHub ${res.status}`);
      const data = await res.json();
      const base = data?.base_commit;
      const sha: string = base?.sha ?? "";
      const info: RemoteInfo = {
        sha,
        shortSha: sha.slice(0, 7),
        committedAt: base?.commit?.committer?.date ?? "",
        message: (base?.commit?.message ?? "").split("\n")[0],
        url: base?.html_url ?? `https://github.com/${REPO}/commits/${BRANCH}`,
      };
      setRemote(info);
      setCounts({ ahead: data?.ahead_by ?? 0, behind: data?.behind_by ?? 0 });
      setStatus(mapStatus(data?.status));
      setCheckedAt(new Date().toISOString());
    } catch (e: any) {
      setError(e?.message ?? "Failed to reach GitHub");
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
      label: "In sync with main",
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

  // "Behind main" alone says nothing about how far, and the distance is what
  // decides whether it matters.
  const detail =
    status === "behind"
      ? `${counts.behind} behind`
      : status === "ahead"
        ? `${counts.ahead} ahead`
        : status === "diverged"
          ? `${counts.ahead} ahead, ${counts.behind} behind`
          : "";

  return (
    <div className={`rounded-lg border ${statusMeta.tone} paper-grain p-4 space-y-3`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${statusMeta.spin ? "animate-spin" : ""}`} />
          <div className="min-w-0">
            <div className="font-mono text-xs uppercase tracking-wider">
              {statusMeta.label}
              {detail && <span className="opacity-70"> · {detail}</span>}
            </div>
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
          <div className="mt-0.5 tabular-nums">{localShort}</div>
          <div className="opacity-60 text-[10px] mt-1">
            built {timeAgo(buildTime)}
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
