# Rejection 2 — Guidelines 5.1.1(v) and 1.2 (2026-09-30)

Build 27, submission `f8593d8a-e9fc-4a91-a4b5-dabad5b63632`, reviewed
2026-09-30 **on an iPad Air 11-inch (M3)**. Dead Set is iPhone-only
(`TARGETED_DEVICE_FAMILY = 1`), so the reviewer saw the iPhone layout in
compatibility mode.

This time the findings are real. The 2.1 round had no findings against the
binary. This one names two guidelines, and both were partly our fault.

## What Apple said, and what was actually true

### 5.1.1(v): "does not include an option to initiate account deletion"

**Deletion existed.** It sat in `Profile.tsx` under a heading reading "Danger
Zone", below the avatar, the name, the email, the home-state picker and the
Save button. Getting there took: menu → Profile → scroll past the form. The
words "delete account" appeared nowhere until you reached the button itself.
Both the reviewer notes and the 2.1 recording pointed at it, and the reviewer
still did not find it.

**The lesson:** Apple does not follow our notes to a feature. The reviewer looks
where Apple's guidance says to look, for a control named for what it does. A
feature that exists but is not findable reads as a feature that is missing.

### 1.2: "does not have all the required precautions"

Apple's checklist has five parts. We had built one and a half of them, and the
reviewer notes claimed all of them:

| Apple asks for | Build 27 had | Gap |
|---|---|---|
| Users **agree** to terms with zero tolerance, presented **before** registering or logging in | An 11px "By continuing you agree" line **below** every sign-in button | Passive, and placed after the buttons, not before them |
| A method for **filtering** objectionable content | Nothing | Missing entirely |
| A mechanism to **flag** content | Flag on comments and DM threads; on setlists, a 10px "Report this setlist" text link at 50% opacity under the comments | Notes said "the flag on any setlist". There was no flag |
| A mechanism to **block**, which **notifies the developer** and **removes content from the feed instantly** | Block on comments and DMs only; hid comments client-side | No way to block a setlist's curator. Blocked users' setlists stayed in every feed. The developer was never notified |
| The developer **acts within 24 hours**, removing content and ejecting the user | Queue with "resolved/dismissed" buttons that did neither; no notification of new reports | The one report filed during the 2.1 recording (2026-09-24 18:30 UTC) was **still open on 2026-09-30** |

The last row matters most. The reviewer cannot see our queue, but the commitment
is real, and the process could not keep it.

## What changed (branch `fix/appstore-deletion-ugc`)

| Apple asks for | Now |
|---|---|
| Deletion, findable | Menu → **Delete Account** → `/profile#delete-account`, which scrolls to a section titled **Delete Account** |
| Terms before sign-in | `TermsAgreement` checkbox **above** Google / Apple / email on `/auth` and in `AuthModal`. Every path is gated by `useTermsAgreement().requireAgreement()`, and an unticked tap toasts and highlights the box. Acceptance is remembered per device, keyed to the Terms date |
| Filter | `src/lib/contentFilter.ts` (client) + `public.is_objectionable()` with BEFORE triggers on `setlists`, `setlist_comments`, `direct_messages`, `chat_messages` and `profiles` (update only). `contentFilterSync.test.ts` fails if the two term lists drift |
| Flag | `SafetyMenu`: a flag beside "curated by *name*" on every setlist and on every profile, opening Report or Block. Comments and DM threads are unchanged |
| Block → hidden instantly | RESTRICTIVE SELECT policies on `setlists` and `setlist_comments`, so blocking hides the content in **every** feed at the data layer. The client invalidates every cached query on block |
| Block → developer notified | A trigger on `blocked_users` files a `profile` report on the blocked account |
| Act in 24h | A trigger on `content_reports` emails the admins at once (`moderation-report` template). The queue now shows the reported text and its author, with **Remove**, **Remove + ban** (ban = `auth.admin` ban for ~100 years, plus every setlist unpublished) and **Dismiss**, via `admin-users?action=reports|moderate` |
| Terms text | Section 5 names the filter, the block behaviour, and the 24-hour commitment. The title is now "Terms of Use" |

Also: `delete-account` now removes `blocked_users` rows on both sides.

## Release order: each step depends on the one before

