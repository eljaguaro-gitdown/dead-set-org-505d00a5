import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Loader2, Send, Eye } from "lucide-react";
import { toast } from "sonner";

interface BetaUser {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  hasReceived: boolean;
}

const deriveFirstName = (displayName: string | null): string => {
  if (!displayName) return "";
  const t = displayName.trim();
  if (!t) return "";
  return t.split(/\s+/)[0];
};

const fmtDate = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const AdminBetaNudge = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Users
  const [users, setUsers] = useState<BetaUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Preview
  const [previewUserId, setPreviewUserId] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewFirstName, setPreviewFirstName] = useState<string | null>(null);
  const [previewEmail, setPreviewEmail] = useState<string | null>(null);

  // Send
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ done: number; total: number } | null>(null);
  const [sendSummary, setSendSummary] = useState<{ sent: number; failed: number; skipped: number } | null>(null);

  // Auth gate
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data }) => {
        if (!data) {
          navigate("/");
          return;
        }
        if (user.email !== "grateful_jaguaro@dead-set.org") {
          navigate("/");
          return;
        }
        setIsAdmin(true);
      });
  }, [user, authLoading, navigate]);

  // Load users + sent flags
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const [{ data: usersData, error: usersErr }, { data: sendsData, error: sendsErr }] =
          await Promise.all([
            supabase.functions.invoke("admin-users"),
            supabase
              .from("email_sends")
              .select("user_id")
              .eq("template", "beta_nudge")
              .eq("status", "sent"),
          ]);

        if (usersErr) throw usersErr;
        if (sendsErr) throw sendsErr;

        const sentSet = new Set<string>((sendsData ?? []).map((r: any) => r.user_id));
        const list: BetaUser[] = ((usersData as any)?.users ?? []).map((u: any) => ({
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          createdAt: u.createdAt,
          lastSignInAt: u.lastSignInAt,
          hasReceived: sentSet.has(u.id),
        }));
        list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        setUsers(list);
        if (list.length > 0) setPreviewUserId(list[0].id);
      } catch (e: any) {
        toast.error(e.message || "Failed to load users");
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  const renderPreview = async () => {
    if (!previewUserId) return;
    setPreviewLoading(true);
    setPreviewHtml("");
    setPreviewFirstName(null);
    setPreviewEmail(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-beta-nudge", {
        body: { recipient_ids: [previewUserId], dry_run: true },
      });
      if (error) throw error;
      setPreviewHtml((data as any)?.html ?? "");
      setPreviewFirstName((data as any)?.first_name ?? null);
      setPreviewEmail((data as any)?.recipient_email ?? null);
    } catch (e: any) {
      toast.error(e.message || "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(users.map((u) => u.id)));
  const selectOnlyUnsent = () =>
    setSelected(new Set(users.filter((u) => !u.hasReceived).map((u) => u.id)));
  const clearSelection = () => setSelected(new Set());

  const selectedUsers = useMemo(
    () => users.filter((u) => selected.has(u.id)),
    [users, selected]
  );

  const previewNames = selectedUsers
    .slice(0, 3)
    .map((u) => deriveFirstName(u.displayName) || u.email.split("@")[0])
    .join(", ");

  const handleConfirmedSend = async () => {
    if (confirmText !== "SEND") {
      toast.error('Type "SEND" to confirm');
      return;
    }
    setSending(true);
    setSendSummary(null);
    setSendProgress({ done: 0, total: selectedUsers.length });
    setConfirmOpen(false);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // Send one at a time so the progress bar reflects real progress
    for (let i = 0; i < selectedUsers.length; i++) {
      const u = selectedUsers[i];
      try {
        const { data, error } = await supabase.functions.invoke("send-beta-nudge", {
          body: { recipient_ids: [u.id], dry_run: false },
        });
        if (error) throw error;
        const r = (data as any)?.results?.[0];
        if (r?.status === "sent") sent++;
        else if (r?.status === "skipped") skipped++;
        else failed++;
      } catch {
        failed++;
      }
      setSendProgress({ done: i + 1, total: selectedUsers.length });
    }

    setSending(false);
    setSendSummary({ sent, failed, skipped });
    setConfirmText("");
    toast.success(`Done. ${sent} sent, ${failed} failed, ${skipped} skipped.`);

    // Refresh sent flags
    const { data: sendsData } = await supabase
      .from("email_sends")
      .select("user_id")
      .eq("template", "beta_nudge")
      .eq("status", "sent");
    const sentSet = new Set<string>((sendsData ?? []).map((r: any) => r.user_id));
    setUsers((prev) => prev.map((u) => ({ ...u, hasReceived: sentSet.has(u.id) })));
    setSelected(new Set());
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#c9a84c] animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#b0ac9a] pb-20">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <button
          onClick={() => navigate("/admin")}
          className="flex items-center gap-2 text-[#a09880] hover:text-[#c9a84c] font-mono text-sm mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO ADMIN
        </button>

        <div className="mb-10 pb-6 border-b border-[#2a2410]">
          <p className="font-mono text-[11px] tracking-[0.28em] text-[#b09e78] uppercase mb-2">
            Email · Campaign
          </p>
          <h1 className="font-display italic text-3xl text-[#c9a84c]">Beta Nudge</h1>
          <p className="font-mono text-[11px] tracking-[0.18em] text-[#6b6450] uppercase mt-3">
            Subject: "You set the tone." · Template: beta_nudge
          </p>
        </div>

        {/* ── 1. PREVIEW ── */}
        <section className="mb-12">
          <h2 className="font-mono text-[11px] tracking-[0.28em] text-[#b09e78] uppercase mb-4 pb-2 border-b border-[#1e1c10]">
            01 · Preview
          </h2>

          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div className="flex-1 min-w-[260px]">
              <label className="block font-mono text-[10px] tracking-[0.18em] text-[#8a8270] uppercase mb-2">
                Recipient
              </label>
              <select
                value={previewUserId}
                onChange={(e) => setPreviewUserId(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-[#2a2410] text-[#c8c4b0] font-mono text-sm px-3 py-2 rounded-[2px] focus:border-[#c9a84c] outline-none"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {(deriveFirstName(u.displayName) || u.email)} — {u.email}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={renderPreview}
              disabled={previewLoading || !previewUserId}
              className="bg-[#c9a84c] text-[#0a0a0a] font-mono text-[12px] tracking-[0.12em] uppercase px-5 py-2.5 rounded-[2px] hover:bg-[#d4b85c] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {previewLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              Render Preview
            </button>
          </div>

          {(previewFirstName !== null || previewEmail) && (
            <div className="bg-[#0f0e08] border border-[#2a2410] border-l-[3px] border-l-[#c9a84c] rounded-[2px] px-4 py-3 mb-4">
              <p className="font-mono text-[10px] tracking-[0.18em] text-[#8a8270] uppercase">
                Resolved
              </p>
              <p className="font-mono text-sm text-[#c8c4b0] mt-1">
                first_name: <span className="text-[#c9a84c]">{previewFirstName || "(empty — falls back to 'Hey Now')"}</span>
              </p>
              {previewEmail && (
                <p className="font-mono text-sm text-[#c8c4b0]">
                  email: <span className="text-[#c9a84c]">{previewEmail}</span>
                </p>
              )}
            </div>
          )}

          {previewHtml && (
            <iframe
              title="beta-nudge-preview"
              sandbox=""
              srcDoc={previewHtml}
              className="w-full h-[700px] bg-white border border-[#2a2410] rounded-[2px]"
            />
          )}
        </section>

        {/* ── 2. RECIPIENT LIST ── */}
        <section className="mb-12">
          <h2 className="font-mono text-[11px] tracking-[0.28em] text-[#b09e78] uppercase mb-4 pb-2 border-b border-[#1e1c10]">
            02 · Recipients
          </h2>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button
              onClick={selectAll}
              className="font-mono text-[11px] tracking-[0.10em] uppercase text-[#c9a84c] bg-[#1a1408] border border-[#4a3a18] rounded-[2px] px-3 py-1.5 hover:bg-[#2a1f10] transition-colors"
            >
              Select All
            </button>
            <button
              onClick={selectOnlyUnsent}
              className="font-mono text-[11px] tracking-[0.10em] uppercase text-[#c9a84c] bg-[#1a1408] border border-[#4a3a18] rounded-[2px] px-3 py-1.5 hover:bg-[#2a1f10] transition-colors"
            >
              Select Only Unsent
            </button>
            <button
              onClick={clearSelection}
              className="font-mono text-[11px] tracking-[0.10em] uppercase text-[#a09880] border border-[#2a2410] rounded-[2px] px-3 py-1.5 hover:bg-[#161610] transition-colors"
            >
              Clear
            </button>
            <span className="ml-auto font-mono text-[12px] text-[#c9a84c]">
              {selected.size} of {users.length} selected
            </span>
          </div>

          <div className="overflow-x-auto border border-[#1e1c10] rounded-[2px]">
            <table className="w-full text-sm">
              <thead className="bg-[#0f0e08]">
                <tr className="text-left font-mono text-[10px] tracking-[0.16em] text-[#8a8270] uppercase">
                  <th className="px-3 py-3 w-10"></th>
                  <th className="px-3 py-3">First name</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Signed up</th>
                  <th className="px-3 py-3">Last active</th>
                  <th className="px-3 py-3">Sent?</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const checked = selected.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      className="border-t border-[#161610] hover:bg-[#0f0e08] transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(u.id)}
                          className="accent-[#c9a84c] w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-[#c8c4b0]">
                        {deriveFirstName(u.displayName) || (
                          <span className="text-[#6b6450] italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-[#a09880]">
                        {u.email}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-[#7a7660]">
                        {fmtDate(u.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-[#7a7660]">
                        {fmtDate(u.lastSignInAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        {u.hasReceived ? (
                          <span className="inline-block font-mono text-[10px] tracking-[0.1em] uppercase text-[#7ab87a] bg-[#0f1a0f] border border-[#2a4a2a] rounded-[2px] px-2 py-0.5">
                            Sent
                          </span>
                        ) : (
                          <span className="inline-block font-mono text-[10px] tracking-[0.1em] uppercase text-[#6b6450] border border-[#2a2410] rounded-[2px] px-2 py-0.5">
                            Unsent
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 3. SEND ── */}
        <section>
          <h2 className="font-mono text-[11px] tracking-[0.28em] text-[#b09e78] uppercase mb-4 pb-2 border-b border-[#1e1c10]">
            03 · Send
          </h2>

          {sendProgress && sending && (
            <div className="mb-4 bg-[#0f0e08] border border-[#2a2410] rounded-[2px] px-4 py-3">
              <p className="font-mono text-[12px] text-[#c9a84c]">
                Sending {sendProgress.done} of {sendProgress.total}…
              </p>
              <div className="mt-2 h-1 bg-[#1e1c10] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#c9a84c] transition-all"
                  style={{
                    width: `${(sendProgress.done / Math.max(1, sendProgress.total)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {sendSummary && !sending && (
            <div className="mb-4 bg-[#0f0e08] border border-[#2a2410] border-l-[3px] border-l-[#c9a84c] rounded-[2px] px-4 py-3">
              <p className="font-mono text-[11px] tracking-[0.18em] text-[#8a8270] uppercase mb-2">
                Send Complete
              </p>
              <div className="flex gap-6 font-mono text-sm">
                <span className="text-[#7ab87a]">{sendSummary.sent} sent</span>
                <span className="text-[#c97a7a]">{sendSummary.failed} failed</span>
                <span className="text-[#a09880]">{sendSummary.skipped} skipped</span>
              </div>
            </div>
          )}

          <button
            onClick={() => {
              if (selected.size === 0) {
                toast.error("Select at least one recipient");
                return;
              }
              setConfirmText("");
              setConfirmOpen(true);
            }}
            disabled={sending || selected.size === 0}
            className="bg-[#7a1f1f] text-[#fce8e8] font-mono text-[13px] tracking-[0.12em] uppercase font-medium px-6 py-3 rounded-[2px] hover:bg-[#8a2424] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 border border-[#a02a2a]"
          >
            <Send className="w-4 h-4" />
            Send to Selected ({selected.size})
          </button>
        </section>
      </div>

      {/* ── Confirm Modal ── */}
      {confirmOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !sending && setConfirmOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0d0d0d] border border-[#2a2410] border-l-[3px] border-l-[#c9a84c] rounded-[2px] max-w-md w-full p-6"
          >
            <p className="font-mono text-[11px] tracking-[0.22em] text-[#b09e78] uppercase mb-3">
              Confirm Send
            </p>
            <h3 className="font-display italic text-2xl text-[#c9a84c] mb-4">
              You're about to send to {selected.size} {selected.size === 1 ? "person" : "people"}.
            </h3>
            <p className="font-body text-sm text-[#b0ac9a] mb-1">First three:</p>
            <p className="font-mono text-sm text-[#c8c4b0] mb-5">{previewNames || "—"}</p>

            <label className="block font-mono text-[10px] tracking-[0.18em] text-[#8a8270] uppercase mb-2">
              Type SEND to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              className="w-full bg-[#0a0a0a] border border-[#2a2410] text-[#c8c4b0] font-mono text-sm px-3 py-2 rounded-[2px] focus:border-[#c9a84c] outline-none mb-5"
              placeholder="SEND"
            />

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                className="font-mono text-[11px] tracking-[0.12em] uppercase text-[#a09880] px-4 py-2 hover:text-[#c9a84c] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmedSend}
                disabled={confirmText !== "SEND"}
                className="bg-[#7a1f1f] text-[#fce8e8] font-mono text-[12px] tracking-[0.12em] uppercase font-medium px-5 py-2 rounded-[2px] hover:bg-[#8a2424] disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-[#a02a2a]"
              >
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBetaNudge;
