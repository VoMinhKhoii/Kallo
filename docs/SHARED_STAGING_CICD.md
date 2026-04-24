# Shared Staging CI/CD Guide

This document explains how the Cloud Run CI/CD flow works **right now** for the
shared non-production database.

## Services

- `nham-internal` — auto-deployed from `main`
- `nham-staging` — **manual** shared staging environment for promoted testing
- `nham-pr-<number>` — preview service footprint kept only for legacy/manual
  recovery workflows; automatic PR previews are disabled

All non-production deploy targets currently read the same non-prod database URL
from Secret Manager when they are active.

## Automatic flows

### 1. CI (`.github/workflows/ci.yml`)

On PRs and pushes to `main`, CI:

- runs lint, typecheck, tests, build, and migration validation
- builds and pushes a container image tagged by commit SHA

CI does **not** deploy Cloud Run directly.

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

- GitHub Actions deploys `nham-internal`
- smoke checks run automatically
- failed smoke checks roll traffic back to the previous revision

## Manual shared staging flow

### 4. Shared staging deploy (`.github/workflows/cloud-run-staging.yml`)

Use this when someone wants to intentionally promote a branch/ref to a shared
staging environment for deeper testing.

The workflow is `workflow_dispatch` and asks for:

- `ref` — branch, tag, or commit SHA
- `reason` — why staging is being taken over
- `force_takeover` — whether to replace an active lease

The workflow does this:

1. checks out the requested ref
2. acquires a **GCS-backed lease**
3. reads the shared DB secret
4. runs `supabase db push` against the shared non-prod DB
5. deploys `nham-staging`
6. runs the normal smoke check
7. comments on the PR with the staging URL when `ref` is `pr-<number>` or ends
   with `#<number>`
8. releases the lease in cleanup

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

## Summary

- **PR preview:** disabled by default; only legacy/manual operations remain
- **Internal:** automatic from `main`
- **Staging:** manual, leased, intended for intentional shared-environment QA
- **Reset DB:** emergency-only recovery path
