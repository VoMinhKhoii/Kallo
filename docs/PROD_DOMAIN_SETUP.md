# kallo.fit production setup runbook

Wiring **kallo.fit** to the `kallo-prod` Cloud Run service. Written for someone
touching Cloudflare for the first time — every step says *where to click*.

## Architecture (what we're building)

```
Browser ──HTTPS──▶ Cloudflare  (WAF, DDoS, rate-limit, edge TLS for kallo.fit)
                      │  proxied (orange); rewrites Host → the run.app hostname;
                      │  injects the X-Origin-Verify secret; Full(Strict) TLS
                      ▼
                 Cloud Run  kallo-prod  (Singapore / asia-southeast1)
                      │  serves on its *.run.app URL over Google's own TLS cert
                      ▼
                 middleware.ts  → 403s anything missing X-Origin-Verify
                                   (so the raw run.app URL is sealed)
```

**No Cloud Run domain mapping.** Bangkok (`asia-southeast3`, where internal/staging
run) doesn't support it, and we don't need it: Cloudflare points straight at the
`run.app` origin and rewrites the `Host` header with a free **Origin Rule**. This is
region-proof and avoids the managed-cert-renewal-behind-a-proxy outage class
entirely — Cloudflare validates Google's always-valid `*.run.app` cert on the
back-connection.

`kallo-prod` runs in **Singapore** to sit next to the Supabase database (also
Singapore); Cloudflare's edge keeps users fast regardless.

---

## ✅ Already done (by Claude, via gcloud/gh)

- Secret Manager: `kallo-prod-database-url` (= current DB), `kallo-prod-gemini-api-key`,
  `kallo-prod-analysis-guard-hash-secret`, `kallo-prod-origin-shared-secret` — all
  readable by the Cloud Run runtime SA.
- GCS lease bucket `gs://kallo-prod-leases`.
- GitHub repo var `GCS_PROD_LEASE_BUCKET=kallo-prod-leases`; secret
  `KALLO_PROD_PROJECT_ID` (prod's Supabase project ref — value stored in GitHub
  secrets, omitted here).

You do **not** need to touch GCP for the steps below.

---

## 1. Ship the code → first prod deploy

The `kallo-prod` service is created by its deploy workflow, which runs after
`cloud-run-prod.yml` is on `main`.

1. Merge the PR for branch `worktree-kallo-fit-prod-launch`.
2. The next `main` CI run triggers **Cloud Run Prod**, which creates `kallo-prod`
   in Singapore.
3. Grab its URL — you'll paste this into Cloudflare:
   ```bash
   gcloud run services describe kallo-prod --region asia-southeast1 \
     --format='value(status.url)'
   # e.g. https://kallo-prod-XXXXXXXX-as.a.run.app  →  the HOST is everything after https://
   ```
   Call the host part `RUN_HOST` (e.g. `kallo-prod-XXXXXXXX-as.a.run.app`).

Also read back the origin-lock secret (you paste it into Cloudflare in step 5):
```bash
gcloud secrets versions access latest --secret=kallo-prod-origin-shared-secret
```

---

## 2. Point the domain at Cloudflare (Namecheap → Cloudflare)

1. Go to **dash.cloudflare.com** → sign up / log in → **Add a site** → type
   `kallo.fit` → choose the **Free** plan → **Continue**.
2. Cloudflare scans for existing records (there are none) → **Continue**. It then
   shows **two nameservers** like `xxx.ns.cloudflare.com` and `yyy.ns.cloudflare.com`.
3. In a new tab go to **namecheap.com** → **Domain List** → **Manage** next to
   `kallo.fit` → the **Nameservers** dropdown → choose **Custom DNS** → paste the two
   Cloudflare nameservers → click the green ✓ to save.
4. Back in Cloudflare, click **Done, check nameservers**. It emails you when the
   domain is **Active** (usually minutes, up to a few hours). Wait for Active before
   continuing.

---

## 3. Cloudflare DNS record

Cloudflare dashboard → click your **kallo.fit** site → left sidebar **DNS** →
**Records** → **Add record**:

- **Type:** `CNAME`
- **Name:** `@`  (this means the bare kallo.fit)
- **Target:** your `RUN_HOST` from step 1 (e.g. `kallo-prod-XXXXXXXX-as.a.run.app`)
- **Proxy status:** **Proxied** (the cloud icon is **orange**) ← important
- **Save**

Add a second record so `www` works:
- **Type** `CNAME` · **Name** `www` · **Target** `kallo.fit` · **Proxied (orange)** · Save.

(Cloudflare auto-flattens the apex CNAME — no need for an A record.)

---

## 4. Origin Rule — rewrite the Host header (this is what makes it work)

Cloud Run decides which service to serve by the `Host` header. Cloudflare sends
`Host: kallo.fit` by default, which Cloud Run doesn't recognize → 404. This rule
fixes that.

