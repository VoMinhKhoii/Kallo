# Rate Limiting

How Kallo bounds request volume, what happens when the limiter itself breaks,
and how to operate it during an incident.

Code: `lib/infra/rate-limit/limiter/` (public entry `limiter.ts`).
SQL: `public.rate_limit_consume()`, tables `rate_limit_counters` /
`rate_limit_events` (see `docs/DATABASE.md`).

> This is NOT the analysis guard. `lib/infra/rate-limit/analysis-guards.ts`
> stays in place for analyze-meal, relog, entitlement reconcile, OG cards and
> OCR, because it also models **concurrency** (an in-flight slot with a
> release) which this limiter has no concept of. The two share only the HMAC
> pepper.

## The three layers

| Layer | Where | Scope | What it is for |
|---|---|---|---|
| 1. Cloudflare edge | Cloudflare dashboard (not in this repo) | Global | Coarse per-IP flood rule. Ops-managed; see `docs/PROD_DOMAIN_SETUP.md`. |
| 2. In-process token bucket | `memory-bucket.ts` | One Cloud Run instance | Burst breaker. Stops one client's spike from costing one DB round trip per request. **Never a security boundary** — an attacker spread across instances walks past it. |
| 3. Postgres | `rate_limit_consume()` | Global, authoritative | The actual ceiling. One row per `(key_kind, key_hash, route)` holding minute/hour/day counters, updated by a single `INSERT … ON CONFLICT DO UPDATE … WHERE <headroom>`. |

### Why one statement

Postgres takes the row lock *before* evaluating the `DO UPDATE … WHERE`, so
concurrent consumes serialize on that lock and a request that fails the
headroom test writes nothing. That is what makes "a blocked request never
raises a counter" true without a transaction, without a read-then-write race,
and at one round trip per key.

### Windows are UTC-pinned

Every truncation uses the **three-argument** form,
`date_trunc('minute', v_now, 'UTC')`. The two-argument form truncates in the
*session* `TimeZone`, and under a transaction pooler the session is not one we
own — the same user would land in different day buckets depending on which
backend answered. The day window end is `+ interval '24 hours'` rather than
`+ interval '1 day'` for the same reason (day-typed intervals are resolved in
the session zone and shift across a DST transition).

### Counters are soft state

`rate_limit_counters` is `UNLOGGED` with `fillfactor = 70`. It writes no WAL,
so it is **truncated on crash recovery, not replicated, and absent from PITR**.
That is the deliberate trade: the table is written on every guarded request
(including unauthenticated auth-proxy traffic) and would otherwise be the
hottest WAL producer in the database, while losing it costs at most one window
of accumulated quota. `rate_limit_events` is ordinary LOGGED storage — an audit
trail that vanishes on the crash you are investigating is worthless.

## Policies

Registry: `policies.ts`. Data only — no env overrides, because a ceiling an
environment variable can move is a ceiling nobody can reason about from the
code.

