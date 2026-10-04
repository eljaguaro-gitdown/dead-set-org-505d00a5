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
 */
export type InviteIntent = "share" | "save";

/** All of it in one place so the two surfaces cannot drift apart. */
export const INVITE_COPY: Record<
  InviteIntent,
  { title: string; body: string; primary: string; secondary?: string }
> = {
  share: {
    title: "Pass it on.",
    body: "Tapes have always circulated with the taper's name on them. Sign in and this one goes out carrying yours — and you'll find it again on your shelf.",
    primary: "Sign in and send it",
    secondary: "Just copy the link",
  },
  save: {
    title: "Keep it on your shelf.",
    body: "A listening guide lives in your account — that's how it's still here next time, and how anyone you send it to can follow the night in order.",
    primary: "Sign in and keep it",
  },
};

