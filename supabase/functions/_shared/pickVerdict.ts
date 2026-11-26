/**
 * Does one of Charlie's picks hold up? The verdict check-nights returns for a
 * song on a night, from the desk's own judgement (nightCheck.ts).
 *
 *   played      a tape of the night carries the song, or JerryBase lists it
 *   not_played  JerryBase doesn't list it AND no Relisten source of the night
 *               has it: the desk's class N, two independent sources agreeing
 *   unknown     a source didn't answer. Never grounds to drop a pick: a
 *               timeout is not evidence the band didn't play it.
 *
 * Only `not_played` takes a night out of a guide.
 */
import type { NightJudgement } from "./nightCheck.ts";

export type PickVerdict = "played" | "not_played" | "unknown";

export function pickVerdict(j: Pick<NightJudgement, "supports" | "setlistPlayed" | "onTape">): PickVerdict {
  if (j.supports === "N") return "not_played";
  if (j.onTape === "yes" || j.setlistPlayed === "yes") return "played";
  return "unknown";
}