| Policy | Key | min / hr / day | failMode |
|---|---|---|---|
| `authEmailIp` (signup, recover, otp, resend, email-change) | ip | 10 / 30 / 100 | degraded |
| `authEmailRecipient` (same ops, keyed on the target mailbox) | recipient | 2 / 6 / 20 | degraded |
| `authLoginIp` (password grant, verify, MFA) | ip | 30 / 300 / 1000 | degraded |
| `authLoginAccount` (password grant, keyed on the target account) | account | 10 / 30 / 100 | degraded |
| `authGlobal` (every proxied auth op that reaches the DB layer — the `email` and `login` classes; see "Wired surfaces") | global | 300 / 3000 / — | degraded |
| `authRefresh` (flood breaker, not a quota — a refusal here is a sign-out risk) | ip | 600 / — / — | memory |
| `authRefreshGlobal` (the botnet backstop for refresh) | global | 3000 / 60000 / — | degraded |
| `authOther` | ip | 60 / — / — | memory |
| `waitlistSignupIp` | ip | 5 / 20 / 50 | degraded |
| `waitlistConfirmIp` | ip | 20 / 100 / — | degraded |
| `waitlistGlobal` (app-wide backstop for both waitlist surfaces — runs even with a null IP) | global | 30 / 300 / — | degraded |
| `healthzIp` | ip | 30 / — / — | memory |
| `inviteLookupIp` | ip | 30 / — / — | memory |
| `chatMessageSend` | user | 30 / 600 / 3000 | degraded |
| `shareReply` | user | 20 / 300 / 1500 | degraded |
| `shareReaction` | user | 60 / 600 / — | degraded |
| `barcodeSearch` | user | 30 / 300 / 1500 | degraded |
| `avatarUpload` | user | 5 / 20 / 50 | degraded |
| `feedbackScreenshot` | user | 5 / 20 / 50 | degraded |
| `ocrGlobalDaily` | global | — / — / 5000 | **closed** |
| `pushGlobalHourly` | global | — / 20000 / — | degraded |

Shape of the numbers:

- **IP limits are deliberately generous.** CGNAT, campus NAT and corporate
  egress put thousands of unrelated people behind one address. A tight IP limit
  locks a university out long before it inconveniences a botnet.
- **`account` / `recipient` limits are the strict ones.** They are keyed on the
  thing being attacked — the mailbox being bombed, the account being
  brute-forced — so rotating source addresses does not escape them.
- **`global` budgets are the botnet backstop**, capping total spend even when
  no individual key looks abusive.
- **`memory` policies carry a `perMinute` and nothing else**, per instance. The
  per-instance bucket is a rate, not a quota: it has no calendar window to hang
  an hour or a day budget on, so declaring one would be a ceiling nothing
  enforces. The `RateLimitPolicy` type rejects it outright.

When a caller applies several policies to one request, the order is
`global → ip → account/recipient`: cheapest rejection first, and a block
short-circuits so a refused request never charges the narrower counters.

## Wired surfaces (PR 2)

Which routes actually call the limiter, what they key on, and — the part that
is easy to get wrong — **what a refusal looks like to the client that made it**.

| Route | Class / condition | Policies, in order | Keys | Refusal envelope |
|---|---|---|---|---|
| `POST /api/supabase-proxy/auth/v1/{signup,recover,otp,magiclink,resend}`, `PUT\|POST .../user` with an `email` **or `phone`** | `email` | `authGlobal` → `authEmailIp` → `authEmailRecipient` | `global:'auth'`, `ip`, `recipient` (canonical target — see "What a target key is") | GoTrue: `{code:429, error_code:'over_request_rate_limit', msg}` + `Retry-After` |
| `GET\|POST .../reauthenticate` (sends a nonce by mail/SMS — an `email` op on BOTH verbs) | `email` | `authGlobal` → `authEmailIp` | `global:'auth'`, `ip` (no account key — the bearer token is unverified here) | same |
| `POST .../token?grant_type=password\|pkce\|id_token`, `POST .../verify`, `POST .../factors/{id}/{verify,challenge}` | `login` | `authGlobal` → `authLoginIp` → `authLoginAccount` | `global:'auth'`, `ip`, `account` (canonical target account) | same |
| `POST .../token?grant_type=refresh_token` | `refresh` | `authRefreshGlobal` → `authRefresh` | `global:'auth:refresh'`, `ip` | **503** `{code:503, error_code:'service_unavailable', msg}` + `Retry-After` — see "Why a refusal on refresh is a 503" |
| everything else under `auth/v1/` (`GET /user`, `logout`, `settings`, `authorize`, `callback`, unknown paths) | `other` | `authOther` | `ip` only | 429, as above |
| `auth/v1/admin/*` and `auth/v1/invite` | — | none (never forwarded) | — | `404 {"error":"Not found"}` — both are service-key surfaces no client of this proxy holds a key for |
| `POST /api/v1/waitlist` | — | `waitlistGlobal` → `waitlistSignupIp` | `global:'waitlist'`, `ip` | app envelope `{error:{code:'RATE_LIMITED',…}}` + `Retry-After` |
| `GET /api/v1/waitlist/confirm` | — | `waitlistGlobal` → `waitlistConfirmIp` | `global:'waitlist-confirm'`, `ip` | same |
| `GET /api/healthz` | — | `healthzIp` | `ip` | same (never health JSON — a throttled probe learned nothing about the service) |

