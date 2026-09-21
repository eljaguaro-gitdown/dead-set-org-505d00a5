/**
 * Turning Supabase auth errors into something a fan can act on.
 *
 * Measured over the life of the project: 30 email signup attempts produced 16
 * failures. Nine were the breached-password check, seven were "User already
 * registered", and five more people failed sign-in on bad credentials. Every
 * one of them got Supabase's raw string in a red toast and no way forward —
 * the largest measured leak in the funnel, and none of it near a consent
 * screen.
 *
 * Shared by /auth and AuthModal deliberately. Two surfaces with their own
 * copies of the same mapping is how the sign-in claim in the reviewer notes
 * came to disagree with the app for half a day.
 */

export type AuthErrorAction =
  /** They already have an account — put them on the sign-in form, email kept. */
  | "switch-to-signin"
  | null;

export interface FriendlyAuthError {
  message: string;
  action: AuthErrorAction;
}

export function describeAuthError(raw: string | undefined | null): FriendlyAuthError {
  const text = (raw ?? "").trim();

  // Supabase's HIBP check. The default copy tells a fan their password is bad
  // and nothing else, at the exact moment they are deciding whether to bother.
  if (/weak|easy to guess|pwned|breach/i.test(text)) {
    return {
      message:
        "That password shows up in known breach lists, so it won't hold. Three or four unrelated words beats symbols — and it's easier to remember.",
      action: null,
    };
  }

  if (/already registered|already exists|user already/i.test(text)) {
    return {
      message: "You're already on the list — sign in with that email instead.",
      action: "switch-to-signin",
    };
  }

  if (/invalid login credentials/i.test(text)) {
    return {
      message:
        "That email and password don't match. Try again, or use \"Forgot your password?\" below.",
      action: null,
    };
  }

  if (/email not confirmed/i.test(text)) {
    return {
      message: "Check your email for the confirmation link — it has to be tapped before you can sign in.",
      action: null,
    };
  }

  // Anything unmapped keeps Supabase's own wording: a vague friendly message
  // would be worse than a precise unfamiliar one.
  return { message: text || "Something went wrong. Give it another go.", action: null };
}
