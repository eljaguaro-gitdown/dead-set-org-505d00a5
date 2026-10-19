/**
 * Who counts as "us" on the admin dashboard.
 *
 * Every admin number used to include the owner and the test accounts. On
 * 2026-10-08 the admin account alone was 158 of 261 setlists, 62% of a week's
 * plays, 8 of 10 landing-button taps, and 3 of the 6 people the sign-up funnel
 * said had signed up. A dashboard that counts its own author reads as traffic
 * that is not there.
 *
 * Internal = anyone with the admin role (read live from user_roles by the
 * caller), plus the accounts below. Keep the list explicit: a pattern that
 * guesses at "looks like a test" would sooner or later swallow a real fan.
 * Apple private-relay addresses are deliberately NOT matched — real fans sign
 * in with Apple too — so a test account made that way has to be added by id.
 *
 * Free of Deno APIs so the app's Vitest suite can import it.
 */

/** The owner's other accounts and the hand-made test accounts, by email. */
export const INTERNAL_ACCOUNT_EMAILS: readonly string[] = [
  "eljaguaro@gmail.com", // the admin account itself (also covered by role)
  "eljaguaro+appreview@gmail.com", // deadset_review, the App Review demo account
  "grateful_jaguaro@dead-set.org",
  "test_welcome_email_2026@dead-set.org",
  "jay@projectwheelhouse.com",
  "jay@thewheelhouseworkshop.com", // "DJ Dead Set"
  "jay_cohen@icloud.com",
];

/** Addresses that cannot belong to a real fan. */
const INTERNAL_EMAIL_PATTERNS: readonly RegExp[] = [
  /@example\.com$/i, // reserved for documentation, never deliverable
  /\.test$/i, // reserved TLD, e.g. qa-verify-race-test-0713@dead-set-org-qa.test
];

export const isInternalEmail = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return INTERNAL_ACCOUNT_EMAILS.includes(e) || INTERNAL_EMAIL_PATTERNS.some((p) => p.test(e));
};

/** Ids of every internal account: admins by role, plus the list above by email. */
export const internalUserIds = (
  users: ReadonlyArray<{ id: string; email?: string | null }>,
  adminIds: Iterable<string>,
): Set<string> => {
  const ids = new Set<string>(adminIds);
  for (const u of users) if (isInternalEmail(u.email)) ids.add(u.id);
  return ids;
};