Classification lives in `app/api/supabase-proxy/_lib/auth-path-policy.ts` and is
covered by an exhaustive test table; body reading in `_lib/auth-body.ts`, target
extraction in `_lib/auth-target.ts`, enforcement order in `_lib/enforce-limits.ts`,
and the whole pre-forward sequence in `_lib/guard-auth-request.ts`.

### What a target key is, and why a request without one is refused

The `recipient` / `account` budgets are the only controls an attacker cannot
escape by rotating source addresses, so the value they key on has to match what
GOTRUE will act on — not what our own clients happen to send:

- **Case-insensitive field lookup.** GoTrue is Go, and `encoding/json` binds
  struct fields case-insensitively. `{"Email":…}` and `{"EMAIL":…}` mail the
  same stranger `{"email":…}` does; an exact-key lookup returned "no recipient"
  and skipped the mail-bombing budget entirely.
- **Form encoding too.** `ParseForm` accepts
  `application/x-www-form-urlencoded`, so the same request re-encoded slipped
  past a JSON-only reader. The parser is chosen by trying JSON then form —
  never from `content-type`, which the attacker also writes.
- **Plus-addressing and Gmail dots are collapsed on known-alias domains**
  (`canonicalizeEmailForKey` in `lib/core/text/email.ts`):
  `victim+1@gmail.com` … `victim+9999@gmail.com` are one mailbox and must be one
  counter. Both collapses are applied to `gmail.com` / `googlemail.com` only,
  because on an arbitrary domain the operator is free to provision `a@d.com` and
  `a+x@d.com` as SEPARATE mailboxes — collapsing them would let a flood at one
  exhaust the other's budget. **For the key only** — the address forwarded
  upstream is always the one the caller typed.
- **Phones are keyed as `phone:<digits>`**, matching GoTrue's own
  `formatPhoneNumber` (which strips every non-digit), and namespaced so a phone
  can never share a counter with an email.
- **Length is a CAP, not a filter.** An over-long value is truncated onto a
  (shared, therefore stricter) key at 320 chars. Dropping it was a bypass: a
  255-character address became "no target".
- **`requiresTarget` fails closed.** Mail-sending ops and the password grant are
  refused locally with `400 {"error_code":"validation_failed"}` when no email or
  phone can be extracted — forwarding an unkeyed `signup`/`recover` is exactly
  the mail bomb the recipient budget exists to stop. `/verify` (a `token_hash`
  link names nobody), `/reauthenticate`, the PKCE/id_token grants and MFA are
  deliberately exempt.
- **A refresh must be JSON with a plausible `refresh_token`** (non-empty string,
  ≤ 2048 chars) or it is refused the same way. That also removes a grant
  confusion: Go's `ParseForm` merges the body into `r.Form` with the body taking
  precedence over the query string, so a form-encoded `grant_type=password`
  body sent to `?grant_type=refresh_token` would be a password grant upstream
  and a cheap memory-bucket `refresh` to us.

### Why a refusal on refresh is a 503

`POST /token?grant_type=refresh_token` is the one request where "slow down"
cannot be spoken as 429. supabase-js's `_callRefreshToken` and
supabase-flutter's gotrue both call `_removeSession()` on any **non-retryable**
error, and only auth-js's `NETWORK_ERROR_CODES` (502, 503, 504, 520-524, 530)
are retryable. A local 429 on refresh is therefore a forced sign-out of a user
whose only crime was a shared IP.

