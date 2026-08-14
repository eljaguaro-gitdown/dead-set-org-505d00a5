import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldOff, Loader2, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type SuppressedRow = {
  id: string;
  email: string;
  reason: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

/**
 * Admin-only control for the suppression list. Rendered inside the admin
 * Email Deliverability area; deletes are additionally gated at the database
 * level by an admin-only RLS policy on public.suppressed_emails.
 */
export default function SuppressedAddressesPanel() {
  const [rows, setRows] = useState<SuppressedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("suppressed_emails")
      .select("id, email, reason, created_at, metadata")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Suppressed emails fetch error", error);
      setRows([]);
    } else {
      setRows((data as SuppressedRow[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const removeSuppression = async (row: SuppressedRow) => {
    setRemovingId(row.id);
    const { error } = await supabase.from("suppressed_emails").delete().eq("id", row.id);
    setRemovingId(null);
    if (error) {
      toast.error(`Could not remove suppression: ${error.message}`);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    toast.success(`${row.email} can receive mail again.`);
  };

  const severityOf = (row: SuppressedRow) => {
    const s = row.metadata && (row.metadata as Record<string, unknown>).severity;
    return typeof s === "string" ? s : null;
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <ShieldOff className="w-4 h-4 text-muted-foreground" />
        <h2 className="font-display text-sm text-card-foreground">Suppressed addresses</h2>
        <span
          className={`px-2 py-0.5 rounded-full text-sm font-body border ${
            rows.length > 0
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-border text-muted-foreground"
          }`}
        >
          {rows.length}
        </span>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="ml-auto h-8 px-2">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading ? (
        <div className="p-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading suppression list…
        </div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-sm font-body text-muted-foreground text-center">
          No suppressed addresses — every recipient is reachable.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => {
            const severity = severityOf(row);
            return (
              <div key={row.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-body text-card-foreground truncate">{row.email}</p>
                  <p className="text-sm font-body text-muted-foreground mt-0.5">
                    {row.reason}
                    {severity ? ` · ${severity}` : ""} ·{" "}
                    {new Date(row.created_at).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={removingId === row.id}
                      className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      {removingId === row.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Remove suppression
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove suppression for {row.email}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Mail will start flowing to this address again. If it was suppressed for a
                        permanent bounce or a spam complaint, sending again can hurt domain
                        reputation.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => removeSuppression(row)}>
                        Remove suppression
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