Left sidebar **Rules** → **Origin Rules** → **Create rule**:
- **Rule name:** `kallo-prod host rewrite`
- **When incoming requests match:** choose **Custom filter expression** →
  Field `Hostname`, Operator `equals`, Value `kallo.fit`
  (add an `OR` row for `www.kallo.fit` if you like).
- **Then… Set Host Header** → toggle on → **Rewrite to** → `RUN_HOST`
  (the run.app host, no `https://`).
- **Deploy**.

> If after everything you get a **404** from the origin, this rule is wrong (Host
> not rewritten). If you get **525/526**, it's the SSL setting in step 6.

---

## 5. Transform Rule — inject the origin-lock secret

This is the header `middleware.ts` checks so the raw run.app URL stays sealed.

Left sidebar **Rules** → **Transform Rules** → **Modify Request Header** →
**Create rule**:
- **Rule name:** `origin-lock`
- **When incoming requests match:** `Hostname equals kallo.fit` (and `www.kallo.fit`).
- **Then… Set static** → **Header name:** `X-Origin-Verify` → **Value:** *paste the
  `kallo-prod-origin-shared-secret` value from step 1*.
- **Deploy**.

> Use **Set static**, not **Add** — "Set" overwrites any `X-Origin-Verify` a visitor
> tries to send in, so the origin only ever trusts Cloudflare's value.

---

## 6. SSL + security hardening

Left sidebar **SSL/TLS**:
- **Overview** → encryption mode → **Full (strict)**.
- **Edge Certificates** → turn on **Always Use HTTPS**, set **Minimum TLS Version
  1.2**, enable **HSTS** (accept the warning — only do this once you're happy the
  site loads on HTTPS).

Left sidebar **Security**:
- **WAF** → **Managed rules** → deploy the **Cloudflare Managed Ruleset**.
- **WAF** → **Rate limiting rules** → add a basic rule (e.g. 100 req / 10s / IP →
  Block) — tune later.
- **Bots** → turn on **Bot Fight Mode**.

Left sidebar **Redirect Rules** (under Rules):
- Create a rule: if `Hostname equals www.kallo.fit` → **Dynamic redirect** to
  `concat("https://kallo.fit", http.request.uri.path)`, status **301**.

---

## 7. Email — inbound support@kallo.fit (free)

Left sidebar **Email** → **Email Routing** → **Get started** → enable. Cloudflare
adds the needed MX + SPF/DKIM/DMARC DNS records automatically. Then **Create
address** → `support@kallo.fit` → **Send to** your personal inbox → verify that
inbox via the email Cloudflare sends. (Used by the OpenFoodFacts contact + the
legal-page mailto links.)

This is **receiving only**. Outbound is §7b.

---

## 7b. Email — outbound via Resend

Every email the app sends — auth confirmations, password resets, email-change
confirmations, and the landing-page waitlist — is composed in this repo
(`lib/email/templates/`) and delivered by Resend.

**1. Verify a sending subdomain.** In Resend → **Domains** → **Add Domain** →
`mail.kallo.fit`. Use the **subdomain**, not the apex: §7 already put an SPF
record on `kallo.fit` for Cloudflare Email Routing, and stacking a second
`include:` on it is the classic way to break inbound and outbound at once.
Add the SPF/DKIM/DMARC records Resend shows to Cloudflare DNS as **DNS-only**
(grey cloud), then click **Verify**.

**2. Create the API key** (Resend → **API Keys**, sending permission only).
That value becomes `RESEND_API_KEY` / the `kallo-prod-resend-api-key` secret.

**3. Enable the Supabase hook.** Supabase dashboard → **Authentication** →
**Hooks** → **Send Email** → type **HTTPS** → URI
`https://kallo.fit/api/auth/send-email` → **Generate secret**. Copy the
`v1,whsec_…` value into the `kallo-prod-send-email-hook-secret` GCP secret
(`SEND_EMAIL_HOOK_SECRET`). Once the hook is on, GoTrue stops sending mail
itself and the dashboard's own email templates are no longer used.

Raise **Authentication → Rate Limits → Emails per hour** from the default 2 at
the same time; it now only guards the hook, not delivery.

**4. Let Supabase through the WAF.** §6 turned on Bot Fight Mode and a rate
limiting rule. Supabase's hook POSTs come from its servers, not a browser, so
add a **WAF → Custom rule** that **skips** managed rules, bot fight mode and
rate limiting when `http.request.uri.path eq "/api/auth/send-email"`. The
route authenticates itself with a Standard Webhooks signature, so skipping the
edge checks does not open it up. Without this the hook is silently blocked and
nobody can confirm an account.

**Rollback.** Turning the Send Email hook off in the dashboard immediately
reverts auth email to Supabase's own sender — no deploy required.