So a limiter block on `op === 'refresh'` answers **503 + `Retry-After`**
(`limiterUnavailableResponse`): the client backs off and keeps the session.
`handleError` short-circuits on the status before reading the body, so on this
path supabase-js never parses `error_code`/`msg` at all — the status is the
whole message. Everything else keeps its 429.

### Why the auth proxy speaks GoTrue's dialect

supabase-js and supabase-flutter do not know they are talking to a proxy. Both
feed every non-2xx response to gotrue's error handler, which reads the code
from `error_code` (the numeric HTTP status sits in `code`, failing its
string check) and the message from `msg`. Answering in **our** envelope would
surface as the generic "something went wrong" line in both apps — the wrong
copy for the one failure a user most needs to understand. `over_request_rate_limit`
is the code the clients map to their localized "too many attempts" string —
supabase-flutter has since launch (`auth_form_controller.dart`), and the web
forms were taught to (`lib/infra/auth/rate-limited.ts`, used by
`components/auth/sign-{in,up}-form.tsx`, copy at `auth.sign*.errors.rateLimited`
in both locales). Speaking the dialect is what makes the right copy POSSIBLE on
each client; it does not by itself make it correct there. Builder + test:
`_lib/gotrue-error.ts`.

### Guard rails at these call sites

- **A policy is never applied with zero keys.** `getRequestIp` returns `null`
  in production whenever `cf-connecting-ip` is absent, so every per-IP policy is
  called under `if (ip)`. A call that resolves no key counts nothing and throws
  `RateLimitPolicyMisuseError` outside production.
- **A `null` IP is not unlimited** on the auth proxy: `authGlobal` still ran.
  On `authRefresh` / `authOther` (IP-only memory policies) there is genuinely
  nothing to enforce, and the request is admitted — both are cheap, and refusing
  token refresh over a missing edge header would be the worse failure.
- **The waitlist has an app-wide backstop, not only a per-IP one.**
  `waitlistGlobal` (30/min, 300/hr) runs on every signup and confirm regardless
  of whether an IP could be resolved, so a caller submitting DISTINCT addresses
  with a null IP is now bounded app-wide rather than only by `signUpForWaitlist`'s
  per-ADDRESS resend cooldown. Signup and confirm key it on distinct values
  (`waitlist` / `waitlist-confirm`), so each gets its own counter under the same
  ceiling. A null IP in production means the request did not come through
  Cloudflare (something already holding the origin secret); the global cap makes
  that a bounded edge rather than a hole.
- **`other` skips every DB policy**; `refresh` carries `authRefreshGlobal`
  instead of `authGlobal`. `authRefresh` is per-IP and per-instance, so a botnet
  replaying stolen refresh tokens from a million addresses looks like a million
  ordinary phones to it and is visible only in a total. That backstop costs one
  database round trip on the path that keeps every signed-in user signed in —
  the exact cost the memory-only design of `authRefresh` was meant to avoid —
  and it is accepted deliberately: one shared counter row, `degraded` so a
  limiter outage never blocks refresh, sized far above anything the real fleet
  produces. `authRefresh` itself is loose (600/min per instance) because it is a
  flood breaker, not a quota: one carrier-NAT address fronts thousands of
  phones, and a refusal there is a sign-out risk rather than a delay.

### Bodies are bounded before they are buffered

`lib/infra/http/bounded-body.ts` — `content-length` prefilter plus a streaming
cap, so a lying or absent header buys nothing. `readBoundedJson` layers
`JSON.parse` on top. Over the cap is **413 `PAYLOAD_TOO_LARGE`**, not 400, and
not retryable: the same bytes will be refused again.

| Reader | Cap | Refusal |
|---|---|---|
| `/api/supabase-proxy/auth/v1/*` | 64 KB | GoTrue `{code:413, error_code:'payload_too_large', msg}` |
| `POST /api/v1/waitlist` | 8 KB | app envelope, via `handleRouteError` |
| RevenueCat + Supabase auth-hook webhooks | unchanged | `readBoundedWebhookBody`, now a thin adapter over the same reader, still throwing `WebhookPayloadTooLargeError` so each handler answers in its provider's shape |

