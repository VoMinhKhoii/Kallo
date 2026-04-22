# Google Cloud Run Setup

This repo now ships a Cloud Run deployment path with:

- one shared internal service: `nham-internal`
- one preview service per PR: `nham-pr-<number>`
- one immutable Artifact Registry image per commit SHA
- GitHub Actions authentication through Workload Identity Federation (WIF)

The deploy path is meant for internal dogfooding first, but it is structured so we
can later split staging and production without redesigning the whole pipeline.

## What the workflows expect

The workflows in `.github/workflows/` assume:

- Google Cloud project, billing, and APIs are already enabled
- Artifact Registry stores images in a Docker repo named by
  `GCP_ARTIFACT_REPO`
- GitHub Actions authenticates with `google-github-actions/auth@v3`
  through WIF
- Cloud Run runtime secrets come from Secret Manager
- the shared CI image uses GitHub repo variables for
  `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Preview database modes

Preview deploys support two explicit database modes:

| Mode | What preview services use | When to use |
| --- | --- | --- |
| `shared` | The shared non-prod Supabase database behind `nham-nonprod-database-url` | Default mode on the current plan |
| `branch` | A per-PR Supabase branch created via `supabase branches` | Future mode once the project has Supabase branching enabled |

Set GitHub Actions variable `PREVIEW_DATABASE_MODE` to control the behavior.
Leave it unset or set it to `shared` for the current setup.

When you later upgrade to Supabase Pro, switching is meant to be operationally
simple:

1. set `PREVIEW_DATABASE_MODE=branch`
2. add `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID` GitHub secrets
3. keep `GCS_SEED_BUCKET` and `GCS_SEED_OBJECT` pointing at the generated seed
4. rerun a preview PR

## Required Google Cloud resources

Create or confirm these resources:

- Artifact Registry Docker repository
- Workload Identity Pool
- Workload Identity Provider for GitHub OIDC
- Deployer service account for GitHub Actions
- Runtime service account for Cloud Run revisions
- Secret Manager secrets:
  - `nham-nonprod-database-url`
  - `nham-nonprod-gemini-api-key`

The workflows create Cloud Run services on first deploy, so you do not need to
pre-create `nham-internal` or preview services manually.

## GCS preview seed bucket setup

Use these commands to create and grant access to the private preview seed
bucket:

```bash
export GCP_PROJECT_ID="cal-487315"
export GCP_REGION="asia-southeast1"
export GCS_PREVIEW_SEED_BUCKET="nham-preview-seeds"
export GCP_DEPLOYER_SERVICE_ACCOUNT="github-deployer@cal-487315.iam.gserviceaccount.com"

gcloud storage buckets create "gs://$GCS_PREVIEW_SEED_BUCKET" \
  --project="$GCP_PROJECT_ID" \
  --location="$GCP_REGION" \
  --uniform-bucket-level-access

gcloud storage buckets add-iam-policy-binding "gs://$GCS_PREVIEW_SEED_BUCKET" \
  --member="serviceAccount:$GCP_DEPLOYER_SERVICE_ACCOUNT" \
  --role="roles/storage.objectViewer"
```

## Seed refresh flow and GitHub settings

Refresh the generated seed artifact with:

```bash
bun scripts/generate-seed-food-sql.ts \
  --input "Vietnamese Food Composition.csv" \
  --output "./seed_food.sql"

gcloud storage cp ./seed_food.sql \
  "gs://$GCS_PREVIEW_SEED_BUCKET/supabase/seed_food.sql"

rm -f ./seed_food.sql
```

Required GitHub settings for the current shared mode:

- Variables:
  - `PREVIEW_DATABASE_MODE=shared` (or leave unset)

Additional GitHub settings used by shared mode reset and future branch mode:

- Variables:
  - `GCS_SEED_BUCKET`
  - `GCS_SEED_OBJECT`

Additional GitHub settings required only for future `branch` mode:

- Secrets:
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_PROJECT_ID`

## Shared staging reset workflow

The shared preview/internal database is intentionally recoverable.

Use **GitHub → Actions → Reset Staging Database** when staging drifts into a bad
state. The workflow:

1. checks out the default branch
2. runs `supabase db reset --linked --yes`
3. reapplies the generated `seed_food.sql` from GCS

That gives you a one-button rebuild of the shared staging database from the
latest approved migrations plus the generated search/embedding seed state.

## Recommended naming

Use names close to these so the guide and workflows stay easy to map:

| Resource | Suggested name |
| --- | --- |
| Artifact Registry repo | `nham` |
| Workload Identity Pool | `github-actions` |
| Workload Identity Provider | `github` |
| Deployer service account | `github-deployer` |
| Runtime service account | `cloud-run-runtime` |
| Internal Cloud Run service | `nham-internal` |
| Preview Cloud Run services | `nham-pr-<number>` |

