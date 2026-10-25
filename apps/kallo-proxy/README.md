# kallo-proxy

The Cloudflare Worker in front of the `kallo-prod` Cloud Run service. It runs on
`kallo.fit/*` and `*.kallo.fit/*` (`admin.kallo.fit` runs `kallo-admin`;
`media.kallo.fit` runs no Worker), and does two things:

1. **Forwards every request to Cloud Run** with the origin-lock header
   (`X-Origin-Verify`, which `proxy.ts` requires), `X-Forwarded-Host` and
   `X-Forwarded-Proto`. A visitor's own `X-Origin-Verify` is overwritten.
2. **Refuses per-IP floods on the anonymous surfaces** before they cost a Cloud
   Run request, using the Workers Rate Limiting binding:

| Surface | Paths | Limit per IP (IPv6: per /64) | Refusal |
|---|---|---|---|
| `auth` | `/api/supabase-proxy/auth/v1/*` except refresh | 100 / min | 429 in GoTrue's shape (`over_request_rate_limit`) |
| `auth-refresh` | `POST …/auth/v1/token?grant_type=refresh_token` | 600 / min | **503** `service_unavailable`: a 429 would sign the user out |
| `waitlist` | `/api/v1/waitlist`, `/api/v1/waitlist/confirm` | 100 / min | 429 `RATE_LIMITED` envelope |
| `healthz` | `/api/healthz` | 100 / min | same |
| `csp-report` | `/api/csp-report` | 100 / min | same |
| `invite` | `GET /api/v1/groups/invite/{slug}` | 100 / min | same |
| `barcode-image` | `/api/v1/barcode/image/{code}` | 100 / min | same |

Every refusal carries `Retry-After: 60` and is the exact shape the app itself
answers with, so no client knows the edge exists.

**These are flood breakers, never the real limit.** Carrier NAT puts many real
users behind one address, and Workers rate limits are counted per Cloudflare
location, approximately. The app's own limiter (`docs/RATE_LIMITING.md`) stays
the authority. When the binding fails, or a request has no `cf-connecting-ip`,
the Worker forwards rather than refuses.

Code: `src/worker.ts`; tests: `src/__tests__/worker.test.ts` (run by the root
`bun run test`). It has no dependencies of its own; `wrangler` is only needed to
deploy.

## Deploy

Not deployed by CI. From this folder, with a Cloudflare login that can edit
Workers on the account:

```bash
cd apps/kallo-proxy
bunx wrangler deploy --dry-run   # bundles and prints the bindings; changes nothing
bunx wrangler deploy
bunx wrangler deployments list   # the new version is on top
```

Check it right after:

```bash
curl -sI https://kallo.fit/en | head -1                    # 200: forwarding works
for i in $(seq 1 105); do curl -s -o /dev/null -w '%{http_code}\n' https://kallo.fit/api/healthz; done | sort | uniq -c
# mostly 200, then 429s once the minute's 100 are spent
```

**Rollback:** `bunx wrangler rollback` returns to the previous version (the
pre-repo pass-through), or **Workers & Pages → kallo-proxy → Deployments** in
the dashboard.

### Make `ORIGIN_SECRET` a secret

Before this Worker came into the repo, `ORIGIN_SECRET` was a plain-text
variable set in the dashboard. `keep_vars: true` in `wrangler.jsonc` keeps a
deploy from deleting it. To turn it into an encrypted secret without downtime:
**Workers & Pages → kallo-proxy → Settings → Variables and Secrets →
`ORIGIN_SECRET` → Edit → Type: Secret → Deploy** (same value). After that,
rotate it with `bunx wrangler secret put ORIGIN_SECRET`, and update the
`kallo-prod-origin-shared-secret` GCP secret at the same time
(`docs/PROD_DOMAIN_SETUP.md` "Rotating the origin secret").

### workers.dev is off

`workers_dev: false` turns off `kallo-proxy.<account>.workers.dev`. It was on
before, and it forwarded to Cloud Run with the origin-lock secret attached,
outside the zone's WAF. Nothing in Kallo uses that URL.

## Bot Fight Mode

**Recommendation: leave it off.** On the Free plan, Bot Fight Mode applies to
every request on the zone and **cannot be skipped** by WAF custom rules or Page
Rules (it does not run on the Ruleset Engine). It challenges traffic that looks
automated, and a challenge is an HTML page:

- the iOS app's API calls (`/api/v1/*`, `/api/analyze-meal`,
  `/api/supabase-proxy/*`) cannot solve it, so a person can fail to log a meal
  or to sign in;
- the server-to-server callers cannot either: Supabase's send-email hook
  (`/api/auth/send-email` — sign-up and reset mail stop) and the RevenueCat
  webhook (`/api/webhooks/revenuecat` — entitlements stop updating).

The per-IP breakers above, the app's own limits and the $10/day AI brake cover
what Bot Fight Mode would add. If bot filtering is wanted later, **Super Bot
Fight Mode** (Pro plan and up) can skip the API and webhook paths.

To check or change it: **Cloudflare dashboard → kallo.fit → Security → Bots**.
The **Bot Fight Mode** toggle is on that page. If you do turn it on, watch
**Security → Events** (filter: *Bot Fight Mode*) for `/api/` paths being
challenged, and turn it off again if any are.
