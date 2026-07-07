# Shared Staging CI/CD Guide

This document explains how the Cloud Run CI/CD flow works **right now** for the
shared non-production database.

## Services

- `nham-internal` — auto-deployed from `main`. This is the dogfood environment.
  Refuses to deploy if any local migration is missing from the shared non-prod DB
  (see "Migration drift guard" below).
- `nham-staging` — auto-deployed when CI completes successfully on the
  `staging` branch (via `workflow_run`); also available as a manual
  `workflow_dispatch` for ad-hoc deploys of arbitrary refs/PRs.
- `nham-pr-<number>` — preview service footprint kept only for legacy/manual
  recovery workflows; automatic PR previews are disabled

All non-production deploy targets currently read the same non-prod database URL
from Secret Manager when they are active.

## Branch model

- `staging` — long-lived branch. Pushes here run CI; once CI is green,
  `nham-staging` auto-deploys via a `workflow_run` trigger that applies any
  new migrations to the shared non-prod DB along the way. Use this branch to
  validate schema changes before merging to `main`. CI failures on `staging`
  block the auto-deploy entirely (no lease acquired, no `db push`).
- `main` — feeds `nham-internal` (dogfooding). Also the future source of
  `nham-prod` once the prod environment is provisioned (see
  "Future production environment" below).

## Automatic flows

### 1. CI (`.github/workflows/ci.yml`)

On PRs and pushes to `main` **or** `staging`, CI:

- runs lint, typecheck, tests, build, and migration validation
- builds and pushes a container image tagged by commit SHA

CI does **not** deploy Cloud Run directly. The `staging` trigger was added so
that PRs targeting `staging` (and direct pushes to `staging`) get the same
validation gate as PRs to `main` — without it, a push to `staging` would only
get checked by the deploy workflow itself, which is too late to be a useful
gate. The internal-deploy workflow has an explicit `head_branch == 'main'`
guard, so CI completing on `staging` will not accidentally deploy
`nham-internal`.

### 2. Preview deploy (`.github/workflows/cloud-run-preview.yml`)

This workflow is intentionally disabled right now:

- the deploy job is gated behind `if: false`
- CI success does **not** create or refresh `nham-pr-<number>`
- the shared-db preview logic remains in the repo only for legacy cleanup and
  future re-enablement work

Important:

- automatic previews are disabled on purpose
- shared staging is now the only supported pre-merge deployment lane

### 3. Internal deploy (`.github/workflows/cloud-run-internal.yml`)

After a successful `main` CI run:

- GitHub Actions runs pre-deploy validation, including the **migration drift
  guard** (`assert-migrations-applied`): the deploy fails fast if any
  `supabase/migrations/*.sql` version is missing from
  `supabase_migrations.schema_migrations` on the shared non-prod DB.
- If the guard passes, GitHub Actions deploys `nham-internal`.
- Smoke checks run automatically.
- Failed smoke checks roll traffic back to the previous revision.

#### Migration drift guard

`nham-internal` and `nham-staging` share the same non-prod database. To prevent
the dogfood environment from running with stale schema, internal deploys assert
that every local migration is already applied. If you merge a PR that adds new
migrations without first deploying via `staging` (or the manual staging
workflow), the internal deploy will fail with an error naming the pending
versions. The fix is always: push the same commit to the `staging` branch (or
trigger the staging workflow manually), wait for `supabase db push` to apply
the migrations, then re-run the internal deploy.

## Shared staging flow

### 4. Shared staging deploy (`.github/workflows/cloud-run-staging.yml`)

This workflow has two trigger paths:

- **Auto:** `workflow_run` from a successful CI run on the `staging` branch.
  This guarantees CI's container publish has already finished (so the deploy
  can find the image) and that a failing CI on `staging` blocks the deploy
  before any lease is acquired or migration is applied. Reason and
  `force_takeover` are filled in automatically
  (`Auto-deploy from staging branch (commit <sha>)` and `false`).
- **Manual:** `workflow_dispatch` with three inputs — `ref` (branch, tag, commit
  SHA, or plain PR number), `reason`, `force_takeover`. Use this to deploy an
  arbitrary ref (e.g. a PR being reviewed) without merging it to `staging`
  first.

In both cases, the workflow does this:

1. resolves the target ref (`ref` input for manual, `workflow_run.head_sha` for
   auto)
