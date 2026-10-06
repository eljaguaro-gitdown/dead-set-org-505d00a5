/**
 * What a share actually says.
 *
 * Reported from a phone: sharing Franklin's Tower put a card in iMessage
 * reading "Dead Set — Every Deadhead knows the feeling" with the Cosmic
 * Charlie artwork — the generic app card, with no mention of the song. The
 * picker was calling navigator.share with a bare title and no text at all, so
 * every song went out looking like every other song.
 *
 * THE RULE, and it holds for every kind of share: a shared link sells what it
 * is, and the music is one tap away, not a scroll away. A song share names the
 * song. A Songbook share names the song and what the crates turned up. A
 * setlist share names the night. The app share sells the shelf. None of them
 * goes out as "Dead Set" and a bare url.
 *
 * Every payload is built by `payload()` below — one skeleton, six callers — so
 * a new surface cannot invent a seventh shape, and the closing line is always
 * an invitation to press play rather than a brand stamp. If you are adding a
 * share surface, add a function here and call it; do not assemble a string at
 * the call site. `shareSurfacesUseShareCopy.test.ts` enforces that.
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
  /**
   * The message body, ENDING IN THE URL. Callers paste this whole string —
   * clipboard, SMS body, mailto body, DM — and must not append the url again.
   * `navigator.share` still takes `url` separately, which is what gives the
   * native sheet its link affordance.
   */
  text: string;
}

/** "Jay sent you " — only when we know who they are. */
const fromLine = (senderName?: string | null) =>
  senderName?.trim() ? `${senderName.trim()} sent you ` : "";

/**
 * The one shape every share takes.
 *
 * `lead` names the thing (sells it), `detail` is the evidence worth passing on,
 * and `listen` is the tap — the second half of the rule, which is why it is a
 * required argument rather than a constant. A share that does not invite a
 * press of play is a share that asks someone to go read a page.
 */
const payload = (args: {
  title: string;
  lead: string;
  detail?: string | null;
  listen: string;
  url: string;
}): SharePayload => ({
  title: args.title,
  text: [
    `${ROSE} ${args.lead}`,
    args.detail?.trim() ? args.detail.trim() : null,
    "",
    `${BOLT} ${args.listen}`,
    "",
    args.url,
  ]
    .filter((l) => l !== null)
    .join("\n"),
});

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
  return payload({
    title: `${args.songTitle} — every version worth knowing`,
    lead: `${fromLine(args.senderName)}${args.songTitle}`,
    detail: life
      ? `${life}. First time played to last, and every night worth the evening.`
      : null,
    listen: "Tap any night to hear it — Dead-Set.Org",
    url: args.url,
  });
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
  return payload({
    title: `${args.songTitle} — a listening guide`,
    lead: `${fromLine(args.senderName)}a listening guide for ${args.songTitle}`,
    detail: count
      ? `${count} version${count === 1 ? "" : "s"}, in order, start to finish.`
      : null,
    listen: "Press play and listen straight through — Dead-Set.Org",
    url: args.url,
  });
};

/**
 * Sharing the app itself.
 *
 * The one share that is not about a specific night, so it has to sell the
 * shelf instead: what you can do here, and that you can press play without
 * signing up.
 */
export const shareAppCopy = (args: {
  url: string;
  senderName?: string | null;
}): SharePayload =>
  payload({
    title: "Dead Set — Every Deadhead knows the feeling",
    lead: `${fromLine(args.senderName)}Dead Set`,
    detail:
      "Thousands of live recordings, every night the tapers kept. Find the version, not just the song.",
    listen: "Press play, no signup — Dead-Set.Org",
    url: args.url,
  });

/**
 * Sharing a setlist — a reconstructed night with an arc, not a playlist.
 */
export const shareSetlistCopy = (args: {
  setlistName: string;
  url: string;
  senderName?: string | null;
  songCount?: number | null;
  /** The setlist's own description, when its builder wrote one. */
  oneLiner?: string | null;
}): SharePayload => {
  const count = args.songCount && args.songCount > 0 ? args.songCount : null;
  const own = args.oneLiner?.trim();
  return payload({
    title: `${args.setlistName} — a setlist on Dead-Set.Org`,
    lead: `${fromLine(args.senderName)}${args.setlistName}`,
    detail:
      own && own !== args.setlistName
        ? own
        : count
          ? `${count} song${count === 1 ? "" : "s"}, in order, start to finish.`
          : null,
    listen: "Press play to hear the whole night — Dead-Set.Org",
    url: args.url,
  });
};

/**
 * Sharing one song, usually one specific night of it.
 */
export const shareSongCopy = (args: {
  songTitle: string;
  url: string;
  senderName?: string | null;
  showDate?: string | null;
  venue?: string | null;
}): SharePayload => {
  const night = args.showDate
    ? `${args.showDate}${args.venue ? ` · ${args.venue}` : ""}`
    : null;
  return payload({
    title: night
      ? `${args.songTitle} — ${night}`
      : `${args.songTitle} on Dead-Set.Org`,
    lead: `${fromLine(args.senderName)}${args.songTitle}`,
    detail: night,
    listen: "Tap to hear this one — Dead-Set.Org",
    url: args.url,
  });
};

/**
 * Sharing a Songbook issue — the crates' answer for one song.
 *
 * This is the share with the most to sell, because the page is the result of
 * the work: how long the song lived, how many nights are worth knowing, and
 * who mapped it. The lifespan is the line people quote back.
 */
export const shareSongbookCopy = (args: {
  songTitle: string;
  url: string;
  senderName?: string | null;
  issueNumber?: number | null;
  mappedBy?: string | null;
  nightCount?: number | null;
  timesPlayed?: number | null;
  firstPlayed?: string | null;
  lastPlayed?: string | null;
}): SharePayload => {
  const life = lifespanLine(args);
  const nights =
    args.nightCount && args.nightCount > 0
      ? `${args.nightCount} night${args.nightCount === 1 ? "" : "s"} worth knowing`
      : null;
  const credit = args.mappedBy?.trim() ? `mapped by ${args.mappedBy.trim()}` : null;
  const second = [life, [nights, credit].filter(Boolean).join(", ")]
    .filter((p) => p)
    .join(". ");
  return payload({
    title: args.issueNumber
      ? `${args.songTitle} — The Songbook, Vol. ${args.issueNumber}`
      : `${args.songTitle} — The Songbook`,
    lead: `${fromLine(args.senderName)}${args.songTitle} in The Songbook`,
    detail: second ? `${second}.` : null,
    listen: "Tap any night to hear it — Dead-Set.Org",
    url: args.url,
  });
};

/**
 * Sharing a collaboration invite — "come build this with me".
 *
 * The one share whose ask is not just to listen: the recipient can edit. It
 * still has to sell the night first, because an invite that opens with
 * "collaborate" describes the mechanism rather than the music.
 */
export const shareCollabCopy = (args: {
  setlistName: string;
  url: string;
  senderName?: string | null;
  /** The setlist's own description, when its builder wrote one. */
  oneLiner?: string | null;
}): SharePayload => {
  const own = args.oneLiner?.trim();
  const who = args.senderName?.trim();
  return {
    title: `${args.setlistName} — build it with me on Dead-Set.Org`,
    text: payload({
      title: "",
      lead: who
        ? `${who} is building ${args.setlistName}`
        : `${args.setlistName} — in progress`,
      detail:
        own && own !== args.setlistName
          ? own
          : "Still being put together. Pull up a chair.",
      listen: "Press play, or pick up where I left off — Dead-Set.Org",
      url: args.url,
    }).text,
  };
};
