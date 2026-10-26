# Auth security settings

Supabase Auth (GoTrue) owns credentials: it hashes passwords, enforces the
password policy and throttles sign-in. Most of that is configured in the hosted
project's **dashboard**, not in code. `supabase/config.toml` is the local-dev
copy and the documented shape; the dashboard is what production runs. This page
lists the settings production must have and the code that mirrors them, so the
two stop drifting apart.

## Email sign-in is code-only

The web app and the current iOS app sign in by email **code**: the address gets
a 6-digit code (`signInWithOtp`, which also creates the account when the
address is new) and the code signs the person in (`verifyOtp`, `type: 'email'`).
Neither offers a password field, a sign-up form or a password reset any more.
An existing password user just signs in with a code; their password stays in
the database, unused. Google and Apple sign-in are unchanged.

Code: `components/auth/email-code/` and `lib/infra/auth/email-code.ts` (web),
`apps/mobile-flutter/lib/features/auth/` (`AuthFormController.sendCode` /
`verifyCode`, `EmailCodeView`).

| Setting | Production value | Mirrored in |
|---|---|---|
| Email OTP length | **6** recommended (shortest to type). The hosted dev project was on **8** on 2026-10-25 — check prod | Both code fields accept any length GoTrue allows (6–10: `EMAIL_CODE_MIN/MAX_LENGTH` on web, `kEmailCodeMin/MaxLength` in Flutter), so the setting can never lock sign-in out. A pasted or autofilled code submits itself; a typed one submits with Continue. `supabase/config.toml` says 6 |
| Email OTP expiry | **600 s** (10 minutes; it governs emailed links too) | the "10 minutes" in `lib/infra/email/templates/`, `supabase/config.toml` |
| Per-address resend cooldown | **60 s** (hosted default) | `RESEND_COOLDOWN_SECONDS` (web), `kResendCooldownSeconds` (Flutter) |

A wrong code only counts against the per-IP `/verify` limit upstream (GoTrue
keeps no per-code attempt counter), so the strict guard is ours: `/verify` is a
`login` op keyed on the account (`authLoginAccount`, 10/min, 30/h, 100/day —
`docs/RATE_LIMITING.md`). A short expiry is what keeps a guessed code worth
little.

### What stays for iOS builds released before code sign-in

Server-side password support is untouched, so an iOS build released before
code sign-in (including one waiting in App Review) keeps working against prod:
the password grant through the auth proxy, password sign-up (its confirmation
email is still a link — `wantsLink` in `lib/infra/email/auth-email.ts`), and its
"Forgot password", which still lands on the web `/reset-password` page. The
policy below applies to those passwords. Removing them is a follow-up, once no
supported build sends a password.

## Password policy

| Setting | Production value | Mirrored in |
|---|---|---|
| Minimum password length | **8** (UTF-8 bytes, as GoTrue counts it; an accented letter counts as two or three) | `lib/core/validation/password.ts` (the web `/reset-password` page old iOS builds land on), `supabase/config.toml` |
| Password requirements | **Letters and digits** (`letters_digits`) | same two |
| Maximum length | 72 bytes (fixed by GoTrue; bcrypt ignores anything past 72 bytes) | same two |
| Secure password change | **On**: changing a password needs a session under 24 hours old, or a reauthentication nonce. The reset-password flow is unaffected because the recovery link mints a fresh session. | `supabase/config.toml` |
| Leaked password protection | **Turn on** (Pro plan). Checks new passwords against HaveIBeenPwned. | `lib/infra/auth/weak-password.ts` shows a "choose a different one" line on the reset page when the server rejects a password as `pwned`. |

Both limits are UTF-8 bytes, but the user-facing copy (web `auth.passwordRules`,
Flutter l10n, the account docs, en and vi) never says "bytes". It says
"characters" and adds that an accented letter counts as 2–3, which is exactly
how a byte count behaves for Vietnamese. Keep that wording if the copy changes.

The form checks exist only to say what the server will say before the round
trip. **Change the dashboard and both mirrors together.** If you change
the dashboard alone, users see the old rule in the form and then get rejected
by the server, which is exactly what KALLO-10 found.

Only new passwords (sign-up, reset) are checked against the policy. Sign-in only
requires a non-empty value of at most 72 bytes. Accounts created under the older
6-character minimum still sign in, because GoTrue checks the policy only when a
password is set, not when it is used. Those users move to the new policy the
next time they reset their password.

### Where the settings live

In the Supabase dashboard, open **Authentication**. The length, requirements,
secure password change and leaked password settings are under the Email
provider's password section (newer dashboards group the leaked password setting
under **Attack Protection**). Labels move between dashboard releases, so search
the Auth settings for "password" if a label has changed.

### Where this is headed

8 characters with letters and digits is **below** NIST SP 800-63B-4 for a
password used on its own. NIST recommends at least 15 characters for a
single-factor password (8 only when the password is always paired with MFA),
no composition rules, and screening against breached-password lists. In order
of value, the upgrade path is:

1. Turn on leaked password protection. It is the biggest single gain, because
   credential stuffing replays passwords that are already public.
2. Raise the minimum, for example to 12 and then 15, and encourage passphrases.
   The 72-byte cap leaves room for this. Update all three mirrors.
3. Offer optional MFA (TOTP) for users who want it.

## Abuse controls

| Control | State | Notes |
|---|---|---|
| Auth rate limits (`[auth.rate_limit]`) | On | Supabase's limits are **per IP**, and every proxied request reaches Supabase from our Cloud Run egress address, so in practice they are global caps. The app's own per-IP and per-account limiter sits in front of them. See `docs/RATE_LIMITING.md`. |
| Cloudflare Turnstile, checked by **our auth proxy** | Staged by `TURNSTILE_MODE`; off until `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are both set | Every auth email costs money now, so the requests that send one carry a Turnstile token (in supabase-js / supabase-flutter's standard `captchaToken` field) and `app/api/supabase-proxy/_lib/captcha-gate.ts` checks it with Cloudflare before forwarding. `monitor` (the default) only logs `[turnstile] path=… outcome=… client=…`; `codes` refuses a code request (`/otp`, `/magiclink`) without a valid token; `all` also refuses `/signup`, `/recover` and `/resend`, which only old iOS builds still call. The password grant and `/verify` are never gated. Move past `monitor` only on the owner's word, after the logs show the current web and iOS clients sending valid tokens. Web renders the widget itself (`hooks/auth/use-turnstile.ts`); iOS loads `/auth/turnstile` in a web view. A check that could not run (script blocked) never holds the form: the request goes without a token and the server decides. |
| Supabase's own CAPTCHA setting | **Keep it off** | It is all-or-nothing: once on, GoTrue rejects every sign-up, code request, password sign-in and reset without a token — every iOS build already installed — and it would see our Cloud Run egress IP instead of the user's. A request carrying a service-role key also skips it, so it would cancel out the `Sb-Forwarded-For` redesign in `docs/PROD_DOMAIN_SETUP.md`. Both clients already send the token in the field Supabase reads, so the check could move there later without an app update. |
| MFA | Not offered | Out of scope for now; see the upgrade path above. |
