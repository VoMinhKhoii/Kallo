---
key: oauth-browser-callback-hits-supabase-directly
name: Bug Report
task_name: "Bug — OAuth browser callback still hits supabase.co directly"
visibility: workspace
priority: medium
default_board_id: fcdee18e-9402-4dfc-84ac-19283e3e6f3b
default_list_id: 9e3846f3-c094-4176-90ff-3e30d8c07d90
---

**Reported:** 2026-07-02 · **Reporter:** Claude (auth-proxy investigation) · **Severity:** medium · **Area:** auth / OAuth

## Summary

Browser-redirect OAuth flows end at Google's registered redirect URI `https://oudpzhfzirgjbhrzcett.supabase.co/auth/v1/callback` — a direct browser hop to supabase.co that fails on VN networks blackholing the Supabase Cloudflare edge, even with the auth proxy in place.

## Steps to Reproduce

1. On an affected network, use **web** Google sign-in (`components/auth/google-sign-in-button.tsx`, `signInWithOAuth`) or **mobile** account linking (`apps/mobile-flutter/lib/features/settings/screens/account_section.dart`, `linkIdentity` browser flow).
2. Complete the Google consent screen.

## Expected

Google redirects back and the session is established.

## Actual

Google redirects the browser to `supabase.co/auth/v1/callback`, which never loads on the affected network; the flow dead-ends after consent.

## Impact

Web Google sign-in and mobile manual account-linking fail on affected networks. Mobile *native* Google/Apple sign-in (`signInWithIdToken`) is unaffected — it never leaves the app.

## Notes

- The `/auth/v1/authorize` start of the flow IS proxied (302 passthrough in `app/api/supabase-proxy`); only Google's return hop is not, because the redirect URI is registered with Google on the supabase.co host.
- Fix direction: no clean one without moving the auth callback host — a Supabase custom domain still resolves to the same Cloudflare edge. Consider steering affected users to email/password or native flows, or fronting auth on an own-CDN domain if Supabase ever supports it.
- Origin: mobile-login network investigation, 2026-07-02.
