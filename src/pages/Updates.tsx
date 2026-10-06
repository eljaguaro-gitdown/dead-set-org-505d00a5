import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ArrowLeft, Loader2 } from "lucide-react";
import { groupEditions, type BuildNoteEntry, type Edition } from "@/lib/buildNotes";

type ChangelogTag = "fix" | "new" | "improved" | "beta";

/**
 * An edition is a WEEK OF SHIP DATES, derived in @/lib/buildNotes. The
 * `week_number` / `week_label` / `week_stats_*` columns are legacy: they were
 * typed by hand, which is how this page came to show "Week 3 · Apr 21 – Sep 23,
 * 2026" — five months under one week heading. Only `week_label` is still read,
 * and only as an override on the editions published before `shipped_on`
 * existed, so their original labels survive.
 */
interface ChangelogEntry extends BuildNoteEntry {
  tag: ChangelogTag;
}

const TAG_STYLES: Record<ChangelogTag, { label: string; bg: string; text: string }> = {
  fix: { label: "Fix", bg: "bg-[#0f1a0f]", text: "text-[#7ab87a]" },
  new: { label: "New", bg: "bg-[#1a1408]", text: "text-[#c9a84c]" },
  improved: { label: "Better", bg: "bg-[#0f141a]", text: "text-[#7aa8c9]" },
  beta: { label: "Beta", bg: "bg-[#1a0f14]", text: "text-[#c97aa8]" },
};

const Updates = () => {
  const [weeks, setWeeks] = useState<Edition<ChangelogEntry>[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchEntries = async () => {
      const { data, error } = await supabase
        .from("changelog_entries")
        .select("*")
        .eq("published", true)
        .order("shipped_on", { ascending: false });

      if (error || !data) { setLoading(false); return; }

      // `today` is passed in rather than read inside, so the in-progress week
      // is a parameter of the grouping and can be tested.
      const today = new Date().toISOString().slice(0, 10);
      // Cast through unknown because `shipped_on` is not in the generated
      // Database types yet: types.ts regenerates from the schema (CLAUDE.md —
      // never hand-edit it), and this sandbox has no Supabase access token to
      // run the generator. The column exists; the migration adds it. Drop the
      // `unknown` hop the moment types.ts carries shipped_on.
      const editions = groupEditions(data as unknown as ChangelogEntry[], today);
      setWeeks(editions);
      // Open the newest edition — the one people came to read.
      if (editions.length > 0) setExpanded(new Set([editions[0].key]));
      setLoading(false);
    };
    fetchEntries();
  }, []);

  const toggleWeek = (wn: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(wn)) next.delete(wn); else next.add(wn);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#b0ac9a]">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-20">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-1.5 text-[#a09880] hover:text-[#c9a84c] font-mono text-sm mb-8 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dead Set
        </Link>

        {/* Page header */}
        <header className="mb-10">
          <h1 className="font-display text-4xl md:text-5xl text-[#c9a84c]">Build Notes</h1>
          <p className="font-mono text-sm text-[#a09880] mt-2">What's changing, week by week</p>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 text-[#c9a84c] animate-spin" />
          </div>
        ) : weeks.length === 0 ? (
          <p className="text-[#a09880] text-center py-20 font-mono text-sm">No build notes yet. Check back soon.</p>
        ) : (
          <div className="space-y-4">
            {weeks.map(week => {
              const isOpen = expanded.has(week.key);
              return (
                <div key={week.key} className="bg-[#0d0d0d] border border-[#2a2410] rounded-lg overflow-hidden">
                  {/* Week header — always visible */}
                  <button onClick={() => toggleWeek(week.key)} className="w-full px-5 py-4 flex items-center justify-between text-left group">
                    <div>
                      <p className="font-mono text-xs text-[#a09880]">
                        {week.label}
                        {week.inProgress && <span className="text-[#c9a84c]"> · this week, still running</span>}
                      </p>
                      <p className="font-display text-lg md:text-xl text-[#c9a84c] italic mt-0.5">{week.edition_title}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-[#c9a84c] transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                  </button>

                  {/* Expandable content */}
                  {isOpen && (
                    <div className="px-5 pb-5 space-y-5">
                      {/* Stats */}
                      <div className="flex gap-2 flex-wrap">
                        <span className="font-mono text-xs border border-[#c9a84c]/30 text-[#c9a84c] rounded-full px-2.5 py-0.5">{week.stats.updates} {week.stats.updates === 1 ? "update" : "updates"} shipped</span>
                        <span className="font-mono text-xs border border-[#c9a84c]/30 text-[#c9a84c] rounded-full px-2.5 py-0.5">{week.stats.feedback} from your feedback</span>
                        <span className="font-mono text-xs border border-[#c9a84c]/30 text-[#c9a84c] rounded-full px-2.5 py-0.5">{week.stats.bugs} {week.stats.bugs === 1 ? "bug" : "bugs"} squashed</span>
                      </div>

                      {/* Set I */}
                      {week.set1.length > 0 && (
                        <div>
                          <p className="font-mono text-xs text-[#a09880] uppercase tracking-wider border-b border-[#1e1c10] pb-1 mb-3">Set I · Fixes</p>
                          <div className="space-y-3">
                            {week.set1.map(entry => <EntryItem key={entry.id} entry={entry} />)}
                          </div>
                        </div>
                      )}

                      {/* Set II */}
                      {week.set2.length > 0 && (
                        <div>
                          <p className="font-mono text-xs text-[#a09880] uppercase tracking-wider border-b border-[#1e1c10] pb-1 mb-3">Set II · New & Improved</p>
                          <div className="space-y-3">
                            {week.set2.map(entry => <EntryItem key={entry.id} entry={entry} />)}
                          </div>
                        </div>
                      )}

                      {/* Encore */}
                      {week.encore_note && (
                        <div className="border-l-2 border-[#c9a84c] pl-4 bg-[#0f0e08] rounded-r-lg py-3 pr-3">
                          <p className="font-mono text-xs text-[#a09880] uppercase tracking-wider mb-1.5">Encore</p>
                          <p className="font-hand text-lg leading-relaxed text-[#b0ac9a]">{week.encore_note}</p>
                        </div>
                      )}

                      {/* Next week teaser */}
                      {week.next_week_teaser && (
                        <p className="font-display text-sm text-[#a09880] italic border-t border-[#1e1c10] pt-3">
                          Coming up: {week.next_week_teaser}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const EntryItem = ({ entry }: { entry: ChangelogEntry }) => {
  const s = TAG_STYLES[entry.tag];
  return (
    <div className="flex items-start gap-2.5">
      <span className={`px-2 py-0.5 rounded-full text-xs font-mono shrink-0 mt-0.5 ${s.bg} ${s.text}`}>{s.label}</span>
      <div>
        <span className="text-base font-semibold text-[#b0ac9a]">{entry.title}</span>
        {entry.detail && <span className="text-base text-[#a09880] ml-1">— {entry.detail}</span>}
        {entry.credit && <p className="font-mono text-xs text-[#c9a84c] mt-0.5">{entry.credit}</p>}
      </div>
    </div>
  );
};

export default Updates;