2. checks out the resolved ref
3. acquires a **GCS-backed lease**
4. validates the migrations are append-only (defense in depth — manual
   dispatches may target refs CI hasn't yet validated)
5. runs `supabase db push` against the shared non-prod DB
6. deploys `nham-staging`
7. runs the normal smoke check
8. comments on the PR with the staging URL when the manual `ref` is
   `pr-<number>` or ends with `#<number>` (auto deploys never have a PR
   number — they happen post-merge)
9. releases the lease in cleanup

## Why the lease exists

GitHub Actions concurrency is **not** a true FIFO queue. It can keep only one
running and one pending job per concurrency group, and pending jobs can be
replaced.

Because of that, we do **not** rely on GitHub concurrency to protect a shared
database. Instead, shared staging uses a real lock:

- bucket: `gs://nham-staging-leases`
- object: `staging/lease.json`

The lease records:

- who owns staging
- which ref/commit is deployed
- why it was taken over
- when the lease expires

If staging is already leased, a later workflow run fails instead of silently
overwriting someone else's test session, unless `force_takeover=true`.

## Cleanup and recovery

### 5. Preview cleanup (`.github/workflows/cloud-run-preview-cleanup.yml`)

- deletes legacy preview services when PRs close
- also deletes orphaned preview services on schedule

### 6. Reset staging database (`.github/workflows/reset-staging-db.yml`)

This is an **emergency fallback**, not a normal step.

Use it only when shared non-prod DB state is dirty and needs to be restored to
the expected baseline.

The reset replays migrations from a chosen ref (defaults to `staging`, which is
the canonical pre-prod source of truth). The optional `ref` workflow input
exists for emergency recovery — for example, if `staging` itself contains a
broken migration, an operator can override with `main` or any other branch/SHA
that has known-good migrations. After the reset, `nham-internal` will see the
chosen ref's schema (since it shares the same DB), so the override should match
or precede whatever's currently merged to `main`.

## Day-to-day guidance

### Use legacy/manual preview services only for:

- cleanup of older `nham-pr-<number>` services
- one-off operational recovery while the preview path is disabled

### Use `nham-staging` for:

- coordinated manual QA
- multi-step flows on a shared branch/ref
- testing that needs temporary ownership of the shared DB-backed environment

### Before running manual staging deploy

Make sure:

- you actually need exclusive shared staging
- nobody else currently owns the staging lease
- your branch has already passed CI

## Required infra knobs

Current supporting resources:

- Secret Manager:
  - `nham-nonprod-database-url`
  - `nham-nonprod-gemini-api-key`
- GitHub repo variable:
  - `GCS_STAGING_LEASE_BUCKET=nham-staging-leases`
- GCS bucket:
  - `gs://nham-staging-leases`

## Production environment (`kallo-prod`)

Production runs as the `kallo-prod` Cloud Run service, fronting the **kallo.fit**
domain (the app is rebranding Nhẩm → Kallo). Deploy pipeline:

- **Workflow:** `.github/workflows/cloud-run-prod.yml` — triggered by a
  successful `CI` run on `main` (`workflow_run`), the same gate as internal. It
  mirrors the staging lease + `supabase db push` + deploy + smoke pattern, using
  its own lease bucket (`gs://kallo-prod-leases`, object `prod/lease.json`) so
  prod and staging deploys never block each other.
- **Region:** `asia-southeast1` (Singapore), overriding `vars.GCP_REGION`
  (`asia-southeast3` / Bangkok, where internal + staging run) via `env.PROD_REGION`
  in the workflow — prod co-locates with the Supabase DB (AWS ap-southeast-1). The
  image is still built to the Bangkok Artifact Registry and pulled cross-region.
- **Runtime:** `--min-instances=1 --max-instances=20 --memory=2Gi --cpu=1`,
  `--ingress=all` (Cloudflare reaches the run.app origin over the public internet —
  no Cloud Run domain mapping; Cloudflare proxies to run.app and rewrites the Host
  header with an Origin Rule). The origin is sealed at the app layer instead:
  Cloudflare injects an `X-Origin-Verify` secret and `middleware.ts` (via
  `ORIGIN_SHARED_SECRET`) 403s anything that did not arrive through Cloudflare. The
  deploy smoke-check sends the same secret so it can reach the raw run.app URL.
- **Secrets (Secret Manager):** `kallo-prod-database-url`,
  `kallo-prod-gemini-api-key`, `kallo-prod-analysis-guard-hash-secret`,
  `kallo-prod-origin-shared-secret`.
- **GitHub secret:** `KALLO_PROD_PROJECT_ID` — prod's own Supabase project ref,
  used by `assert-target`. Deliberately separate from the shared
  `SUPABASE_PROJECT_ID` so the non-prod DB split can't break prod validation.
- **Repo variable / bucket:** `GCS_PROD_LEASE_BUCKET=kallo-prod-leases`,
  `gs://kallo-prod-leases`.

Full domain / DNS / Cloudflare / Supabase / OAuth runbook:
**`docs/PROD_DOMAIN_SETUP.md`**.

### Database: current transition

To preserve real data and the already-wired Google/Apple OAuth, `kallo-prod`
reuses the **current dogfood Supabase project** as production
(`kallo-prod-database-url` = that project's DB URL). Because `nham-internal` and
`nham-staging` still read `nham-nonprod-database-url`, which currently points at
that same project, there is a transitional overlap:

- Both `cloud-run-internal` and `cloud-run-prod` apply migrations to that DB on a
  `main` merge. `supabase db push` applies only what is pending (idempotent); if
  the two race, re-running `cloud-run-prod` is safe.
- `reset-staging-db.yml` is **guarded**: it hard-fails while
  `nham-nonprod-database-url` and `kallo-prod-database-url` are byte-identical,
  so it cannot wipe production during the overlap.

**Fast-follow (removes the overlap):** create a fresh non-prod Supabase project,
repoint `nham-nonprod-database-url` (and `SUPABASE_PROJECT_ID`) at it for
internal/staging. The reset guard then self-heals (the two secrets differ) and
the migration race disappears; `kallo-prod` owns its DB outright.

## Summary

- **PR preview:** disabled by default; only legacy/manual operations remain
- **Internal:** automatic from `main`; applies pending migrations to the shared
  non-prod DB before deploying
- **Staging:** automatic on successful CI from `staging`, manual via
  `workflow_dispatch` for arbitrary refs; leased and intended for intentional
  shared-environment QA
- **Prod (`kallo-prod`):** automatic from `main`; leased, applies migrations to
  the prod DB, behind Cloudflare + domain mapping (see `docs/PROD_DOMAIN_SETUP.md`)
- **Reset DB:** emergency-only recovery path; guarded against wiping prod during
  the DB transition
