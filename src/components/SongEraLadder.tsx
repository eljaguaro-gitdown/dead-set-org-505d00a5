import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { songbookDb } from "@/lib/songbookDb";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * The era ladder — every ranked version of one song, grouped by the era it
 * belongs to, so a listener can hear the song change shape across the band.
 *
 * Two distinct layouts, not one reflowed layout:
 *   Desktop — a horizontal proportional timeline (1965–1995) above the eras.
 *   Mobile  — the timeline turns on its side and becomes the spine running
 *             down the page, with each era hanging off it. A 31-year axis
 *             squeezed into 360px is unreadable; a vertical rail is not.
 */

const SLEEPER_RATIO = 0.3; // under 30% of the song's leader

export interface LadderEra {
  id: string;
  name: string;
  year_start: number;
  year_end: number;
  description: string | null;
}

export interface LadderVersion {
  id: string;
  show_date: string | null;
  venue: string | null;
  city: string | null;
  era_id: string | null;
  votes: number | null;
  vote_source: string | null;
  source_url: string | null;
  blurb: string | null;
  is_benchmark: boolean | null;
  archive_org_url: string | null;
}

interface Props {
  songId: string;
  songTitle: string;
  /** Highlighted as "you are here" — e.g. the version a share link landed on. */
  activeVersionId?: string | null;
  onPlay?: (version: LadderVersion) => void;
}

/** Era accent colours. Every one of the seven DB eras gets one — the old
 *  ERA_COLOR_VAR map keyed on different names, so six of seven fell back. */
const ERA_COLORS: Record<string, string> = {
  "Primal Dead": "var(--dead-pink)",
  "Americana Peak": "var(--dead-gold)",
  "Hiatus & Return": "var(--dead-green)",
  "Shakedown Street": "var(--dead-orange)",
  "Go to Nassau": "var(--dead-blue)",
  "Touch of Grey": "var(--dead-red)",
  "Final Run": "var(--dead-purple)",
};
const eraColor = (name: string) => `hsl(${ERA_COLORS[name] ?? "var(--primary)"})`;

const fmtDate = (iso: string | null) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
};