## Required APIs

Enable these APIs in the target project:

```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com
```

## Bootstrap shell variables

Set these once in your shell before running the setup commands below:

```bash
export GCP_PROJECT_ID="your-project-id"
export GCP_PROJECT_NUMBER="your-project-number"
export GCP_REGION="asia-southeast1"
export GCP_ARTIFACT_REPO="nham"
export GCP_WIF_POOL_ID="github-actions"
export GCP_WIF_PROVIDER_ID="github"
export GCP_DEPLOYER_SA_ID="github-deployer"
export GCP_RUNTIME_SA_ID="cloud-run-runtime"
export GITHUB_REPOSITORY="VoMinhKhoii/Nham"
```

## 1. Create Artifact Registry

```bash
gcloud artifacts repositories create "$GCP_ARTIFACT_REPO" \
  --repository-format=docker \
  --location="$GCP_REGION" \
  --description="Nham Cloud Run images"
```

## 2. Create service accounts

```bash
gcloud iam service-accounts create "$GCP_DEPLOYER_SA_ID" \
  --display-name="GitHub Actions deployer"

gcloud iam service-accounts create "$GCP_RUNTIME_SA_ID" \
  --display-name="Cloud Run runtime"
```

Resolve the full emails:

```bash
export GCP_DEPLOYER_SERVICE_ACCOUNT="$GCP_DEPLOYER_SA_ID@$GCP_PROJECT_ID.iam.gserviceaccount.com"
export GCP_RUNTIME_SERVICE_ACCOUNT="$GCP_RUNTIME_SA_ID@$GCP_PROJECT_ID.iam.gserviceaccount.com"
```

## 3. Grant IAM roles

### Deployer service account

The deployer must be able to push images, create/update/delete Cloud Run
services, attach the runtime service account, and access Secret Manager for
pre-deploy validation and database reset operations.

```bash
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$GCP_DEPLOYER_SERVICE_ACCOUNT" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$GCP_DEPLOYER_SERVICE_ACCOUNT" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$GCP_DEPLOYER_SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

gcloud iam service-accounts add-iam-policy-binding \
  "$GCP_RUNTIME_SERVICE_ACCOUNT" \
  --member="serviceAccount:$GCP_DEPLOYER_SERVICE_ACCOUNT" \
  --role="roles/iam.serviceAccountUser"
```

### Runtime service account

The app reads runtime secrets from Secret Manager-backed Cloud Run env
configuration.

```bash
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$GCP_RUNTIME_SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

## 4. Create Secret Manager secrets

Create the secrets if they do not exist:

```bash
printf '%s' 'postgres://...' | gcloud secrets create nham-nonprod-database-url \
  --data-file=-

printf '%s' 'your-gemini-api-key' | gcloud secrets create nham-nonprod-gemini-api-key \
  --data-file=-
```

If the secrets already exist, add a new version instead:

```bash
printf '%s' 'postgres://...' | gcloud secrets versions add \
  nham-nonprod-database-url \
  --data-file=-

printf '%s' 'your-gemini-api-key' | gcloud secrets versions add \
  nham-nonprod-gemini-api-key \
  --data-file=-
```

## 5. Create Workload Identity Federation

Create the pool:

```bash
gcloud iam workload-identity-pools create "$GCP_WIF_POOL_ID" \
  --project="$GCP_PROJECT_ID" \
  --location="global" \
  --display-name="GitHub Actions"
```

Create the GitHub OIDC provider:

```bash
gcloud iam workload-identity-pools providers create-oidc \
  "$GCP_WIF_PROVIDER_ID" \
  --project="$GCP_PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$GCP_WIF_POOL_ID" \
  --display-name="GitHub" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref" \
  --attribute-condition="attribute.repository == '$GITHUB_REPOSITORY'"
```

Bind the GitHub repo principal set to the deployer service account:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  "$GCP_DEPLOYER_SERVICE_ACCOUNT" \
  --project="$GCP_PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$GCP_PROJECT_NUMBER/locations/global/workloadIdentityPools/$GCP_WIF_POOL_ID/attribute.repository/$GITHUB_REPOSITORY"
```

### WIF notes

- This setup restricts token exchange to this repository.
- The workflows themselves further restrict deploy lanes:
  - previews run only for successful same-repo PR CI runs
  - internal deploys run only for successful `main` push CI runs
- If we later want stronger separation, split preview/internal/ops into
  distinct service accounts or providers with narrower attribute conditions.

## 6. Add GitHub repository variables

In **GitHub → Settings → Secrets and variables → Actions → Variables**, add:

| Variable | Purpose |
| --- | --- |
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_PROJECT_NUMBER` | Google Cloud project number |
| `GCP_REGION` | Cloud Run and Artifact Registry region |
| `GCP_ARTIFACT_REPO` | Artifact Registry Docker repo name |
| `GCP_WIF_PROVIDER` | Full WIF provider resource path |
| `GCP_DEPLOYER_SERVICE_ACCOUNT` | Full deployer SA email |
| `GCP_RUNTIME_SERVICE_ACCOUNT` | Full runtime SA email |
| `NEXT_PUBLIC_SUPABASE_URL` | Non-prod public Supabase URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Non-prod public Supabase anon key |

`GCP_WIF_PROVIDER` must be the full resource name:

```text
projects/<project-number>/locations/global/workloadIdentityPools/<pool-id>/providers/<provider-id>
```

No GitHub secret is required for Google auth in this deploy path. WIF handles
authentication, and runtime secrets stay in Secret Manager.

## 7. Public config rule

`NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are **build-time inputs** for the shared
CI image.

That means:

- changing them requires a new CI image build
- changing Cloud Run runtime env vars later will not fix stale client bundle
  config
- previews rebuild after branch env is fetched from Supabase, so each PR gets
  branch-specific public config

### Preview runtime notes

- preview images are built per PR after branch env is fetched
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` come
  from Supabase branch env
- `DATABASE_URL` is injected with `--set-env-vars`
- `GEMINI_API_KEY` remains Secret Manager-backed
- PR-close and scheduled cleanup remove both Cloud Run services and Supabase
  branches

## 8. Cloud Run defaults used by the workflows

### Internal service: `nham-internal`

- CPU: `1`
- Memory: `1Gi`
- Concurrency: `20`
- Timeout: `60`
- Min instances: `1`
- Max instances: `10`
- Public URL enabled
- Secret-backed runtime env:
  - `DATABASE_URL`
  - `GEMINI_API_KEY`

### Preview services: `nham-pr-<number>`

- CPU: `1`
- Memory: `1Gi`
- Concurrency: `20`
- Timeout: `60`
- Min instances: `0`
- Max instances: `3`
- Public URL enabled
- `DATABASE_URL` is injected with `--set-env-vars`
- `GEMINI_API_KEY` stays Secret Manager-backed

## 9. Workflow map

| Workflow | Purpose |
| --- | --- |
| `CI` | Validate repo, then build and push SHA-tagged image |
| `Cloud Run Preview` | Deploy/update same-repo PR previews |
| `Cloud Run Internal` | Deploy `main` to `nham-internal`, with smoke-triggered rollback |
| `Cloud Run Preview Cleanup` | Delete preview Cloud Run services on PR close, remove matching Supabase branches, and clean up orphan previews nightly |
| `Cloud Run Ops` | Manual redeploy, rollback, and preview refresh operations |

## 10. Manual operations

The `Cloud Run Ops` workflow supports:

- `redeploy-internal`
- `rollback-internal`
- `refresh-preview`

Useful commands for operators:

Find the image digest for a known commit SHA:

```bash
export IMAGE_TAG="$GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/$GCP_ARTIFACT_REPO/nham:<commit-sha>"
gcloud artifacts docker images describe "$IMAGE_TAG" \
  --format='value(image_summary.digest)'
```

Inspect current internal traffic:

```bash
gcloud run services describe nham-internal \
  --region="$GCP_REGION" \
  --format='table(status.traffic.revisionName,status.traffic.percent)'
```

List revisions for rollback selection:

```bash
gcloud run revisions list \
  --region="$GCP_REGION" \
  --service=nham-internal
```

## 11. Manual verification checklist

Run these after setup:

1. Open a same-repo PR and confirm:
   - CI publishes an image for the PR head SHA
   - `Cloud Run Preview` comments or updates the PR with a preview URL
   - `https://<preview-url>/api/healthz` returns the expected health JSON
2. Close that PR and confirm:
   - `Cloud Run Preview Cleanup` deletes `nham-pr-<number>` and the matching Supabase branch
   - the old preview URL no longer serves the app
3. Merge a known-good change to `main` and confirm:
   - `Cloud Run Internal` deploys `nham-internal`
   - smoke checks pass without rollback
4. Run a controlled rollback drill in a non-production window:
   - force smoke verification to fail once
   - confirm traffic returns to the previously serving revision
5. Run `Cloud Run Ops` once with a known digest:
   - redeploy internal by digest
   - refresh one preview by digest
   - confirm deployment-record artifacts are uploaded

## 12. Known boundaries of the current setup

- Previews and internal share one non-production Supabase backend for now.
- This setup is intentionally open on the default Cloud Run URL; application auth
  is still the access gate.
- The workflows do not run destructive DB reset or backfill commands.
- A later production environment with different `NEXT_PUBLIC_*` values will need
  a separate image build or a different client-config bootstrap strategy.
