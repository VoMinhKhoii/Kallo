# PR Preview Database Branching Design

**Date:** 2026-04-21
**Status:** Approved
**Scope:** Add per-PR Supabase preview branches, seed them from a private off-repo SQL artifact, and wire branch-specific Supabase credentials into the existing Cloud Run preview deployment workflow.

---

## 1. Problem

The repo already has a production-grade Cloud Run preview deployment lane, Google
Cloud authentication through Workload Identity Federation, and a migration-driven
Supabase setup. What it does **not** yet have is isolated preview data per pull
request.

The new requirement is:

1. each pull request gets its own Supabase branch named `pr-<number>`
2. each branch receives the repo migrations
3. each branch is seeded with read-only Vietnamese food composition data,
   including pgvector embeddings
4. the seed source must stay out of Git for security and repo-size reasons
5. the Cloud Run preview app must use the branch-specific Supabase public
   config and database connection, not a shared non-production backend

## 2. Repo Findings That Shape the Design

### 2.1 Existing preview deployment lane already exists

The repo already contains:

- `.github/workflows/cloud-run-preview.yml`
- `.github/workflows/cloud-run-preview-cleanup.yml`
- a successful WIF-based Google Cloud auth path
- Cloud Run preview services named `kallo-pr-<number>`

This work should extend that lane rather than invent a parallel pipeline.

### 2.2 Current preview image reuse is incompatible with full branch isolation

The current design builds one image with shared `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, then reuses that artifact across preview
deploys.

That does **not** satisfy full Supabase branch isolation because the public
Supabase URL and anon key are part of the Next.js client bundle contract. To
point a preview app at a PR-specific Supabase branch, the preview image must be
built **after** branch credentials are known.

### 2.3 Supabase CLI supports stateless branch-targeted migration execution

For CI, the safest model is to:

- manage branch lifecycle with the Supabase CLI using
  `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID`
- fetch branch env with
  `supabase --experimental branches get <branch> -o env`
- push migrations with
  `supabase db push --db-url "$POSTGRES_URL_NON_POOLING"`

This avoids depending on mutable runner-local `supabase link` state.

### 2.4 Seed data must be treated as an external deployment artifact

The local CSV and generated SQL must not be committed. The seed material should
instead be generated locally, uploaded manually to a private GCS bucket, and
downloaded by the preview workflow only when needed.

## 3. Goals and Non-Goals

### 3.1 Goals

This design must deliver:

1. one persistent Supabase branch per open PR
2. branch creation on first preview deploy and branch reuse on later PR updates
3. branch seeding only once per PR branch lifecycle
4. branch-specific preview app configuration for:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `DATABASE_URL`
5. no committed SQL seed artifact in Git
6. deterministic cleanup on PR close

### 3.2 Non-Goals

This design does **not** include:

- automatic regeneration/upload of the seed artifact inside CI
- shared-image preview deploys
- replacing Drizzle/Supabase migration ownership rules
- Terraforming all GCP resources
- seeding on every PR synchronize event

## 4. Recommended Architecture

### 4.1 Decision

Use a **repo-managed preview branch lifecycle**:

1. a local Bun/TypeScript script generates an untracked `seed_food.sql`
2. the SQL file is uploaded to a private GCS bucket
3. the preview workflow creates or reuses `pr-<number>`
4. the workflow fetches branch env from Supabase
5. migrations run against that branch DB
6. the seed file runs only when the branch is newly created
7. the preview image is built with branch-specific public Supabase config
8. Cloud Run is deployed with the branch-specific database URL
9. PR-close cleanup deletes both the Cloud Run preview service and the Supabase
   branch

### 4.2 Why this is the right fit

This approach matches the requested lifecycle exactly, keeps the seed artifact
out of source control, and preserves full preview isolation without introducing
runtime config shims that fight Next.js conventions.

It also keeps branch lifecycle ownership inside repo workflows, which is better
aligned with the explicit `pr-<number>` naming requirement than delegating
creation/cleanup to Supabase-managed GitHub preview automation.

## 5. Units and Interfaces

### 5.1 Local seed generator

**Purpose:** Convert the local CSV into a SQL artifact CI can apply to a fresh
Supabase preview branch.

**Recommended file:** `scripts/generate-seed-food-sql.ts`

**Interface:**

```bash
bun scripts/generate-seed-food-sql.ts \
  --input "/path/to/Vietnamese Food Composition.csv" \
  --output "/path/to/seed_food.sql"
