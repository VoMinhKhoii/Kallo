# Lessons

What our security fixes have taught us so far, grouped by cause. Sources: a pentest (September 2026), an audit (November 2026) and our own hardening passes. Each bullet is the rule, then the PRs behind it.

## Fix the class, not the site

The same bug came back after we fixed it in one place:

- Shared budget charged before the caller's own: fixed for OCR in #332, back in sign-in, waitlist and push (#528, #539).
- Client-callable database functions: three locked in #313 with "audit the rest" left as a follow-up; the friendship helpers turned up later (#532).
- Mailbox-canonical email keys: done for sign-in in #331, missed on the waitlist (#541).
- Auth proxy path escapes: fixed in #183, a different encoding got through in #375.

When you fix a bug, search for every other place with the same shape, and add a test or CI check that fails on the next one.

## One rule, one place

- Put a check where the data leaves (one projection, schema or helper every path uses), not in each route. The free-tier micronutrient strip missed three responses (#529); country length was checked in one endpoint only (#533); a block was hidden on the invite preview but not on accept (#532); avatar hosts were checked only by the web CSP (#542).
- Reuse the visibility rule; never write a second one (#532, direct chats).
- Write through the user's own Supabase client so RLS enforces ownership; the service-role client skips it (#185).

## Limits protect users, not just the bill

- Charge the narrowest budget first (this user, this IP), the shared total last (#332, #528, #539).
- Every endpoint that does heavy work gets a limit; the route inventory test keeps it that way (#332, #530).
- A limiter can lock real users out: size each slot's lifetime to its request, never copy a constant, and never cancel a release (#502, #506).

## Build the undo path

- For every "add", test remove, block, rename, sign-out and delete, then add again (#543 handles and removed friends, #532 re-friended chats, #540 drafts after sign-out).
- A revoked session signs the device out instead of looping on 401 (#475).

## Untrusted means anything a user can set

- A URL parameter is not user intent: a link may fill a form, never submit it or spend money (#540).
- `user_metadata` is editable by the user, not data from Google or Apple (#542).
- Database functions read the caller from `auth.uid()`, never from an argument (#532).
- Library error messages can carry user data; scrub them before Sentry or logs (#533).
- Model output is input too: validate it and keep null as null, never 0 (#280).
- Paths: decode once and check the resolved URL, not the raw string (#183, #375).
- Behind Cloud Run, `request.url` has the container's host; build public URLs from the forwarded headers (#106).

## "We don't reveal it" covers timing and status

- An anonymous endpoint gives every case the same body, status and timing (#541 waitlist, #532 blocked invites).
- Per-mailbox limits key on the canonical mailbox, not the typed spelling (#331, #541).

## Controls that only exist on paper

- Check a control is live in prod. The CSP was report-only and nobody read the reports (#278, #382); pg_cron was never enabled, so retention never ran (#313); the session cookie had no `Secure` and lived 400 days (#374).
- Before revoking access, list who calls it. A revoke broke the analytics reader (#350).

## Dependencies and release tooling

- Anything that runs next to secrets installs from a committed, checksummed lockfile, and secrets are set only on the steps that read them (#527).
- Dependabot PRs that don't update `bun.lock` fail CI and pile up: 97 advisories by #450.
- Upgrade hosted services (database image, auth) on a schedule, not after something breaks.
