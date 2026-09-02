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
| `authGlobal` (all proxied auth ops) | global | 300 / 3000 / — | degraded |
| `authRefresh` | ip | 60 / — / — | memory |
| `authOther` | ip | 60 / — / — | memory |
| `waitlistSignupIp` | ip | 5 / 20 / 50 | degraded |
| `waitlistConfirmIp` | ip | 20 / 100 / — | degraded |
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