### Upstream sees one IP, and that — not `authGlobal` — is the real ceiling

The proxy does **not** forward `X-Forwarded-For`. Supabase honours a
caller-supplied client address only via `Sb-Forwarded-For` presented with a
secret API key this layer does not hold, so every proxied user already shares
one bucket in Supabase's per-IP auth limits: this service's Cloud Run egress
address. Sending a header upstream ignores would only look like a fix.

Be precise about what follows from that, because the comfortable version is
wrong. **Supabase's per-IP auth limits are the app's real auth ceiling**, and
they apply to the entire user base at once:

| Supabase limit (`supabase/config.toml`) | Value | Applies to |
|---|---|---|
| `sign_in_sign_ups` | 30 / 5 min **per IP** | every proxied sign-in and sign-up, together |
| `token_verifications` | 30 / 5 min **per IP** | every OTP / magic-link verification, together |
| `token_refresh` | 150 / 5 min **per IP** | every session refresh, together |

The hosted project's dashboard values are what actually run — `config.toml` is
the local-dev source and the documented default shape, not the deployed
setting. `authGlobal` is **not** sized against these and cannot be: it is a
botnet backstop that caps total spend when no individual key looks abusive, and
it is not a fairness mechanism between our users. Raising the dashboard limits
is an ops action, tracked in `docs/PROD_DOMAIN_SETUP.md` along with the
structural fix (a `Sb-Forwarded-For` + secret-key proxy redesign).

## failMode: what happens when the limiter cannot answer

A consume is raced against `LIMITER_DB_TIMEOUT_MS` (default 400 ms). The pool
is 2 connections per instance, so a consume queues behind whatever else that
isolate is running; postgres.js `connect_timeout` bounds *establishing* a
connection, not waiting for one.

When the deadline wins, the query is **cancelled**, not merely abandoned
(`PendingQuery.cancel()`, which is why the consumer goes through
`db.$client.unsafe` rather than drizzle's `execute`). A query left in the
postgres.js queue would later take one of the two connections anyway and commit
a consume for a request that had already been refused — the counter would climb
for traffic nobody served. A queued query is dropped and rejected with SQLSTATE
57014 immediately; an in-flight one is cancelled over a separate socket, so this
works even when the pool is the exhausted resource.

| failMode | On DB error or timeout | Used by |
|---|---|---|
| `closed` | Throw `RateLimitUnavailableError` → **503 + `Retry-After: 10`** | Spend routes only |
| `degraded` | Fall back to a per-instance bucket at the policy's raw `perMinute` (no burst) and keep serving; result `source: 'degraded'` | Auth proxy, cheap IP routes, authenticated surfaces |
| `memory` | Never touches the DB at all; the bucket *is* the policy (`perMinute` only, per instance) | healthz, invite lookup, auth refresh |

**Spend-only fail-closed.** `ocrGlobalDaily` is the single `closed` policy: an
OCR call spends Gemini quota, so admitting it with the guard down means
spending money with no ceiling — a 503 is cheaper than an uncapped bill.
Everything else degrades, because failing an *auth* route closed hands an
attacker a denial-of-service against sign-in by attacking the limiter instead.

`pushGlobalHourly` is `degraded` and has no `perMinute`, so during a limiter
outage it admits. That is intentional: the guard runs inside the send path, and
failing it closed would drop the user's message rather than a push.

## Keys and hashing

Kinds: `user`, `ip`, `account`, `recipient`, `global`.

- Values are HMAC-SHA256'd under `ANALYSIS_GUARD_HASH_SECRET` with payload
  `rl.v1:<kind>:<value>`, and stored as `v1:<hex>`. Nothing identifying reaches
  the database.
- Kinds are domain-separated: the same address as an `account` key and as a
  `recipient` key hash differently and cannot share a counter.
- `ip` is canonicalized before hashing; **IPv6 is aggregated to its /64
  prefix**. A residential IPv6 customer is handed a /64 (often a /56 or /48), so
  a per-address limit is no limit at all. IPv4-mapped addresses fold back to the
  IPv4 form — their /64 is a single constant, and aggregating them would
  collapse every mapped client onto one counter. The fold is detected on the
  *expanded* address, so every spelling behaves identically:
  `::ffff:1.2.3.4`, `::ffff:0102:0304`, `0:0:0:0:0:ffff:1.2.3.4` and the
  bracketed form all hash to the same key as `1.2.3.4`.
  `::ffff:0:1.2.3.4` is **not** mapped-v4 — that is the SIIT translation prefix
  `::ffff:0:0/96`, a different block, and it aggregates to its /64 like any
  other IPv6 address.
- `account` / `recipient` values are normalized (NFC, lowercased) **by the
  caller**; the limiter hashes them as given.
- An unparseable IP raises `RateLimitKeyError` and that key is **skipped**, not
  passed: the call's remaining keys (and the caller's other policies, in
  practice the global budget) still apply.
