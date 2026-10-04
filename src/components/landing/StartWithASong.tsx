import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

/** Songs already written up end to end — flagged in results, not listed out. */
const READY = ["Shakedown Street", "Crazy Fingers"];

interface Props {
  /**
   * "hero" is the compact form that sits inside the hero's CTA block as the
   * first thing a phone sees. "section" is the standalone block with its own
   * headline, for anywhere further down the page.
   */
  variant?: "hero" | "section";
}

const StartWithASong = ({ variant = "section" }: Props) => {
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

  const hero = variant === "hero";

  // The hero renders in its own palette (cream on maroon) via .ds-hero__pick*;
  // the standalone section renders on the app surface with Tailwind tokens.
  if (hero) {
    return (
      <section className="ds-hero__pick" aria-labelledby="ds-pick-title">
        <span className="ds-hero__pick-burst" aria-hidden="true">New</span>
        <p className="ds-hero__pick-eyebrow">Start with a song</p>
        <h2 id="ds-pick-title" className="ds-hero__pick-title">
          Pick a song you love.
        </h2>
        <p className="ds-hero__pick-sub">
          Then meet the versions you've never heard — the first time they played it,
          the last time, and every night worth knowing in between.
        </p>

        <div ref={boxRef} style={{ position: "relative" }}>
          <label className="ds-hero__pick-field">
            <Search className="w-5 h-5 shrink-0" style={{ color: "rgba(58,3,3,0.55)" }} aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) go(matches[0].title, "search_enter"); }}
              placeholder="Dark Star, Shakedown Street…"
              aria-label="Search for a song"
              type="search"
              enterKeyHint="go"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="words"
              spellCheck={false}
              className="ds-hero__pick-input"
            />
          </label>

          {open && matches.length > 0 && (
            <ul className="ds-hero__pick-results">
              {matches.map((s2) => (
                <li key={s2.id}>
                  <button type="button" onClick={() => go(s2.title, "search_pick")} className="ds-hero__pick-result">
                    <span>{s2.title}</span>
                    {READY.includes(s2.title) && <span className="ds-hero__pick-result-ready">written up</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link to="/songbook" className="ds-hero__pick-songbook" onClick={() => captureEvent("landing_songbook_link")}>
          Or wander the Songbook
          <span className="ds-hero__pick-chip-arrow" aria-hidden="true">→</span>
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl px-5 py-10">
      <div className="text-center mb-5">
        <p className="font-ticket text-[10px] uppercase tracking-[0.18em] text-primary mb-2">
          Start with a song
        </p>
        <h2 className="font-header text-3xl md:text-4xl text-card-foreground leading-tight mb-2">
          Pick a song you love.
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-[46ch] mx-auto">
          Then meet the versions you've never heard — the first time they played it, the last
          time, and every night worth knowing in between.
        </p>
      </div>

      <div ref={boxRef} className="relative">
        <label className="flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-3 min-h-[48px] cursor-text focus-within:border-primary/50 transition-colors">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) go(matches[0].title, "search_enter"); }}
            placeholder="Dark Star, Shakedown Street…"
            aria-label="Search for a song"
            type="search"
            enterKeyHint="go"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            className="flex-1 min-w-0 self-stretch min-h-[24px] bg-transparent font-body text-base text-card-foreground placeholder:text-muted-foreground/70 outline-none"
          />
        </label>

        {open && matches.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 mt-1 rounded-sm border border-border bg-card shadow-lg overflow-hidden">
            {matches.map((s2) => (
              <li key={s2.id}>
                <button
                  type="button"
                  onClick={() => go(s2.title, "search_pick")}
                  className="w-full flex items-center justify-between gap-2 px-3 py-3 min-h-[48px] text-left hover:bg-muted/60 active:bg-muted transition-colors"
                >
                  <span className="font-body text-sm text-card-foreground">{s2.title}</span>
                  {READY.includes(s2.title) && (
                    <span className="font-ticket text-[9px] uppercase tracking-[0.12em] text-primary whitespace-nowrap">
                      written up
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 text-center">
        <Link
          to="/songbook"
          onClick={() => captureEvent("landing_songbook_link")}
          className="inline-flex items-center gap-1.5 font-ticket text-[11px] uppercase tracking-[0.12em] text-primary underline underline-offset-4"
        >
          Or wander the Songbook <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </section>
  );
};

export default StartWithASong;
