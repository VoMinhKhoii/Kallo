# Shared Staging CI/CD Guide

This document explains how the Cloud Run CI/CD flow works **right now** for the
shared non-production database.

## Services

- `nham-internal` — auto-deployed from `main`. This is the dogfood environment.
  Refuses to deploy if any local migration is missing from the shared non-prod DB
  (see "Migration drift guard" below).
- `nham-staging` — auto-deployed on push to the `staging` branch, also available
  as a manual `workflow_dispatch` for ad-hoc deploys of arbitrary refs/PRs.
- `nham-pr-<number>` — preview service footprint kept only for legacy/manual
  recovery workflows; automatic PR previews are disabled

All non-production deploy targets currently read the same non-prod database URL
from Secret Manager when they are active.

## Branch model

- `staging` — long-lived branch. Pushes here auto-deploy `nham-staging`,
  applying any new migrations to the shared non-prod DB along the way.
  Use this branch to validate schema changes before merging to `main`.
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

- **Auto:** `push` to the `staging` branch. Reason and `force_takeover` are
  filled in automatically (`Auto-deploy from staging branch (commit <sha>)` and
  `false`). Use this for the normal flow: merge or push to `staging`, then wait.
- **Manual:** `workflow_dispatch` with three inputs — `ref` (branch, tag, commit
  SHA, or plain PR number), `reason`, `force_takeover`. Use this to deploy an
  arbitrary ref (e.g. a PR being reviewed) without merging it to `staging`
  first.

In both cases, the workflow does this:

1. resolves the target ref (`ref` input for manual, `staging` branch tip for
   auto)
2. checks out the resolved ref
3. acquires a **GCS-backed lease**
4. reads the shared DB secret
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

## Future production environment

Currently `main` only feeds `nham-internal`. There is no production environment
yet — both internal and staging point at the same shared non-prod Supabase
project (`[INTERNAL] Nhẩm`). When we are ready to run a real production
service, the plan is:

- New Supabase project (`[PROD] Nhẩm`) with its own database URL, stored as a
  separate Secret Manager secret (`nham-prod-database-url`).
- New Cloud Run service `nham-prod` with prod-only runtime config (memory,
  scaling, secrets).
- New workflow `cloud-run-prod.yml` triggered on `push: branches: [main]`,
  mirroring the staging workflow's lease + `supabase db push` + deploy +
  smoke-check pattern, but against its own lease bucket
  (`gs://nham-prod-leases`) so prod and staging cannot block each other.
- Internal continues to deploy from `main` against the non-prod DB for
  dogfooding. Once prod exists, internal becomes "production-shape, non-prod
  data" — unchanged.

This section is intentionally a plan, not a runbook. None of these resources
exist yet.

## Summary

- **PR preview:** disabled by default; only legacy/manual operations remain
- **Internal:** automatic from `main`; refuses to deploy if migrations are
  pending on the shared non-prod DB
- **Staging:** automatic on push to `staging`, manual via `workflow_dispatch`
  for arbitrary refs; leased and intended for intentional shared-environment QA
- **Reset DB:** emergency-only recovery path
- **Prod:** not yet provisioned (see "Future production environment")
