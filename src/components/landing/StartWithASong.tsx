import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { songSlug } from "@/lib/songSlug";
import { captureEvent } from "@/lib/posthog";

/**
 * PROTOTYPE — the front door.
 *
 * Today the version picker sits five taps behind "Build your Setlist", inside
 * a dialog, behind a mode chooser. This puts the first move of the product —
 * name a song — in the first viewport, and sends it to /versions/:slug.
 *
 * The two songs offered by name are the only two with a researched version
 * list behind them. Offering them is not decoration: a visitor who picks one
 * sees the product working, and a visitor who searches anything else sees the
 * honest empty state, which is the thing we actually need to look at.
 */

interface SongRow {
  id: string;
  title: string;
}

/** Songs with a full ranked version list. Hand-held while the corpus is two. */
const READY = ["Shakedown Street", "Crazy Fingers"];

const StartWithASong = () => {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("songs")
      .select("id, title")
      .order("title")
      .then(({ data }) => setSongs((data ?? []) as SongRow[]));
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return songs.filter((s) => s.title.toLowerCase().includes(term)).slice(0, 6);
  }, [q, songs]);

  const go = (title: string, how: string) => {
    captureEvent("landing_song_chosen", { song_title: title, how });
    navigate(`/versions/${songSlug(title)}`);
  };

  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-10">
      <div className="text-center mb-5">
        <p className="font-ticket text-[10px] uppercase tracking-[0.18em] text-primary mb-2">
          Start with a song
        </p>
        <h2 className="font-title text-3xl md:text-4xl text-card-foreground leading-tight mb-2">
          Which one do you argue about?
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-[46ch] mx-auto">
          Name it and we'll show you every version worth knowing — including the ones that never
          made anybody's shortlist.
        </p>
      </div>

      <div ref={boxRef} className="relative">
        <div className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-2.5 focus-within:border-primary/50 transition-colors">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) go(matches[0].title, "search_enter"); }}
            placeholder="Dark Star, Shakedown Street, Ramble On Rose…"
            aria-label="Search for a song"
            className="flex-1 bg-transparent font-body text-sm text-card-foreground placeholder:text-muted-foreground/70 outline-none"
          />
        </div>

        {open && matches.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 mt-1 rounded-sm border border-border bg-card shadow-lg overflow-hidden">
            {matches.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => go(s.title, "search_pick")}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors"
                >
                  <span className="font-body text-sm text-card-foreground">{s.title}</span>
                  {READY.includes(s.title) && (
                    <span className="font-ticket text-[9px] uppercase tracking-[0.12em] text-primary whitespace-nowrap">
                      fully mapped
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <p className="font-ticket text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-2 text-center">
          Mapped end to end
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          {READY.map((title) => (
            <button
              key={title}
              type="button"
              onClick={() => go(title, "ready_chip")}
              className="inline-flex items-center gap-1.5 rounded-sm border border-primary/40 bg-primary/[0.07] px-3 py-2 font-body text-sm text-card-foreground hover:bg-primary/15 transition-colors"
            >
              {title}
              <ArrowRight className="w-3.5 h-3.5 text-primary" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StartWithASong;
