---
key: supabase-email-links-bypass-auth-proxy
name: Bug Report
task_name: "Bug — Supabase email links bypass the auth proxy"
visibility: workspace
priority: high
default_board_id: fcdee18e-9402-4dfc-84ac-19283e3e6f3b
default_list_id: 9e3846f3-c094-4176-90ff-3e30d8c07d90
---

**Reported:** 2026-07-02 · **Reporter:** Claude (auth-proxy investigation) · **Severity:** high · **Area:** auth / email flows

## Summary

Signup-confirmation and password-reset emails link the browser through `https://oudpzhfzirgjbhrzcett.supabase.co/auth/v1/verify`, which is unreachable on VN networks that blackhole the Supabase Cloudflare edge — the same networks the `/api/supabase-proxy` route was added for.

## Steps to Reproduce

1. On an affected network (VN ISP that blackholes the supabase.co edge), sign up in the mobile app or request a password reset.
2. Open the link in the confirmation / reset email on the same network.

## Expected

The link verifies the token and lands in the app/web flow.

## Actual

The browser cannot reach `supabase.co/auth/v1/verify`; the page never loads, so new users cannot confirm their account and resets dead-end.

## Impact

Blocks **new-user signup** and password reset entirely on affected networks — the auth proxy only covers in-app API calls, not emailed links.

## Notes

- Mobile signup sends no `emailRedirectTo` (`apps/mobile-flutter/lib/features/auth/providers/auth_form_controller.dart` — `signUp`); password reset: `apps/mobile-flutter/lib/features/auth/screens/forgot_password_screen.dart`.
- Fix direction: customize Supabase email templates to use `{{ .TokenHash }}` and link to an app-domain route (Cloud Run host) that calls `verifyOtp` server-side, so the emailed URL never touches supabase.co in the browser.
- Origin: mobile-login network investigation, 2026-07-02 (see `app/api/supabase-proxy`).