- If a call resolves **no** usable key at all — wrong `kind` for the policy, an
  empty value, or every key unparseable — then nothing was counted and the
  request was not limited. Outside production that throws
  `RateLimitPolicyMisuseError` (fail fast: a silently unenforced limiter reads
  as enforced in review). In production it admits, logs once per route per 30 s,
  and records an event with `reason = 'misuse'` and **`source = 'none'`** — never
  `'db'`, so an unenforced route cannot hide among the enforced ones.

### Where the IP comes from

`lib/infra/security/request-ip.ts`. In production (`ORIGIN_SHARED_SECRET` set,
so the origin lock is active and traffic arrives through Cloudflare) it returns
**`cf-connecting-ip` only**, and `null` when that header is absent. It never
falls back to `x-forwarded-for`: XFF is client-writable, and a limiter keyed on
a header the attacker chooses is not a limiter. Non-production falls back to
`x-forwarded-for[0]` then `x-real-ip` so local dev works.

### Key versioning and pepper rotation

The `v1:` prefix exists so a pepper rotation is an explicit migration and not a
silent global quota reset. To rotate:

1. Add the new pepper and bump the prefix constant in `key-hash.ts` to `v2`.
2. Deploy. New requests mint `v2:` rows; old `v1:` rows stop being read.
3. Do nothing else — `reap_rate_limit_counters()` removes the orphaned `v1:`
   rows within two days.

There is a window (one deploy) in which every key gets a fresh budget. Rotate
during low traffic, or accept it: the alternative is re-hashing rows you cannot
re-derive, because the pepper is the only thing that could.

## Operations

### Reset one key's quota

Counters are soft state; deleting a row is safe and takes effect immediately.

```sql
-- You need the hashed key. Recompute it with the same pepper:
--   printf 'rl.v1:ip:203.0.113.5' | openssl dgst -sha256 -hmac "$PEPPER" -r
DELETE FROM public.rate_limit_counters
WHERE key_hash = 'v1:<hex>' AND route = 'auth:email:ip';
```

To clear an entire route (e.g. after a bad limit ships):

```sql
DELETE FROM public.rate_limit_counters WHERE route = 'auth:email:ip';
```

The per-instance memory buckets cannot be cleared from SQL; they drain on their
own within a minute, or on the next deploy.

### Telemetry

Every block, and every fail-closed outage, is counted into `rate_limit_events`
(fire-and-forget — telemetry never fails a request).

**One row is an aggregate, not one block.** The writer coalesces identical
`(route, key_kind, key_hash, reason, source)` tuples in memory and flushes at
most 200 rows in a single `INSERT`, at most once every 5 s per instance. Writing
one row per blocked request turned the flood breaker into database write
amplification: the harder the flood, the more writes it generated into a LOGGED,
indexed table, on the same two-connection pool the limiter exists to protect.