```

**Behavior:**

- takes input/output paths as CLI args so it does not hardcode a developer
  worktree path
- parses the source CSV
- escapes SQL string values safely
- formats pgvector values as SQL string literals like `'[0.1,0.2,...]'`
- emits transactional SQL suitable for `psql -f`
- remains local-only; the generated SQL file is untracked

### 5.2 GCS seed artifact

**Purpose:** Hold the canonical seed SQL file for CI consumption without
committing it to Git.

**Artifact contract:**

- bucket is private
- object path is stable, for example:
  `gs://<bucket>/supabase/seed_food.sql`
- GitHub Actions gets read-only access through the existing deployer service
  account
- upload remains a manual operator step when the seed data changes

### 5.3 Preview deployment workflow

**Purpose:** Materialize a fully isolated preview app and database for a PR.

**Primary file:** `.github/workflows/cloud-run-preview.yml`

**Inputs:**

- `SUPABASE_ACCESS_TOKEN` (GitHub secret)
- `SUPABASE_PROJECT_ID` (GitHub secret or variable, depending on current setup)
- `GCS_SEED_BUCKET` / `GCS_SEED_OBJECT` (GitHub variables)
- existing GCP WIF variables

**Outputs:**

- preview Supabase branch `pr-<number>`
- preview container image built specifically for that PR branch config, using an
  Artifact Registry tag shaped like:
  `${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${GCP_ARTIFACT_REPO}/nham:pr-<number>-<sha>`
- preview Cloud Run service `kallo-pr-<number>`
- PR comment with preview URL

### 5.4 Cleanup workflow

**Purpose:** Reclaim preview infrastructure when a PR closes and sweep orphaned
resources that no longer map to an open PR.

**Primary file:** `.github/workflows/cloud-run-preview-cleanup.yml`

**Behavior:**

- delete Cloud Run service `kallo-pr-<number>`
- delete Supabase branch `pr-<number>`
- keep the scheduled orphan sweep and extend it to Supabase branches, not only
  Cloud Run services
- tolerate already-deleted resources

**Inputs:**

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- existing GCP WIF variables

## 6. Preview Deploy Sequence

The preview workflow should run this sequence after successful CI and before the
final Cloud Run deploy step:

1. check out the PR commit SHA
2. authenticate to Google Cloud via WIF
3. install/setup Supabase CLI
4. compute:
   - `PR_NUMBER`
   - `BRANCH_NAME=pr-${PR_NUMBER}`
    - `SERVICE_NAME=kallo-pr-${PR_NUMBER}`
   - `PREVIEW_IMAGE_TAG=pr-${PR_NUMBER}-${HEAD_SHA}`
5. apply workflow-level concurrency keyed by PR number so same-PR preview runs
   are serialized rather than racing each other
6. check whether the Supabase branch already exists
7. if missing, create it and record `CREATED_BRANCH=true`
8. fetch branch env with:
   `supabase --experimental branches get "$BRANCH_NAME" -o env`
9. export these values into the job environment:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `POSTGRES_URL_NON_POOLING`
10. push repo migrations with:
   `supabase db push --db-url "$POSTGRES_URL_NON_POOLING"`
11. if the branch was newly created:
    - download `seed_food.sql` from GCS
    - execute it with `psql "$POSTGRES_URL_NON_POOLING" -f seed_food.sql`
12. delete the local SQL artifact in an unconditional cleanup step
13. build and push a preview-specific image using branch-specific build args:
    - `NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_ANON_KEY`
14. resolve the pushed image digest and deploy Cloud Run from that immutable
    digest
15. deploy Cloud Run with branch-specific runtime env:
    - `DATABASE_URL=$POSTGRES_URL_NON_POOLING`
    - keep the existing runtime secret contract, including
      `GEMINI_API_KEY`, from Secret Manager
16. run the existing smoke check and PR comment update path

The preview workflow becomes the owner of the preview image build/push/digest
flow. The existing CI-produced shared image path remains valid for the shared
internal lane, but preview deploys no longer consume that generic image because
their public Supabase config is PR-specific.

## 7. Branch Lifecycle Rules

### 7.1 Create vs reuse

Each PR owns exactly one Supabase branch:

- first successful preview deploy for a PR: create branch + migrate + seed
- later preview deploys for the same PR: reuse branch + migrate only

If the current run created the branch and later migration or seeding fails
before deploy, the workflow should best-effort delete that just-created branch
before exiting. That guarantees the next retry starts from a clean state rather
than reusing a partially initialized preview DB.

### 7.2 Seed-once rule

The seed artifact runs only when the branch is first created. That keeps deploys
faster on later commits and matches the requested lifecycle.

If a fully reseeded preview database is ever needed, the branch should be
deleted and recreated rather than silently reseeded on every synchronize event.

