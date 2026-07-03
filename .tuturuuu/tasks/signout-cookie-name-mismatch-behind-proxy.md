---
key: signout-cookie-name-mismatch-behind-proxy
name: Bug Report
task_name: "Bug — web sign-out bounces back in (auth cookie name mismatch behind proxy)"
visibility: workspace
priority: high
status: resolved
default_board_id: fcdee18e-9402-4dfc-84ac-19283e3e6f3b
default_list_id: 9e3846f3-c094-4176-90ff-3e30d8c07d90
---

**Reported:** 2026-07-03 · **Reporter:** Claude (sign-out investigation) · **Severity:** high · **Area:** auth / session · **Status:** ✅ Fixed on `claude/landing-page-redesign-pn19ea`

## Summary

On the web app, signing out signs the user out and then immediately signs them back in. Regression introduced by the auth-proxy commit `1cc1edd` (2026-07-02), which hardened the auth transport but left the session cookie *name* inconsistent between the browser and server clients.

## Steps to Reproduce

1. Log in to the web app.
2. Open the user menu (`components/app/navigation/user-menu.tsx`) or Settings → Account (`components/settings/account/account-panel.tsx`) and click **Sign out**.

## Expected

Session is cleared and you land on `/` as a signed-out user.

## Actual

The page redirects to `/`, `middleware.ts` sees a still-valid session and redirects `/` → `/logging`, so you end up back in the app.

## Impact

Every web user — sign-out is effectively broken. Launch-blocking for the web surface.

## Root Cause

`@supabase/supabase-js` derives the auth cookie name (`storageKey`) from the client URL's hostname: `` sb-${new URL(url).hostname.split('.')[0]}-auth-token ``. Commit `1cc1edd` pointed the **browser** client (`lib/supabase/client.ts`) at `<origin>/api/supabase-proxy` while the **server/middleware** clients stayed on the real `NEXT_PUBLIC_SUPABASE_URL`, so the two derived different names:

- Browser → `sb-<app-host>-auth-token`
- Middleware / server → `sb-<supabase-ref>-auth-token`

Browser `supabase.auth.signOut()` clears only its own key's cookie (via `document.cookie`); the server-keyed cookie — originally set server-side by `app/auth/callback/route.ts` (`exchangeCodeForSession`) — survives, and `middleware.ts` re-authenticates against it. Login worked precisely because the server callback set the server-keyed cookie.

## Fix

Pin the browser client's cookie name to the key derived from the real Supabase URL so both sides share one cookie, in `lib/supabase/client.ts`:

```ts
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
createBrowserClient(url, key, { cookieOptions: { name: `sb-${ref}-auth-token` } });
```

`@supabase/ssr` maps `cookieOptions.name` → `storageKey`. Server/middleware clients are unchanged. Covered by `lib/supabase/client.test.ts`.

## Notes

- Migration: users logged in before the fix keep their server-keyed cookie (untouched), so no forced re-login; the orphaned proxy-derived browser cookie simply expires.
- Sibling residual gaps from the same commit are already tracked in `.tuturuuu/tasks/`: `oauth-browser-callback-hits-supabase-directly`, `supabase-email-links-bypass-auth-proxy`, `android-auth-proxy-build-config`, `auth-proxy-shared-egress-rate-limits`.
- Origin: web sign-out investigation, 2026-07-03.
