/**
 * What we say when something needs an account, in one place so the surfaces
 * cannot drift apart.
 *
 * Two intents, because the honest answer differs between them:
 *
 * - `share`: /versions/:slug is a PUBLIC url. Anyone can read it signed out,
 *   and on a phone it is two taps out of the address bar. So signing in is not
 *   a technical requirement here and the copy must not pretend it is — what it
 *   actually buys is credit, which is the real thing and the better offer.
 * - `save`: a listening guide is a row owned by a user. It genuinely cannot
 *   exist without an account, so there is no second door and the copy says so.
 *
 * The benefits are spelled out as three concrete things rather than argued in
 * a paragraph. Once a plain link and an Instagram post are both on the sheet,
 * "sign in" has to earn its place against two doors that cost nothing — and a
 * reason you can read in two seconds beats a sentence you skim.
 */

export type InviteIntent = "share" | "save";

export interface InviteCopy {
  title: string;
  body: string;
  /** The case for signing in, in the order it matters. */
  benefits: string[];
  primary: string;
  /** Share only — the doors that cost nothing, and what they cost you. */
  plainLabel?: string;
  instagramLabel?: string;
  plainNote?: string;
}

export const INVITE_COPY: Record<InviteIntent, InviteCopy> = {
  share: {
    title: "Pass it on.",
    body: "Tapes have always circulated with the taper's name on them.",
    benefits: [
      "Your name travels with it",
      "It's on your shelf whenever you want it back",
      "A song nobody's mapped yet becomes yours in the Songbook",
    ],
    primary: "Sign in and send it",
    instagramLabel: "Share to Instagram",
    plainLabel: "Just copy the link",
    plainNote: "goes out plain, with nobody's name on it",
  },
  save: {
    title: "Keep it on your shelf.",
    body: "A listening guide lives in your account — that's what makes it still here next time.",
    benefits: [
      "Yours to come back to, in the order you built it",
      "Anyone you send it to can follow the night start to finish",
      "If nobody's mapped this song yet, the Songbook gets it under your name",
    ],
    primary: "Sign in and keep it",
  },
};