const SongEraLadder = ({ songId, songTitle, activeVersionId, onPlay }: Props) => {
  const isMobile = useIsMobile();
  const [eras, setEras] = useState<LadderEra[]>([]);
  const [versions, setVersions] = useState<LadderVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [openEra, setOpenEra] = useState<string | null>(null);
  const [sleepersOnly, setSleepersOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: e }, { data: v }] = await Promise.all([
        supabase.from("eras").select("id, name, year_start, year_end, description").order("year_start"),
        songbookDb
          .from("notable_versions")
          .select("id, show_date, venue, city, era_id, votes, vote_source, source_url, blurb, is_benchmark, archive_org_url")
          .eq("song_id", songId)
          .order("show_date"),
      ]);
      if (cancelled) return;
      setEras((e ?? []) as LadderEra[]);
      setVersions((v ?? []) as LadderVersion[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [songId]);

  const leader = useMemo(
    () => versions.reduce((max, v) => Math.max(max, v.votes ?? 0), 0),
    [versions],
  );
  const sleeperCutoff = leader * SLEEPER_RATIO;
  const isSleeper = (v: LadderVersion) => v.votes != null && leader > 0 && v.votes < sleeperCutoff;
  const sleeperCount = versions.filter(isSleeper).length;

  const byEra = useMemo(() => {
    const map = new Map<string, LadderVersion[]>();
    for (const v of versions) {
      if (!v.era_id) continue;
      const list = map.get(v.era_id) ?? [];
      list.push(v);
      map.set(v.era_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
    return map;
  }, [versions]);

  const liveEras = eras.filter((e) => (byEra.get(e.id)?.length ?? 0) > 0);
  const axisStart = eras.length ? eras[0].year_start : 1965;
  const axisEnd = eras.length ? eras[eras.length - 1].year_end + 1 : 1996;

  const shown = (list: LadderVersion[]) => (sleepersOnly ? list.filter(isSleeper) : list);

  if (loading) {
    return <div className="font-ticket text-xs text-muted-foreground py-8 text-center">Reading the archive…</div>;
  }
  if (!versions.length) {
    return (
      <div className="border border-dashed border-border rounded-sm p-5 text-center">
        <p className="font-ticket text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
          No ranked versions yet
        </p>
        <p className="font-body text-sm text-muted-foreground">
          {songTitle} hasn't been mapped across the eras yet. That gap is the work — tell us which version
          belongs here from <a href="/backstage" className="text-primary underline underline-offset-2">Backstage</a>.
        </p>
      </div>
    );
  }

  return (
    <section aria-label={`${songTitle} by era`}>
      {/* ── THE ERA SPINE ─────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2 flex-wrap mb-1">
          <h2 className="font-header text-xl text-card-foreground">The Seven Eras</h2>
          <span className="font-ticket text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            how Dead Set organises 30 years
          </span>
        </div>
        <p className="font-body text-sm text-muted-foreground max-w-[58ch] mb-4">
          The Dead played for three decades and never twice the same way. An era opens when something
          structural changes — who sat at the keyboard, what they'd just released, or a break in touring.
          Every song lives differently in each one.
        </p>

        {/* Desktop: proportional horizontal timeline */}
        {!isMobile && (
          <>
            <div className="flex h-7 rounded-sm overflow-hidden border border-border" role="group" aria-label="Era timeline">
              {eras.map((e) => {
                const live = (byEra.get(e.id)?.length ?? 0) > 0;
                const span = e.year_end + 1 - e.year_start;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setOpenEra(openEra === e.id ? null : e.id)}
                    title={`${e.name} (${e.year_start}–${e.year_end})`}
                    aria-label={`${e.name}, ${e.year_start} to ${e.year_end}`}
                    className="border-r border-black/20 last:border-r-0 transition-[filter] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground"
                    style={{
                      flex: `${span} 0 0`,
                      background: live
                        ? eraColor(e.name)
                        : "repeating-linear-gradient(45deg, hsl(var(--muted-foreground)/0.3) 0 4px, transparent 4px 8px)",
                    }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between font-mono text-[10px] text-muted-foreground tabular-nums mt-1 mb-4">
              <span>{axisStart}</span>
              <span>{axisEnd - 1}</span>
            </div>
          </>
        )}

        {/* Era chips — the legend that names the taxonomy, both layouts */}
        <div className="grid gap-1" style={{ gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fit,minmax(9.5rem,1fr))" }}>
          {eras.map((e) => {
            const live = (byEra.get(e.id)?.length ?? 0) > 0;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setOpenEra(openEra === e.id ? null : e.id)}
                aria-pressed={openEra === e.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-sm border text-left transition-colors ${
                  openEra === e.id ? "bg-muted/60 border-current" : "border-transparent hover:bg-muted/40 hover:border-border"
                } ${live ? "text-card-foreground" : "text-muted-foreground"}`}
                style={openEra === e.id ? { borderColor: eraColor(e.name) } : undefined}
              >
                <span
                  className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                  style={{
                    background: live
                      ? eraColor(e.name)
                      : "repeating-linear-gradient(45deg, hsl(var(--muted-foreground)/0.5) 0 3px, transparent 3px 6px)",
                  }}
                />
                <span className="min-w-0">
                  <span className="block font-body text-xs font-medium leading-tight truncate">{e.name}</span>
                  <span className="block font-mono text-[10px] text-muted-foreground tabular-nums">
                    {e.year_start}–{e.year_end}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Explainer tray */}
        {openEra && (() => {
          const e = eras.find((x) => x.id === openEra);
          if (!e) return null;
          const n = byEra.get(e.id)?.length ?? 0;
          return (
            <div
              className="mt-3 p-3 rounded-r-sm bg-muted/50 border-l-[3px]"
              style={{ borderColor: eraColor(e.name) }}
            >
              <div className="flex items-baseline gap-2 flex-wrap mb-1">
                <h3 className="font-header text-lg text-card-foreground">{e.name}</h3>
                <span className="font-mono text-[11px] tabular-nums" style={{ color: eraColor(e.name) }}>
                  {e.year_start}–{e.year_end}
                </span>
                <span className="ml-auto font-ticket text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {n ? `${n} ranked` : "song not played"}
                </span>
              </div>
              <p className="font-body text-sm text-muted-foreground">{e.description}</p>
            </div>
          );
        })()}
      </div>

      {/* ── SLEEPER CARD ──────────────────────────────────────────────── */}
      {sleeperCount > 0 && (
        <div className="mb-6 p-4 rounded-sm border border-primary/40 bg-gradient-to-b from-primary/[0.13] to-primary/[0.05]">
          <p className="font-ticket text-[10px] uppercase tracking-[0.18em] text-primary mb-1">Why you're really here</p>
          <h3 className="font-header text-xl md:text-2xl text-card-foreground leading-tight mb-2">
            {sleeperCount} you probably haven't heard
          </h3>
          <p className="font-body text-sm text-muted-foreground max-w-[52ch] mb-3">
            A <strong className="text-card-foreground font-medium">sleeper</strong> is a version enough heads
            voted onto the all-time list that it isn't a random pick — but that polls under 30% of the leader.
            Real regard, almost no attention.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setSleepersOnly(true)}
              aria-pressed={sleepersOnly}
              className={`font-ticket text-[11px] uppercase tracking-[0.1em] px-4 py-2.5 rounded-sm transition-colors ${
                sleepersOnly ? "bg-primary/80 text-primary-foreground" : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              ▶ Play the {sleeperCount} sleepers
            </button>
            <button
              type="button"
              onClick={() => setSleepersOnly(false)}
              aria-pressed={!sleepersOnly}
              className={`font-ticket text-[11px] uppercase tracking-[0.1em] px-3 py-2.5 rounded-sm transition-colors ${
                !sleepersOnly ? "border border-border bg-muted/50 text-card-foreground" : "text-muted-foreground underline underline-offset-4 hover:text-card-foreground"
              }`}
            >
              Show all {versions.length}
            </button>
          </div>
        </div>
      )}

      {/* ── THE LADDER ────────────────────────────────────────────────── */}
      <div className={isMobile ? "relative pl-5" : ""}>
        {/* Mobile: the vertical spine the eras hang off */}
        {isMobile && <span aria-hidden className="absolute left-[5px] top-2 bottom-2 w-px bg-border" />}

        {liveEras.map((e) => {
          const list = shown(byEra.get(e.id) ?? []);
          const total = byEra.get(e.id)?.length ?? 0;
          const color = eraColor(e.name);
          return (
            <section
              key={e.id}
              id={`era-${e.id}`}
              className={`pt-5 mt-5 first:mt-1 first:pt-1 ${isMobile ? "" : "border-t border-dashed border-primary/25 first:border-t-0"}`}
              style={{ opacity: list.length ? 1 : 0.4 }}
            >
              {isMobile && (
                <span
                  aria-hidden
                  className="absolute left-0 w-[11px] h-[11px] rounded-full border-2 border-background"
                  style={{ background: color, marginTop: "0.35rem" }}
                />
              )}

              <div className="flex items-center gap-2 flex-wrap mb-1">
                {!isMobile && <span className="w-5 h-[3px] rounded-sm shrink-0" style={{ background: color }} />}
                <h3 className="font-header text-lg text-card-foreground">{e.name}</h3>
                <span className="font-mono text-[11px] tabular-nums" style={{ color }}>
                  {e.year_start}–{e.year_end}
                </span>
                <span className="ml-auto font-ticket text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                  {sleepersOnly ? `${list.length} of ${total}` : `${total} ranked`}
                </span>
              </div>

              <div className="flex flex-col gap-0.5 mt-2">
                {list.map((v) => {
                  const sleeper = isSleeper(v);
                  const here = v.id === activeVersionId;
                  const pct = leader ? Math.round(((v.votes ?? 0) / leader) * 100) : 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => onPlay?.(v)}
                      className={`w-full text-left rounded-sm border px-2.5 py-2.5 transition-colors ${
                        here
                          ? "bg-primary/12 border-primary/45"
                          : "border-transparent hover:bg-muted/50 hover:border-border"
                      }`}
                    >
                      {/* Mobile stacks; desktop puts meta in a right rail */}
                      <div className={isMobile ? "" : "grid grid-cols-[1fr_auto] gap-x-4 items-baseline"}>
                        <div className="min-w-0">
                          <span className={`block font-hand text-xl leading-tight ${here ? "text-primary" : "text-[hsl(var(--dead-blue))]"}`}>
                            {fmtDate(v.show_date)}
                          </span>
                          <span className="block font-ticket text-[11px] text-muted-foreground mt-0.5">
                            {v.venue}{v.city ? ` · ${v.city}` : ""}
                          </span>
                          {v.blurb && (
                            <span className="block font-body text-[13px] leading-relaxed text-muted-foreground mt-1.5 max-w-[46ch]">
                              {v.blurb}
                            </span>
                          )}
                        </div>

                        <div className={isMobile
                          ? "flex items-center gap-2 flex-wrap mt-2"
                          : "flex flex-col items-end gap-1 shrink-0"}>
                          {here && <Chip tone="here">You are here</Chip>}
                          {v.is_benchmark && !here && <Chip tone="canon">★ Era benchmark</Chip>}
                          {sleeper && <Chip tone="sleep">◆ Sleeper</Chip>}
                          {v.votes != null && (
                            <span className="font-mono text-[13px] font-medium text-card-foreground tabular-nums leading-none">
                              {v.votes}
                              <span className="font-ticket text-[9px] uppercase tracking-[0.1em] text-muted-foreground ml-1 font-normal">
                                votes
                              </span>
                            </span>
                          )}
                          {v.votes != null && (
                            <span className="block w-[84px] h-[3px] rounded-sm bg-muted-foreground/30 overflow-hidden">
                              <span className="block h-full rounded-sm" style={{ width: `${pct}%`, background: color }} />
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* ── METHOD + PROVENANCE ───────────────────────────────────────── */}
      <div className="mt-7 p-4 rounded-r-sm border-l-[3px] border-[hsl(var(--dead-blue))] bg-[hsl(var(--dead-blue)/0.07)]">
        <h4 className="font-ticket text-[10px] uppercase tracking-[0.18em] text-[hsl(var(--dead-blue))] mb-2">
          The arithmetic behind the badges
        </h4>
        <p className="font-body text-[13px] leading-relaxed text-muted-foreground max-w-[62ch] mb-2">
          <strong className="text-card-foreground font-medium">★ Era benchmark</strong> — the highest-voted
          version inside that era. <strong className="text-card-foreground font-medium">◆ Sleeper</strong> —
          ranked on the all-time list but polling under 30% of the leader
          {leader > 0 && <> (fewer than {Math.ceil(sleeperCutoff)} votes against {leader})</>}.
        </p>
        <p className="font-body text-[13px] leading-relaxed text-muted-foreground max-w-[62ch]">
          Arithmetic on public vote counts, not an opinion we invented. Where no data exists, the ladder shows
          the gap rather than filling it with adjectives.
          {versions.find((v) => v.source_url) && (
            <>
              {" "}Rankings from{" "}
              <a
                href={versions.find((v) => v.source_url)!.source_url!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                {versions.find((v) => v.vote_source)?.vote_source ?? "source"}
              </a>.
            </>
          )}
        </p>
      </div>
    </section>
  );
};

const Chip = ({ tone, children }: { tone: "canon" | "sleep" | "here"; children: React.ReactNode }) => {
  const tones = {
    canon: "text-[hsl(var(--dead-gold))] border-[hsl(var(--dead-gold)/0.6)] bg-[hsl(var(--dead-gold)/0.1)]",
    sleep: "text-[hsl(var(--dead-green))] border-[hsl(var(--dead-green)/0.6)] bg-[hsl(var(--dead-green)/0.1)]",
    here: "text-primary border-primary/60 bg-primary/12",
  } as const;
  return (
    <span className={`font-ticket text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-[2px] border whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
};

export default SongEraLadder;