Consequences for reading this table:

- **Count with `sum(hits)`, never `count(*)`.** `count(*)` counts flushes.
- `created_at` is the FIRST block in the aggregate, `last_seen_at` the most
  recent. A row spans the interval between them.
- The in-memory buffer holds 2000 distinct tuples per instance; past that,
  further *new* tuples in that window are dropped and logged (existing ones keep
  counting). A dropped-events log line means an attack with extreme key
  cardinality — the shape is still visible in what was kept.
- Up to one flush interval of events is lost if an instance dies. This is
  attack *visibility*, not billing.

```sql
-- 429 rate by route and reason over the last hour.
SELECT route, reason, source, sum(hits) AS blocks
FROM public.rate_limit_events
WHERE created_at > now() - interval '1 hour'
GROUP BY route, reason, source
ORDER BY blocks DESC;

-- Distinct keys hitting a route: a spike in cardinality is a distributed
-- attack; a spike in volume on FEW keys is one bad client.
SELECT route,
       count(DISTINCT key_hash) AS keys,
       sum(hits) AS blocks
FROM public.rate_limit_events
WHERE created_at > now() - interval '15 minutes'
GROUP BY route
ORDER BY keys DESC;

-- The worst offenders on one route (hashes only — join nothing, identify
-- nobody; use this to size limits, not to chase individuals).
SELECT key_kind, key_hash, sum(hits) AS blocks
FROM public.rate_limit_events
WHERE route = 'auth:email:recipient'
  AND created_at > now() - interval '24 hours'
GROUP BY key_kind, key_hash
ORDER BY blocks DESC
LIMIT 20;

-- Limiter outages, SPLIT BY CAUSE. `unavailable_timeout` means the DB deadline
-- fired: the pool is saturated and we are shedding — a capacity problem.
-- `unavailable_error` means the round trip failed outright: the database is
-- unreachable — an outage. Same 503 to the client, opposite response from you.
SELECT route, reason, sum(hits) AS blocks, max(last_seen_at) AS latest
FROM public.rate_limit_events
WHERE reason IN ('unavailable_timeout', 'unavailable_error')
  AND created_at > now() - interval '1 day'
GROUP BY route, reason;

-- Policies applied with no usable key: these requests were NOT limited.
-- Any row here is a bug at a call site, not an attack.
SELECT route, sum(hits) AS calls, max(last_seen_at) AS latest
FROM public.rate_limit_events
WHERE reason = 'misuse' AND created_at > now() - interval '7 days'
GROUP BY route;

-- Counter table growth (IPv6 /64 keys are the growth driver).
SELECT count(*), min(updated_at), max(updated_at)
FROM public.rate_limit_counters;
```

### Retention

Four nightly `pg_cron` jobs, all installed by
`20260901194715_rate_limit_retention.sql`:

| Job | Function | Horizon |
|---|---|---|
| `reap-rate-limit-counters-daily` (03:53) | `reap_rate_limit_counters()` | `updated_at` older than 2 days, deleted in 50k batches |
| `reap-rate-limit-events-daily` (03:54) | `reap_rate_limit_events()` | `created_at` older than 30 days, deleted in 50k batches |
| `reap-analysis-rate-limit-windows-daily` (03:55) | `reap_analysis_rate_limit_windows()` | `updated_at` older than 2 days |
| `reap-analysis-in-flight-limits-daily` (03:57) | `reap_analysis_in_flight_limits()` | `updated_at` older than 1 day, **including rows with `count > 0`** (crash-abandoned leases) |

The last two clean up the *legacy* analysis-guard tables, which shipped in
May 2026 with no retention at all.

## Testing

`lib/infra/rate-limit/limiter/__tests__/rate-limit-consume.db.test.ts` pins the
SQL against a real Postgres; CI runs it in the `migrations` job through the
local transaction pooler, which is how production connects. Every case goes
through the pooler, including the two that switch role.

