import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, Save, Send, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type ChangelogTag = "fix" | "new" | "improved" | "beta";

interface ChangeItem {
  id: string;
  tag: ChangelogTag;
  set_number: number;
  title: string;
  detail: string;
  credit: string;
}

const TAG_STYLES: Record<ChangelogTag, { label: string; bg: string; text: string; border: string }> = {
  fix: { label: "Fix", bg: "bg-[#0f1a0f]", text: "text-[#7ab87a]", border: "border-[#7ab87a]/30" },
  new: { label: "New", bg: "bg-[#1a1408]", text: "text-[#c9a84c]", border: "border-[#c9a84c]/30" },
  improved: { label: "Better", bg: "bg-[#0f141a]", text: "text-[#7aa8c9]", border: "border-[#7aa8c9]/30" },
  beta: { label: "Beta", bg: "bg-[#1a0f14]", text: "text-[#c97aa8]", border: "border-[#c97aa8]/30" },
};

const TAGS: ChangelogTag[] = ["fix", "new", "improved", "beta"];

const AdminChangelog = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Week header fields
  const [weekNumber, setWeekNumber] = useState(1);
  const [weekLabel, setWeekLabel] = useState("");
  const [editionTitle, setEditionTitle] = useState("");
  const [statsUpdates, setStatsUpdates] = useState(0);
  const [statsFeedback, setStatsFeedback] = useState(0);
  const [statsBugs, setStatsBugs] = useState(0);
  const [encoreNote, setEncoreNote] = useState("");
  const [nextWeekTeaser, setNextWeekTeaser] = useState("");

  // Change items
  const [items, setItems] = useState<ChangeItem[]>([
    { id: crypto.randomUUID(), tag: "fix", set_number: 1, title: "", detail: "", credit: "" },
  ]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/auth"); return; }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      if (!data) { navigate("/"); return; }
      setIsAdmin(true);
      setLoading(false);
    });
  }, [user, authLoading, navigate]);

  const addItem = () => {
    setItems(prev => [...prev, { id: crypto.randomUUID(), tag: "new", set_number: 2, title: "", detail: "", credit: "" }]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: keyof ChangeItem, value: string | number) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const handleSave = async (publish: boolean) => {
    if (!weekLabel || !editionTitle) {
      toast.error("Week label and edition title are required");
      return;
    }
    if (items.some(i => !i.title)) {
      toast.error("Every change item needs a title");
      return;
    }
    setSaving(true);
    try {
      const rows = items.map(item => ({
        week_number: weekNumber,
        week_label: weekLabel,
        edition_title: editionTitle,
        tag: item.tag,
        title: item.title,
        detail: item.detail,
        credit: item.credit || null,
        set_number: item.set_number,
        encore_note: encoreNote || null,
        next_week_teaser: nextWeekTeaser || null,
        published: publish,
        week_stats_updates: statsUpdates,
        week_stats_feedback: statsFeedback,
        week_stats_bugs: statsBugs,
      }));
      const { error } = await supabase.from("changelog_entries").insert(rows);
      if (error) throw error;
      toast.success(publish ? "Published!" : "Draft saved!");
      if (publish) navigate("/updates");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const set1Items = items.filter(i => i.set_number === 1);
  const set2Items = items.filter(i => i.set_number === 2);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#c9a84c] animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#b0ac9a]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <button onClick={() => navigate("/admin")} className="flex items-center gap-2 text-[#a09880] hover:text-[#c9a84c] font-mono text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </button>
        <h1 className="font-display text-3xl md:text-4xl text-[#c9a84c] mb-8 italic">Build Notes Editor</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT: Entry form */}
          <div className="space-y-6">
            {/* Week header */}
            <div className="bg-[#0d0d0d] border border-[#2a2410] rounded-lg p-5 space-y-4">
              <h2 className="font-mono text-sm text-[#c9a84c] uppercase tracking-wider">Week Header</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-xs text-[#a09880] mb-1 block">Week #</label>
                  <Input type="number" value={weekNumber} onChange={e => setWeekNumber(Number(e.target.value))} className="bg-[#0a0a0a] border-[#2a2410] text-[#b0ac9a]" />
                </div>
                <div>
                  <label className="font-mono text-xs text-[#a09880] mb-1 block">Date Range</label>
                  <Input value={weekLabel} onChange={e => setWeekLabel(e.target.value)} placeholder="Apr 7–11, 2026" className="bg-[#0a0a0a] border-[#2a2410] text-[#b0ac9a]" />
                </div>
              </div>
              <div>
                <label className="font-mono text-xs text-[#a09880] mb-1 block">Edition Title</label>
                <Input value={editionTitle} onChange={e => setEditionTitle(e.target.value)} placeholder="What Got Better This Week" className="bg-[#0a0a0a] border-[#2a2410] text-[#b0ac9a] font-display italic" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-mono text-xs text-[#a09880] mb-1 block">Updates</label>
                  <Input type="number" value={statsUpdates} onChange={e => setStatsUpdates(Number(e.target.value))} className="bg-[#0a0a0a] border-[#2a2410] text-[#b0ac9a]" />
                </div>
                <div>
                  <label className="font-mono text-xs text-[#a09880] mb-1 block">Feedback</label>
                  <Input type="number" value={statsFeedback} onChange={e => setStatsFeedback(Number(e.target.value))} className="bg-[#0a0a0a] border-[#2a2410] text-[#b0ac9a]" />
                </div>
                <div>
                  <label className="font-mono text-xs text-[#a09880] mb-1 block">Bugs</label>
                  <Input type="number" value={statsBugs} onChange={e => setStatsBugs(Number(e.target.value))} className="bg-[#0a0a0a] border-[#2a2410] text-[#b0ac9a]" />
                </div>
              </div>
              <div>
                <label className="font-mono text-xs text-[#a09880] mb-1 block">From the lab — your personal note</label>
                <Textarea value={encoreNote} onChange={e => setEncoreNote(e.target.value)} placeholder="A personal note to the community..." className="bg-[#0a0a0a] border-[#2a2410] text-[#b0ac9a] font-hand" rows={3} />
              </div>
              <div>
                <label className="font-mono text-xs text-[#a09880] mb-1 block">On the setlist for next week</label>
                <Input value={nextWeekTeaser} onChange={e => setNextWeekTeaser(e.target.value)} placeholder="Coming soon..." className="bg-[#0a0a0a] border-[#2a2410] text-[#b0ac9a] font-display italic" />
              </div>
            </div>

            {/* Change items */}
            <div className="space-y-4">
              <h2 className="font-mono text-sm text-[#c9a84c] uppercase tracking-wider">Change Items</h2>
              {items.map((item, idx) => (
                <div key={item.id} className="bg-[#0d0d0d] border border-[#2a2410] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-[#a09880]">#{idx + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => removeItem(item.id)} className="text-[#a09880] hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Tag selector */}
                  <div className="flex gap-2">
                    {TAGS.map(tag => {
                      const s = TAG_STYLES[tag];
                      const active = item.tag === tag;
                      return (
                        <button key={tag} onClick={() => updateItem(item.id, "tag", tag)}
                          className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${active ? `${s.bg} ${s.text} ${s.border}` : "bg-transparent text-[#a09880] border-[#1e1c10]"}`}>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                  {/* Set selector */}
                  <div className="flex gap-2">
                    {[1, 2].map(sn => (
                      <button key={sn} onClick={() => updateItem(item.id, "set_number", sn)}
                        className={`px-3 py-1 rounded-full text-xs font-mono border transition-all ${item.set_number === sn ? "bg-[#1a1408] text-[#c9a84c] border-[#c9a84c]/30" : "bg-transparent text-[#a09880] border-[#1e1c10]"}`}>
                        {sn === 1 ? "Set I · Fixes" : "Set II · New & Improved"}
                      </button>
                    ))}
                  </div>
                  <Input value={item.title} onChange={e => updateItem(item.id, "title", e.target.value)} placeholder="Change title" className="bg-[#0a0a0a] border-[#2a2410] text-[#b0ac9a] font-semibold" />
                  <Input value={item.detail} onChange={e => updateItem(item.id, "detail", e.target.value)} placeholder="One sentence explanation" className="bg-[#0a0a0a] border-[#2a2410] text-[#b0ac9a]" />
                  <Input value={item.credit} onChange={e => updateItem(item.id, "credit", e.target.value)} placeholder="e.g. built for a beta Deadhead" className="bg-[#0a0a0a] border-[#2a2410] text-[#a09880] font-mono text-xs" />
                </div>
              ))}
              <Button onClick={addItem} variant="outline" className="w-full border-[#c9a84c]/30 text-[#c9a84c] hover:bg-[#1a1408]">
                <Plus className="w-4 h-4 mr-1" /> Add change
              </Button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button onClick={() => handleSave(false)} disabled={saving} variant="outline" className="flex-1 border-[#2a2410] text-[#a09880] hover:text-[#b0ac9a]">
                <Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save draft"}
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving} className="flex-1 bg-[#c9a84c] text-[#0a0a0a] hover:bg-[#d4b050]">
                <Send className="w-4 h-4 mr-1" /> {saving ? "Publishing..." : "Publish this week's notes"}
              </Button>
            </div>
          </div>

          {/* RIGHT: Live preview */}
          <div className="hidden lg:block">
            <div className="sticky top-6">
              <h2 className="font-mono text-sm text-[#c9a84c] uppercase tracking-wider mb-4">Live Preview</h2>
              <div className="bg-[#0d0d0d] border border-[#2a2410] rounded-lg p-5 space-y-5">
                {/* Week header preview */}
                <div>
                  <p className="font-mono text-xs text-[#a09880]">Week {weekNumber} · {weekLabel || "..."}</p>
                  <p className="font-display text-xl text-[#c9a84c] italic mt-1">{editionTitle || "Edition title..."}</p>
                </div>
                {/* Stats pills */}
                <div className="flex gap-2 flex-wrap">
                  <span className="font-mono text-xs border border-[#c9a84c]/30 text-[#c9a84c] rounded-full px-2.5 py-0.5">{statsUpdates} updates</span>
                  <span className="font-mono text-xs border border-[#c9a84c]/30 text-[#c9a84c] rounded-full px-2.5 py-0.5">{statsFeedback} from feedback</span>
                  <span className="font-mono text-xs border border-[#c9a84c]/30 text-[#c9a84c] rounded-full px-2.5 py-0.5">{statsBugs} bugs squashed</span>
                </div>

                {/* Set I */}
                {set1Items.length > 0 && (
                  <div>
                    <p className="font-mono text-xs text-[#a09880] uppercase tracking-wider border-b border-[#1e1c10] pb-1 mb-3">Set I · Fixes</p>
                    <div className="space-y-2">
                      {set1Items.map(item => (
                        <PreviewItem key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}
                {/* Set II */}
                {set2Items.length > 0 && (
                  <div>
                    <p className="font-mono text-xs text-[#a09880] uppercase tracking-wider border-b border-[#1e1c10] pb-1 mb-3">Set II · New & Improved</p>
                    <div className="space-y-2">
                      {set2Items.map(item => (
                        <PreviewItem key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                )}
                {/* Encore */}
                {encoreNote && (
                  <div className="border-l-2 border-[#c9a84c] pl-4 mt-4">
                    <p className="font-mono text-xs text-[#a09880] uppercase tracking-wider mb-1">Encore</p>
                    <p className="font-hand text-lg text-[#b0ac9a]">{encoreNote}</p>
                  </div>
                )}
                {/* Teaser */}
                {nextWeekTeaser && (
                  <p className="font-display text-sm text-[#a09880] italic mt-3">Coming up: {nextWeekTeaser}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PreviewItem = ({ item }: { item: ChangeItem }) => {
  const s = TAG_STYLES[item.tag];
  return (
    <div className="flex items-start gap-2">
      <span className={`px-2 py-0.5 rounded-full text-xs font-mono shrink-0 ${s.bg} ${s.text}`}>{s.label}</span>
      <div>
        <span className="text-sm font-semibold text-[#b0ac9a]">{item.title || "..."}</span>
        {item.detail && <span className="text-sm text-[#a09880] ml-1">— {item.detail}</span>}
        {item.credit && <p className="font-mono text-xs text-[#c9a84c] mt-0.5">{item.credit}</p>}
      </div>
    </div>
  );
};

export default AdminChangelog;
