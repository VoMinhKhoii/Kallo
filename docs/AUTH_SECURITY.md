# Auth security settings

Supabase Auth (GoTrue) owns credentials: it hashes passwords, enforces the
password policy and throttles sign-in. Most of that is configured in the hosted
project's **dashboard**, not in code. `supabase/config.toml` is the local-dev
copy and the documented shape; the dashboard is what production runs. This page
lists the settings production must have and the code that mirrors them, so the
two stop drifting apart.

## Password policy

| Setting | Production value | Mirrored in |
|---|---|---|
| Minimum password length | **8** (UTF-8 bytes, as GoTrue counts it; an accented letter counts as two or three) | `lib/core/validation/password.ts` (web), `apps/mobile-flutter/lib/features/auth/logic/password_policy.dart`, `supabase/config.toml` |
| Password requirements | **Letters and digits** (`letters_digits`) | same three |
| Maximum length | 72 bytes (fixed by GoTrue; bcrypt ignores anything past 72 bytes) | same three |
| Secure password change | **On**: changing a password needs a session under 24 hours old, or a reauthentication nonce. The reset-password flow is unaffected because the recovery link mints a fresh session. | `supabase/config.toml` |
| Leaked password protection | **Turn on** (Pro plan). Checks new passwords against HaveIBeenPwned. | `lib/infra/auth/weak-password.ts` and the Flutter `authErrorMessage` show a "choose a different one" line when the server rejects a password as `pwned`. |

The form checks exist only to say what the server will say before the round
trip. **Change the dashboard and all three mirrors together.** If you change
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
| CAPTCHA (hCaptcha or Cloudflare Turnstile) | Off, optional | **Do not enable it in the dashboard alone.** Once it is on, GoTrue rejects every sign-up, sign-in and password-reset request that has no `captchaToken`, and neither the web forms nor the Flutter app send one yet. Ship the client widget first, then flip the setting. It is worth doing if credential-stuffing or sign-up spam shows up in the auth logs. |
| MFA | Not offered | Out of scope for now; see the upgrade path above. |