1. **Merge the PR.**
2. **Apply the migration** `20260930120000_ugc_safety_pass.sql` to production.
   Then verify the database half, which cannot be tested locally because there is
   no Postgres here:
   ```sql
   select public.is_objectionable('what a fucking jam') as should_be_true,
          public.is_objectionable('Dick''s Picks Vol. 8') as should_be_false,
          public.is_objectionable('Cumberland Blues') as should_be_false;
   select tgname, tgrelid::regclass from pg_trigger
    where tgname in ('filter_objectionable_text','report_on_block','notify_moderation_report');
   select policyname from pg_policies where policyname like 'Blocked%';
   ```
   Expect 7 trigger rows (five tables filtered, plus block and report) and 2 policies.
3. **Deploy edge functions** `admin-users`, `delete-account` and
   `send-transactional-email` (the template registry is bundled into it). Lovable
   Publish does NOT do this; ask the Lovable agent. **Verify:** from the admin
   dashboard the Moderation Queue loads and shows reported text. The old
   function answered `action=reports` with the user list, so a queue that
   renders at all proves the new code is live.
4. **End-to-end check, on the web, before any build.** From a second test
   account: report a setlist, then check the email arrives and the queue shows
   it. Block the test account, then check its setlists vanish from Browse and a
   second email arrives. Try a comment containing a filtered word. Dismiss the
   test reports afterwards.
5. **Settle the 2026-09-24 report** still open in the queue.
6. **`/pre-release`** against the merged sha. A PASS-class verdict is required.
7. **Publish the web.** The Terms and the agreement box are web-visible.
8. **Dispatch `ios-testflight.yml` from `main` → build 29** (run 28 + offset 1;
   run 27 was build 28). Confirm 29 in App Store Connect.
9. **Record** on build 29 (shot list below). Export as **.mp4**, not .mov.
10. In App Store Connect: select **build 29** for version 1.0 in place of 27,
    replace Notes with [`reviewer-notes-v3.txt`](reviewer-notes-v3.txt), reply
    with [`review-reply-2026-09-30.txt`](review-reply-2026-09-30.txt) and attach
    the recording, then **Resubmit to App Review**.

Both texts are counted, not estimated: the reply is **2999** characters and the
Notes are **3719**, against 4000 each. Both are plain ASCII, with LF newlines
counted as one character (confirmed against ASC last round). Recount after any
edit.

## Recording, on build 29

Apple asked for these beats, and in this order:

1. **Launch**, then open the sign-in screen. Hold on the **Terms agreement
   box, unticked**, above the sign-in buttons. Tap "Continue with Apple"
   without ticking: the toast appears and the box highlights. Tap "Terms of
   Use", scroll to **5. House Rules** (zero tolerance, filter, 24 hours), and go
   back.
2. **Tick the box. Create the throwaway account** with email and password.
3. **Filter:** open a setlist and type a comment containing a filtered word.
   Show the "house rules" toast, and that the comment did not post.
4. **Flag:** on another member's setlist, tap the **flag beside the curator's
   name** → Report this setlist → Send. Show the flag on a comment and in a DM
   thread too.
5. **Block:** same flag → Block → confirm. You land on Browse, and that
   curator's setlists are gone from it. Also show the block icon beside a
   comment.
6. **Delete:** Menu → **Delete Account** → Delete My Account → **Delete
   Everything**. Show the signed-out state. Then try signing in with the same
   credentials and show it failing, which proves the account is gone.

**Prepare a second test account before recording.** Give it one public setlist
and one comment on another setlist. That account is the "abusive user" you
report and block in shots 4–5. Blocking a real member files a real report on
them and emails you; do not film that on a stranger. Dismiss the test reports
after the take.

The 2.1 playbook's before/after notes still apply: Focus mode on, silent
switch on, trim the ends, and watch it back against the list before attaching.

## Known gap, not fixed here

**Sign in with Apple token revocation.** Apple's account-deletion guidance says
an app offering Sign in with Apple should revoke the user's tokens through
Apple's REST API when their account is deleted. `delete-account` does not do
this. Supabase does not keep the Apple refresh token by default, so fixing it
means capturing that token at sign-in and holding the Apple key as a function
secret. Reviewers rarely test it, and it is not what this rejection cites, but
it is the next thing Apple could raise under 5.1.1(v).
