# Email

Every email the app sends goes through **Resend**, composed by code in this
repo. Nothing is templated in a third-party dashboard.

## Layout

```text
lib/email/config.ts          — sender identity, send timeout, "is it configured?"
lib/email/client.ts          — lazy Resend client (importable with no API key)
lib/email/send.ts            — the only send seam: sendEmail({ to, message, … })
lib/email/auth-email.ts      — Supabase hook payload → the emails to send
lib/email/templates/         — plain HTML builders returning { subject, html, text }
app/api/auth/send-email/     — the Supabase "Send Email" auth hook endpoint
```

Templates are plain functions, not React Email: they render outside the React
tree and outside next-intl's request scope, so copy lives inline in the
template file as a `Record<'en' | 'vi', …>` and colours are literal hex (email
clients have no CSS variables — the same constraint the Satori OG route has).

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
   `lib/email/auth-email.ts` maps GoTrue's wider `email_action_type` vocabulary
   onto those three. `app/api/auth/send-email/route.test.ts` locks the mapping.
2. **Status codes are an API.** Supabase retries a hook that answers 429 or 503
   and converts 400/403 into a non-retried 500. A transient Resend failure must
   therefore surface as 503 — never as a 4xx.
3. **It runs inside the auth transaction** with only a few seconds of budget,
   so `sendEmail` bounds the provider call (`EMAIL_SEND_TIMEOUT_MS`).

Locale comes from the `next` parameter the app embeds in `emailRedirectTo`,
resolved through the same `localeFromNext` / `safeNextPath` helpers the auth
routes use. A caller that passes no locale-prefixed `next` gets English.

### Rollback

Disable the Send Email hook in the Supabase dashboard. Auth email immediately
falls back to Supabase's own sender; no deploy is involved. The commented-out
`[auth.email.smtp]` block in `supabase/config.toml` is the second-line fallback
(Resend's SMTP relay) if the built-in sender's rate limit is too tight.

## Waitlist email

The landing-page waitlist is double opt-in: the signup POST stores an
unconfirmed row and sends a confirm link; following that link is what sets
`confirmed_at` and triggers the welcome email. See `lib/waitlist/`.

## Local development

`RESEND_API_KEY` is intentionally **unset** locally. `sendEmail` then logs and
returns `{ id: null, skipped: true }` instead of throwing, so sign-up and the
waitlist work end-to-end offline — you just don't get mail.

To exercise real delivery:

1. Put a Resend key and `SEND_EMAIL_HOOK_SECRET` in `.env.local`.
2. Set the same secret where `supabase start` can see it, since
   `supabase/config.toml` reads `secrets = "env(SEND_EMAIL_HOOK_SECRET)"`.
3. `bun dev` — the hook URI points at `host.docker.internal:3000` so the Auth
   container can reach it.
4. To make signup actually require a confirmation email, flip
   `enable_confirmations = true` under `[auth.email]`. It is `false` by default
   so local sign-up doesn't dead-end when no key is configured.

Note that Inbucket (`http://localhost:54324`) stays **empty** once the hook is
on — that is the proof GoTrue stopped sending and the hook took over.

## Deployment

`RESEND_API_KEY` and `SEND_EMAIL_HOOK_SECRET` come from Secret Manager
(`kallo-prod-resend-api-key`, `kallo-prod-send-email-hook-secret`) — see
`docs/GOOGLE_CLOUD_RUN.md`. Domain verification, the hook URI, and the required
Cloudflare WAF skip rule are in `docs/PROD_DOMAIN_SETUP.md` §7b.
