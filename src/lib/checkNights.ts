import { supabase } from "@/integrations/supabase/client";

/**
 * Checking Charlie's picks before a listening guide is saved.
 *
 * Every saved guide can become a song's Songbook entry, and the Songbook is
 * what people read as the record. On 2026-11-24 the desk found 15 of the 82
 * Songbook nights were nights the band didn't play the song (Branford on an
 * Althea that never happened), all from Charlie's picks saved unchecked. The
 * About page now says his picks are checked before a guide saves; this is the
 * check. The judgement is the tape desk's own (check-nights runs
 * _shared/nightCheck.ts against Relisten and JerryBase).
 *
 * The rule is narrow on purpose: a pick is dropped only when BOTH records rule
 * it out. A source that times out says nothing, and a save never waits on, or
 * fails because of, the check. If the function can't be reached, every pick
 * stays and the guide saves as it always did.
 */

export type PickVerdict = "played" | "not_played" | "unknown";

export const checkNights = async (
  songTitle: string,
  dates: string[],
): Promise<Map<string, PickVerdict>> => {
  const verdicts = new Map<string, PickVerdict>();
  const wanted = [...new Set(dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))];
  if (!songTitle.trim() || wanted.length === 0) return verdicts;
  try {
    const { data, error } = await supabase.functions.invoke("check-nights", {
      body: { songTitle, dates: wanted },
    });
    if (error) throw error;
    for (const r of (data?.results ?? []) as Array<{ date: string; verdict: string }>) {
      if (r.verdict === "played" || r.verdict === "not_played" || r.verdict === "unknown") {
        verdicts.set(r.date, r.verdict);
      }
    }
  } catch (e) {
    // Never blocks the save: no answer is "unknown" for every night.
    console.warn("[checkNights] check unavailable; keeping every pick", e);
  }
  return verdicts;
};

/**
 * Split picks into the ones that stay and the ones both records rule out.
 * Picks with no date, or with no verdict, stay.
 */
export const splitByVerdict = <T extends { showDate: string }>(
  picks: T[],
  verdicts: Map<string, PickVerdict>,
): { kept: T[]; dropped: T[] } => {
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const p of picks) {
    if (verdicts.get(p.showDate?.slice(0, 10)) === "not_played") dropped.push(p);
    else kept.push(p);
  }
  return { kept, dropped };
};

/** What we tell the fan when picks come out. Taper voice, no machinery. */
export const droppedPicksMessage = (songTitle: string, dropped: { showDate: string }[]): string => {
  const dates = dropped.map((d) => d.showDate.slice(0, 10));
  const list =
    dates.length === 1
      ? dates[0]
      : `${dates.slice(0, -1).join(", ")} and ${dates[dates.length - 1]}`;
  return dates.length === 1
    ? `Left out ${list}: the setlists don't have ${songTitle} that night.`
    : `Left out ${list}: the setlists don't have ${songTitle} on those nights.`;
};
