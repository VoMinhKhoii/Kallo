# Email

Every email the app sends goes through **Cloudflare Email Sending** (beta,
Workers Paid plan), composed by code in this repo. Nothing is templated in a
third-party dashboard.

## Layout

```text
lib/infra/email/config.ts          — sender identity, send timeout, "is it configured?"
lib/infra/email/client.ts          — Cloudflare Email Sending REST call (importable with no token)
lib/infra/email/send.ts            — the only send seam: sendEmail({ to, message })
lib/infra/email/auth-email.ts      — Supabase hook payload → the emails to send
lib/infra/email/templates/   — plain HTML builders returning { subject, html, text }
app/api/auth/send-email/     — the Supabase "Send Email" auth hook endpoint
```

Templates are plain functions, not React Email: they render outside the React
tree and outside next-intl's request scope, so copy lives inline in the
template file as a `Record<'en' | 'vi', …>` and colours are literal hex (email
clients have no CSS variables — the same constraint the Satori OG route has).

## The provider

`client.ts` POSTs to
`https://api.cloudflare.com/client/v4/accounts/<CLOUDFLARE_ACCOUNT_ID>/email/sending/send`
with `CLOUDFLARE_EMAIL_API_TOKEN` (an API token with **Account · Email Sending ·
Edit** and nothing else). There is no SDK; it is one `fetch`.

What it does differently from a queue-first provider, and what `sendEmail`
does about it:

- **It answers only after trying the recipient's mail server.** Measured from
  a dev machine to Gmail on 2026-10-25: 1.0–2.5 s for `mail.kallo.fit`, 3.3 s
  on a cold connection, 6.9 s at worst. The answer says per recipient whether the email
  was `delivered`, `queued` (Cloudflare keeps trying), a `permanent_bounce`,
  or suppressed (on the account's suppression list after an earlier bounce or
  complaint). The last two are still HTTP 200, so `sendEmail` checks for them
  and throws. Lift a suppression in the dashboard (Email Sending →
  Suppressions).
- **Dropping the request cancels the send.** So the send deadline
  (`EMAIL_SEND_TIMEOUT_MS`, 4 s) stops *waiting* and never aborts: past it,
  `sendEmail` counts the email as sent (`id: null`), the request keeps running,
  and a failure that lands later is logged as `failed after the deadline`.
- **No idempotency key and no tags.** A caller that sends twice gets two
  emails.

Limits (account-wide, shared with SMTP): 3,000 emails a month are included in
Workers Paid, then $0.35 per 1,000; a daily quota that starts low and grows
with reputation (dashboard → Email Sending; raise it with Cloudflare's limit
increase form); 50 recipients and 5 MiB per message. Quota is not reported in
the API response, so watch the dashboard.

## Auth email

Supabase Auth used to compose and send these itself. It no longer does. With
`[auth.hook.send_email]` enabled (`supabase/config.toml`, and Authentication →
Hooks in the dashboard), GoTrue POSTs a signed payload to
`/api/auth/send-email`, and we render and send it.

Three constraints the handler exists to satisfy:

1. **Link shape.** Emails must point at `https://kallo.fit/auth/verify?…`, never
   at `…supabase.co/auth/v1/verify`, which is blackholed on many Vietnamese
   networks (see the header comment in `app/auth/verify/route.ts`). That route
   accepts only `type ∈ {email, recovery, email_change}`, so
   `lib/infra/email/auth-email.ts` maps GoTrue's wider `email_action_type` vocabulary
   onto those three. `app/api/auth/send-email/__tests__/route.test.ts` locks the mapping.
2. **Status codes are an API.** Supabase retries a hook that answers 429 or 503
   and converts 400/403 into a non-retried 500. A transient provider failure must
   therefore surface as 503 — never as a 4xx.
3. **It runs inside the auth transaction**, and Supabase gives the whole hook
   invocation 5 s. `sendEmail` stops waiting at `EMAIL_SEND_TIMEOUT_MS` (see
   above), and the email-change flow sends its two emails in parallel so both
   fit.

Locale comes from the `next` parameter the app embeds in `emailRedirectTo`,
resolved through the same `localeFromNext` / `safeNextPath` helpers the auth
routes use. A caller that passes no locale-prefixed `next` gets English.

### Rollback

Disable the Send Email hook in the Supabase dashboard. Auth email immediately
falls back to Supabase's own sender; no deploy is involved. The commented-out
`[auth.email.smtp]` block in `supabase/config.toml` is the second-line fallback
(Cloudflare's SMTP relay) if the built-in sender's rate limit is too tight.

## Waitlist email

The landing-page waitlist is double opt-in: the signup POST stores an
unconfirmed row and sends a confirm link; following that link is what sets
`confirmed_at` and triggers the welcome email. See `lib/waitlist/`.

## Content-report alerts

`POST /api/v1/reports` stores the report, then — after the response, via
`after()` — emails every `ADMIN_EMAILS` address with
`lib/infra/email/templates/content-report.ts` (English only; it goes to the
team). `lib/actions/moderation/report-alert.ts` never throws: a send failure
or an empty `ADMIN_EMAILS` is logged, and the report stays in
`content_reports` with status `open` for triage. A repeat report of the same
target by the same person does not alert again.

## Local development

`CLOUDFLARE_EMAIL_API_TOKEN` is intentionally **unset** locally. `sendEmail`
then logs and returns `{ id: null, skipped: true }` instead of throwing, so
sign-up and the waitlist work end-to-end offline — you just don't get mail.

To exercise real delivery:

1. Put `CLOUDFLARE_EMAIL_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and
   `SEND_EMAIL_HOOK_SECRET` in `.env.local`.
2. Set the same secret where `supabase start` can see it, since
   `supabase/config.toml` reads `secrets = "env(SEND_EMAIL_HOOK_SECRET)"`.
3. `bun dev` — the hook URI points at `host.docker.internal:3000` so the Auth
   container can reach it.
4. To make signup actually require a confirmation email, flip
   `enable_confirmations = true` under `[auth.email]`. It is `false` by default
   so local sign-up doesn't dead-end when no key is configured.

Note that Inbucket (`http://localhost:54324`) stays **empty** once the hook is
on — that is the proof GoTrue stopped sending and the hook took over.

Sends to a **verified destination address** in the Cloudflare account are free
and skip the quota, so use one for testing.

## Deployment

`CLOUDFLARE_EMAIL_API_TOKEN` and `SEND_EMAIL_HOOK_SECRET` come from Secret
Manager (`kallo-prod-cloudflare-email-api-token`,
`kallo-prod-send-email-hook-secret`) — see `docs/GOOGLE_CLOUD_RUN.md`.
`CLOUDFLARE_ACCOUNT_ID` is the `R2_ACCOUNT_ID` repo variable (same account).
Domain onboarding, the hook URI, and the required Cloudflare WAF skip rule are
in `docs/PROD_DOMAIN_SETUP.md` §7b.

## Sender domain and anti-spoofing

Every sender must stay on `mail.kallo.fit`: Cloudflare's DKIM signature for
that domain (`cf-bounce._domainkey.mail.kallo.fit`) is what makes our mail pass
DMARC. Nothing sends as the apex `@kallo.fit`, and the DMARC policy is being
staged to `p=reject` on that assumption. Before adding a new sender or
pointing `EMAIL_FROM` at another domain, read `docs/EMAIL_AUTHENTICATION.md`
(sender inventory, SPF/DKIM/DMARC records, rollback).