### Do not execute a denied function AS `anon` or `authenticated`

`supautils`, loaded by the Supabase Postgres image, decorates permission-denied
errors with a `GRANT … TO <role>` hint for the roles in its
`supautils.hint_roles` GUC (`anon, authenticated, service_role`). On supautils
3.2.0–3.2.1 — shipped by Postgres images before `17.6.1.155`, which is what
supabase CLI 2.90.0 (our CI pin) installs — the FUNCTION arm of that hint
dereferences a NULL relation name and **segfaults the backend**:

```
LOG:  server process (PID …) was terminated by signal 11: Segmentation fault
DETAIL:  Failed process was running: SELECT * FROM public.rate_limit_consume(…)
```

The postmaster then terminates every other backend (SQLSTATE `57P02`) and runs
crash recovery, so a single such call takes down everything else connected. It
is not the pooler (a plain `psql` on the direct port crashes identically), not
postgres.js, and not this function — any EXECUTE-denied function does it, while
denied tables, sequences and schemas are fine. The neighbouring
`GRANT <role> TO CURRENT_USER` crashes the same way; spell the grantee out by
name.

Two consequences:

- **In tests**, the "anon really cannot execute it" case runs as a throwaway
  role that INHERITS `anon` rather than as `anon` itself. An inheriting member
  holds exactly anon's privileges plus PUBLIC's and owns nothing, so both
  `REVOKE … FROM anon` and `REVOKE … FROM PUBLIC` still have to hold for the
  call to be refused — but the role is not in `hint_roles`, so the error
  arrives as a clean `42501`.
- **In production**, the same shape is reachable from the internet: `public` is
  a PostgREST-exposed schema, so `POST /rest/v1/rpc/rate_limit_consume` runs as
  `anon` and hits the identical denied-function path. Upstream fixed it in
  supautils 3.2.2 (supabase/supautils #196, #200, #214, #225); hosted projects
  on an image `17.6.1.155` or newer are not affected. Bumping the CI pin to
  supabase CLI ~2.112+ would clear it locally too.

## Known edges

- **The memory bucket is per-isolate.** A 20-instance fleet has 20 independent
  buckets, so the effective in-process burst ceiling is 20× the configured one.
  The DB layer is what actually holds; the bucket only exists to keep a flood
  off the connection pool.
- **`console.error` throttling is per-isolate too** (one line per route per
  30 s, per instance). During a real limiter outage expect up to one line per
  instance per window.
- **Counters are truncated by a crash.** See "soft state" above.
- **A blocked request costs one statement on the first key that refuses it**
  (the block is cheap, not free) — but its telemetry is amortised: identical
  blocks are coalesced in memory and flushed as one batched `INSERT` at most
  every 5 s, so a flood does not multiply into telemetry writes. A block caught
  by the memory prefilter costs no statement at all.
- **A `null` IP is not "unlimited".** It means that key is unavailable; the
  caller's other policies still apply. Any surface that relies on the IP key
  alone must also carry a global budget.
- **NAT64 traffic shares one bucket.** The well-known prefix `64:ff9b::/96`
  puts every IPv4 destination behind a single /64, so all NAT64 clients of one
  translator land on one `ip` counter. The IP limits are already sized for
  CGNAT-scale sharing, and the `account` / `recipient` keys are the controls
  that do not degrade under aggregation.
- **No secondary index on `rate_limit_counters`.** The only reader is the
  primary key; an `updated_at` index would be written on every consume purely
  to serve one nightly reaper, which is why the reaper batches instead.
- **The counters and events reapers are FUNCTIONs, so they cannot `COMMIT`
  between batches.** The 50k batching bounds each *statement*, not the
  transaction. If either table ever outgrows one transaction, the fix is a
  `PROCEDURE` invoked with `CALL`, not a larger batch.