### 7.3 Naming rules

| Resource | Pattern |
| --- | --- |
| Supabase branch | `pr-<number>` |
| Cloud Run service | `kallo-pr-<number>` |

The PR number is the shared join key across both systems.

### 7.4 Concurrency rules

The preview workflow should define a concurrency group keyed on the PR number and
should **serialize** same-PR runs instead of canceling an in-flight run during
branch creation or seeding. This avoids two preview jobs racing on:

- branch creation
- first-run seeding
- preview deploy ordering

Newer runs may queue behind older ones, but the last successful run still wins by
deploying the latest commit SHA for that PR.

## 8. Configuration Contract

### 8.1 Build-time config

The preview image must be built with branch-specific values for:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

These should be sourced from the branch env emitted by Supabase CLI:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### 8.2 Runtime config

Cloud Run must receive the branch-specific direct database URL:

- `DATABASE_URL=$POSTGRES_URL_NON_POOLING`

Using the non-pooling connection string keeps DB tooling behavior predictable for
migrations and direct SQL execution.

The preview deploy must also preserve the rest of the current runtime contract.
Existing runtime secrets and deploy flags stay in place unless this feature
explicitly changes them. In particular:

- `GEMINI_API_KEY` should remain Secret Manager-backed
- the existing service account, resource sizing, labels, and smoke-check behavior
  should remain intact

### 8.3 Secrets and variables

The workflow should rely on:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_PROJECT_ID`
- existing GCP WIF variables
- a variable for the GCS bucket/object path

The workflow should never hardcode project refs, bucket names, or literal
connection strings.

## 9. Failure Handling

### 9.1 Hard-stop failures

The preview job must fail before deploy if any of these steps fail:

- branch existence check/create
- branch env retrieval
- migration push
- seed execution on a newly created branch

This prevents an app deploy against a partially prepared preview database.

If the failing run created the branch in the same job, it should best-effort
delete that branch before exiting so the next run can recreate and reseed it
cleanly.

### 9.2 Seed cleanup behavior

The workflow should delete `seed_food.sql` in an `if: always()` cleanup step so
the file is removed even on failure.

Because the runner is ephemeral and the seed artifact is read-only data rather
than an application secret, normal deletion is sufficient:

- `rm -f seed_food.sql`

### 9.3 Cleanup workflow tolerance

PR-close cleanup should not fail if the preview service or preview branch no
longer exists. That job is garbage collection, not a correctness gate.

The scheduled orphan sweep should apply the same rule to both systems:

- delete Cloud Run preview services whose PR is no longer open
- delete Supabase preview branches named `pr-<number>` whose PR is no longer open

## 10. Validation Expectations

The final implementation should prove these conditions:

1. a PR creates or reuses the matching Supabase branch
2. migrations target the branch-specific database URL
3. seed execution happens only on first branch creation
4. preview image build uses the branch-specific public Supabase config
5. Cloud Run deploy receives the branch-specific `DATABASE_URL`
6. PR-close cleanup targets both the matching Cloud Run service and the matching
   Supabase branch
7. a failed first-run create/seed path does not leave behind a poisoned branch
   that later runs would incorrectly reuse
8. same-PR preview runs do not race each other during branch creation, seeding,
   and deploy

## 11. Implementation Notes

### 11.1 Why TypeScript for the local seed generator

The repo already uses Bun and TypeScript. A local Bun script fits existing
tooling better than introducing a separate Python dependency path.

### 11.2 Exact branch lifecycle CLI pattern

To reduce planner ambiguity, the implementation should follow this shape:

```bash
if supabase --experimental branches get "$BRANCH_NAME" -o env > branch.env 2>/dev/null; then
  CREATED_BRANCH=false
else
  supabase --experimental branches create "$BRANCH_NAME"
  supabase --experimental branches get "$BRANCH_NAME" -o env > branch.env
  CREATED_BRANCH=true
fi

set -a
. ./branch.env
set +a
```

Then:

- run `supabase db push --db-url "$POSTGRES_URL_NON_POOLING"`
- if `CREATED_BRANCH=true`, run the seed SQL with `psql`

### 11.3 Why GCS instead of GitHub artifacts

The seed SQL must exist independently of any one workflow run and should be
downloadable by preview deploy jobs on demand. A private GCS object is a better
fit than ephemeral workflow artifacts.

### 11.4 Why not shared preview images

Full branch isolation means public Supabase config is preview-specific. Reusing a
single generic preview image would point the browser at the wrong Supabase
backend unless the app were redesigned around a runtime config shim, which this
design intentionally avoids.
