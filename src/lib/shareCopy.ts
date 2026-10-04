/**
 * What a share actually says.
 *
 * Reported from a phone: sharing Franklin's Tower put a card in iMessage
 * reading "Dead Set — Every Deadhead knows the feeling" with the Cosmic
 * Charlie artwork — the generic app card, with no mention of the song. The
 * picker was calling navigator.share with a bare title and no text at all, so
 * every song went out looking like every other song.
 *
 * A share is someone handing a specific night to a specific person. It should
 * name what is being passed on, and sound like it was worth passing on.
 *
 * NOTE on the preview card: the rich unfurl in iMessage comes from the OG tags
 * on the URL, not from anything here. The app is a single page, so a crawler
 * gets index.html's static tags for every route. This module fixes the TEXT —
 * which is what SMS, WhatsApp, email and a pasted link all show — and the
 * card needs crawler-visible meta per route, which is a separate job.
 */

const ROSE = "🌹";
const BOLT = "⚡";

export interface SharePayload {
  title: string;
  text: string;
}

/** "Jay sent you " — only when we know who they are. */
const fromLine = (senderName?: string | null) =>
  senderName?.trim() ? `${senderName.trim()} sent you ` : "";

/** "336 times · 1975 to 1995" — the life of the song, when the catalog knows it. */
export const lifespanLine = (args: {
  timesPlayed?: number | null;
  firstPlayed?: string | null;
  lastPlayed?: string | null;
}): string | null => {
  const parts: string[] = [];
  if (args.timesPlayed != null) parts.push(`${args.timesPlayed} times`);
  const first = args.firstPlayed?.slice(0, 4);
  const last = args.lastPlayed?.slice(0, 4);
  if (first && last) parts.push(first === last ? first : `${first} to ${last}`);
  else if (first) parts.push(`from ${first}`);
  return parts.length ? parts.join(" · ") : null;
};

/**
 * Sharing a song's versions page — the thing the picker sends.
 */
export const shareVersionsCopy = (args: {
  songTitle: string;
  url: string;
  senderName?: string | null;
  timesPlayed?: number | null;
  firstPlayed?: string | null;
  lastPlayed?: string | null;
}): SharePayload => {
  const life = lifespanLine(args);
  const title = `${args.songTitle} — every version worth knowing`;
  const lines = [
    `${ROSE} ${fromLine(args.senderName)}${args.songTitle}`,
    life ? `${life}. First time played to last, and every night worth the evening.` : null,
    "",
    `${BOLT} Dead-Set.Org`,
    "",
    args.url,
  ].filter((l) => l !== null);
  return { title, text: lines.join("\n") };
};

/**
 * Sharing a listening guide — a reconstructed night, not a page of options.
 */
export const shareGuideCopy = (args: {
  songTitle: string;
  url: string;
  senderName?: string | null;
  slotCount?: number | null;
}): SharePayload => {
  const count = args.slotCount && args.slotCount > 0 ? args.slotCount : null;
  const title = `${args.songTitle} — a listening guide`;
  const lines = [
    `${ROSE} ${fromLine(args.senderName)}a listening guide for ${args.songTitle}`,
    count ? `${count} version${count === 1 ? "" : "s"}, in order, start to finish.` : null,
    "",
    `${BOLT} Dead-Set.Org`,
    "",
    args.url,
  ].filter((l) => l !== null);
  return { title, text: lines.join("\n") };
};