---

## 8. Supabase (the current project = prod)

Supabase dashboard → the current dogfood project → **Authentication** → **URL
Configuration**:
- **Site URL:** `https://kallo.fit`
- **Redirect URLs:** add `https://kallo.fit/**` and `https://www.kallo.fit/**`
  (keep the existing localhost / run.app entries).

Google & Apple sign-in are already wired on this project — nothing to recreate.
(Apple: the Services ID must stay **first** in the provider's Client IDs list.)

Emailed links keep pointing at `https://kallo.fit/auth/verify?token_hash=…&type=…`
(never `…supabase.co/auth/v1/verify`, which is unreachable on many VN networks).
That link is now built by `lib/email/auth-email.ts` rather than a dashboard
template, so the templates in the dashboard no longer need hand-editing.

---

## 9. Google Cloud OAuth (project 714321235532)

console.cloud.google.com → **APIs & Services** → **Credentials** → open the OAuth
**Web client** → under **Authorized JavaScript origins** add `https://kallo.fit` and
`https://www.kallo.fit` → **Save**. (The redirect URI stays the Supabase
`…supabase.co/auth/v1/callback` — leave it; the fallback flow below still uses it.)

The **JavaScript origins are load-bearing**, not optional. Web Google sign-in
mints the ID token on our own origin via Google Identity Services and hands it to
`signInWithIdToken` — the same call the Flutter app makes — so Google's account
picker is labelled `kallo.fit` instead of the Supabase project ref. GIS refuses to
run on an origin that isn't listed here.

Set the client ID as a Cloud Run env var so the server pages can pass it down:
repo **Settings → Secrets and variables → Actions → Variables** → add
`GOOGLE_WEB_CLIENT_ID` (same value the Flutter build uses as `serverClientId`,
already listed under the Supabase Google provider's *Authorized Client IDs*). The
prod deploy passes it through `--update-env-vars`. It is a runtime var, not
`NEXT_PUBLIC_*`, so changing it needs no image rebuild.

**Rollback / degraded mode.** Unset the variable (or let GIS be blocked by an ad
blocker) and the button falls back to the old `signInWithOAuth` redirect — users
still sign in, they just see `…supabase.co` on the consent screen again.

---

## 10. Mobile (Flutter)

Rebuild the prod flavor pointing at the domain:
```bash
flutter build ipa --dart-define=API_BASE_URL=https://kallo.fit …
```
(The privacy/terms links + OpenFoodFacts contact already point at kallo.fit in this
branch.)

---

## Verification

```bash
RUN_URL="https://<RUN_HOST>"
SECRET="$(gcloud secrets versions access latest --secret=kallo-prod-origin-shared-secret)"

# Origin sealed: raw run.app is 403 without the secret, 200 with it.
curl -s -o /dev/null -w '%{http_code}\n' "$RUN_URL/en"                                 # → 403
curl -s -o /dev/null -w '%{http_code}\n' -H "X-Origin-Verify: $SECRET" "$RUN_URL/en"   # → 200

# Domain via Cloudflare (cf-ray header proves the proxy path); www + http redirect.
curl -sI https://kallo.fit | grep -i 'cf-ray\|^http'
curl -sI http://kallo.fit       | grep -i location
curl -sI https://www.kallo.fit  | grep -i location

# SEO
curl -s https://kallo.fit/robots.txt
curl -s https://kallo.fit/sitemap.xml | head
```
Then sign in with Google/email on `https://kallo.fit`, confirm `/auth/callback` lands
on `/dashboard`, and send a test email to `support@kallo.fit`.

---

## Launch prerequisites / follow-ups

- **Non-prod DB split — SECURITY-REQUIRED before onboarding real users.** Until it
  lands, `nham-internal`/`nham-staging` run `--allow-unauthenticated` with **no
  origin-lock** on the **same database** prod uses — the identical prod data is
  reachable through those unprotected front doors. Fix: create a fresh non-prod
  Supabase project and repoint `nham-nonprod-database-url` + `SUPABASE_PROJECT_ID`
  for internal/staging. The `reset-staging-db.yml` guard then self-heals. See
  `docs/SHARED_STAGING_CICD.md`.
- **GitHub `production` environment reviewers.** Repo Settings → Environments →
  `production` → add yourself as a required reviewer, so prod migrations/deploys
  pause for a click.
- **Legal copy.** `/privacy` and `/terms` ship minimal placeholders — replace with
  reviewed text before a public launch.
- **Full brand rename.** UI copy, PWA manifest name, `/api/healthz` `service` field,
  App Store / TestFlight listing are still `nham`/`Nhẩm`.
- **Rotating the origin secret** means updating BOTH
  `kallo-prod-origin-shared-secret` (Secret Manager, then redeploy) and the
  Cloudflare Transform Rule value.
