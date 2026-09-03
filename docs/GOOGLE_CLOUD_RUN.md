# Google Cloud Run Setup

> **Updated (2026-07):** The `nham-internal`, `nham-staging`, and PR-preview
> pipelines were retired to cut cost. `kallo-prod` is now the only Cloud Run
> deploy target. Sections below that describe the internal/staging/preview
> services are historical.

This repo deploys a single production service via `cloud-run-prod.yml`:

- **Production service** (`kallo-prod`): Automatically deploys on `main` merge after CI succeeds; applies pending migrations behind a GCS lease, then blue-green promotes after a smoke check
- Artifact Registry: One immutable image per commit SHA (built + pushed by CI)
- Authentication: GitHub Actions via Workload Identity Federation (WIF)

## Deployment Model

1. A pull request runs CI and builds an immutable image.
2. After review and verification, merge to `main`.
3. A successful `main` CI run triggers `cloud-run-prod.yml`.
4. The prod job acquires its GCS lease, validates and applies pending
   append-only migrations, deploys a no-traffic candidate, smoke-tests it, and
   only then promotes traffic.

There is currently no persistent staging, internal, or preview deployment.
Sandbox billing tests run locally (or through an explicitly approved temporary
tunnel) until a separate QA lane is designed.

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

## Preview database modes (Disabled by default)

Automatic PR previews are currently disabled, but the preview workflow still
retains two database modes for legacy cleanup and future re-enablement:

| Mode | What staging services use | When to use |
| --- | --- | --- |
| `shared` | The shared non-prod Supabase database behind `nham-nonprod-database-url` | Current mode (no branching) |
| `branch` | A per-PR Supabase branch created via `supabase branches` | Future mode once the project has Supabase branching enabled |

Set GitHub Actions variable `PREVIEW_DATABASE_MODE` to control that dormant
preview behavior if previews are ever re-enabled. Leave it unset or set it to
`shared` for the current setup.

When you later upgrade to Supabase Pro, switching is meant to be operationally
simple:

1. set `PREVIEW_DATABASE_MODE=branch`
2. add `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID` GitHub secrets
3. keep `GCS_SEED_BUCKET` and `GCS_SEED_OBJECT` pointing at the generated seed
4. manually trigger staging deployment for a PR

## Required Google Cloud resources

Create or confirm these resources:

- Artifact Registry Docker repository
- Workload Identity Pool
- Workload Identity Provider for GitHub OIDC
- Deployer service account for GitHub Actions
- Runtime service account for Cloud Run revisions
- GCS bucket for staging lease state
- Secret Manager secrets:
  - `kallo-prod-database-url`
  - `kallo-prod-gemini-api-key`
  - `kallo-prod-analysis-guard-hash-secret`
  - `kallo-prod-origin-shared-secret`
  - `kallo-prod-supabase-service-role-key`
  - `kallo-prod-revenuecat-customer-delete-api-key`
  - `kallo-prod-revenuecat-rest-api-key`
  - `kallo-prod-revenuecat-webhook-secret`
  - `kallo-prod-resend-api-key`
  - `kallo-prod-send-email-hook-secret`
  - `kallo-prod-usda-api-key`

The prod workflow creates `kallo-prod` on first deploy, so the service itself
does not need to be pre-created. All required secrets must exist before merge;
otherwise the automatic prod deploy stops during pre-deploy validation.

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
bun scripts/db/generate-seed-food-sql.ts \
  --input "Vietnamese Food Composition.csv" \
  --output "./seed_food.sql"

gcloud storage cp ./seed_food.sql \
  "gs://$GCS_PREVIEW_SEED_BUCKET/supabase/seed_food.sql"

rm -f ./seed_food.sql
```

Required GitHub settings for the current shared mode:

- Variables:
  - `PREVIEW_DATABASE_MODE=shared` (or leave unset)

Additional GitHub settings used by the shared reset workflow and future branch
mode:

- Variables:
  - `GCS_SEED_BUCKET`
  - `GCS_SEED_OBJECT`
- Secrets:
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_PROJECT_ID`

Additional GitHub settings required only for future `branch` mode:

- No additional variables or secrets beyond the shared reset settings above.

## Shared staging reset workflow

The shared preview/internal database is intentionally recoverable.

Use **GitHub → Actions → Reset Staging Database** when staging drifts into a bad
state. The workflow:

1. checks out the default branch
2. verifies that `SUPABASE_PROJECT_ID` matches the project behind
   `nham-nonprod-database-url`
3. runs `supabase db reset --linked --yes`
4. reapplies the generated `seed_food.sql` from GCS
5. verifies that the rebuilt DB has core tables, seeded food rows, the
   `on_auth_user_created` trigger, and zero orphaned `auth.users` rows

That gives you a one-button rebuild of the shared staging database from the
latest approved migrations plus the generated search/embedding seed state.
It also replays a backfill migration so pre-existing `auth.users` rows regain
their `public.user_profiles` rows after remote resets.

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
| Shared staging Cloud Run service | `nham-staging` |
| Preview Cloud Run services | `nham-pr-<number>` |
| Staging lease bucket | `nham-staging-leases` |

## Required APIs

Enable these APIs in the target project:

```bash
gcloud services enable \
  aiplatform.googleapis.com \
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
  --description="Kallo Cloud Run images"
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
services, attach the runtime service account, access Secret Manager for
pre-deploy validation and database reset operations, and call Vertex AI — the
"Backfill food embeddings" deploy step runs `scripts/db/backfill_embeddings.ts`
with `AI_PROVIDER=vertex` under the deployer's own ADC.

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

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$GCP_DEPLOYER_SERVICE_ACCOUNT" \
  --role="roles/aiplatform.user"

gcloud iam service-accounts add-iam-policy-binding \
  "$GCP_RUNTIME_SERVICE_ACCOUNT" \
  --member="serviceAccount:$GCP_DEPLOYER_SERVICE_ACCOUNT" \
  --role="roles/iam.serviceAccountUser"
```

### Runtime service account

The app reads runtime secrets from Secret Manager-backed Cloud Run env
configuration, and calls Vertex AI through Application Default Credentials
when `AI_PROVIDER=vertex` (the default for deployed environments — see the
"Vertex AI provider" section below).

```bash
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$GCP_RUNTIME_SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
  --member="serviceAccount:$GCP_RUNTIME_SERVICE_ACCOUNT" \
  --role="roles/aiplatform.user"
```

## 4. Create Secret Manager secrets

Create the secrets if they do not exist:

```bash
printf '%s' 'postgres://...' | gcloud secrets create kallo-prod-database-url \
  --data-file=-

printf '%s' 'your-gemini-api-key' | gcloud secrets create kallo-prod-gemini-api-key \
  --data-file=-

printf '%s' 'your-prod-service-role-key' | gcloud secrets create \
  kallo-prod-supabase-service-role-key --data-file=-

printf '%s' 'your-revenuecat-v2-customer-key' | gcloud secrets create \
  kallo-prod-revenuecat-customer-delete-api-key --data-file=-
printf '%s' 'your-revenuecat-v1-app-key' | gcloud secrets create \
  kallo-prod-revenuecat-rest-api-key --data-file=-
printf '%s' 'your-random-webhook-authorization-secret' | gcloud secrets create \
  kallo-prod-revenuecat-webhook-secret --data-file=-

# Outbound email. The Resend key is created in the Resend dashboard; the hook
# secret is generated by Supabase (Authentication → Hooks → Send Email) and
# must be stored verbatim, including its "v1,whsec_" prefix.
# Prefix these with a space (or `set +o history`) so the real secret value
# doesn't land in your shell history.
 printf '%s' 'your-resend-api-key' | gcloud secrets create \
  kallo-prod-resend-api-key --data-file=-
 printf '%s' 'v1,whsec_...' | gcloud secrets create \
  kallo-prod-send-email-hook-secret --data-file=-
```

If the secrets already exist, add a new version instead:

```bash
printf '%s' 'postgres://...' | gcloud secrets versions add \
  kallo-prod-database-url \
  --data-file=-

printf '%s' 'your-gemini-api-key' | gcloud secrets versions add \
  kallo-prod-gemini-api-key \
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
| `REVENUECAT_PROJECT_ID` | RevenueCat project ID used for customer erasure |
| `REVENUECAT_ALLOWED_APP_IDS` | Comma-separated production RevenueCat app IDs |
| `REVENUECAT_WEB_API_KEY` | Client-public RevenueCat Web SDK key (Paddle-backed checkout); blank until web billing is configured |
| `REVENUECAT_INFER_MISSING_EVENT_ENVIRONMENT` | Keep `false` until the production webhook is environment-filtered and verified |
| `BILLING_ENFORCEMENT_ENABLED` | Keep `false` through dark launch and sandbox validation |
| `BILLING_PURCHASES_ENABLED` | Keep `false` through dark launch; independent new-checkout kill-switch |
| `BILLING_SANDBOX_USER_IDS` | Dedicated App Review account UUIDs only; blank for normal production users |
| `SUBSCRIPTION_LAUNCH_DATE` | Valid ISO launch date; required before enforcement can be `true` |
| `TRIAL_DAYS` | Positive integer; defaults to `7` |
| `NEXT_PUBLIC_SUPABASE_URL` | Non-prod public Supabase URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Non-prod public Supabase anon key |
| `GCS_SEED_BUCKET` | Private preview seed artifact bucket |
| `GCS_SEED_OBJECT` | Object path of the seed artifact within the bucket |
| `GCS_STAGING_LEASE_BUCKET` | GCS bucket used for staging/lease.json atomic lock |

`GCP_WIF_PROVIDER` must be the full resource name:

```text
projects/<project-number>/locations/global/workloadIdentityPools/<pool-id>/providers/<provider-id>
```

No GitHub secret is required for Google auth in this deploy path. WIF handles
authentication, and runtime secrets stay in Secret Manager.

## 7. Public config rule

`NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are **build-time inputs** for the shared
CI image used by `nham-internal` and by previews while
`PREVIEW_DATABASE_MODE=shared`.

That means:

- changing them requires a new CI image build
- changing Cloud Run runtime env vars later will not fix stale client bundle
  config
- shared-mode previews and `nham-internal` both read the same public Supabase
  config from GitHub Actions variables
- if we later switch to `PREVIEW_DATABASE_MODE=branch`, preview images rebuild
  after branch env is fetched from Supabase, while `nham-internal` keeps using
  the shared GitHub Actions variables

### Preview runtime notes

| Mode | Public Supabase config | Server `DATABASE_URL` | Cleanup behavior |
| --- | --- | --- | --- |
| `shared` (current default) | Comes from `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` GitHub variables baked into the CI image | Secret Manager-backed `nham-nonprod-database-url` | PR close deletes only the preview Cloud Run service; DB recovery happens through **Reset Staging Database** |
| `branch` (future Supabase Pro path) | Comes from Supabase branch env fetched during the preview build | Injected with `--update-env-vars=DATABASE_URL=...` for that PR branch | PR close and scheduled cleanup delete both the preview Cloud Run service and the Supabase branch |

## 8. Cloud Run defaults used by the workflows

### Production service: `kallo-prod`

- CPU: `1`
- Memory: `2Gi`
- Concurrency: `80`
- Timeout: `60`
- Min instances: `0`
- Max instances: `20`
- Public ingress, sealed by the Cloudflare origin lock
- Secret-backed runtime env:
  - `DATABASE_URL`
  - `GEMINI_API_KEY`
  - `ANALYSIS_GUARD_HASH_SECRET`
  - `ORIGIN_SHARED_SECRET`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `REVENUECAT_CUSTOMER_DELETE_API_KEY`
  - `REVENUECAT_REST_API_KEY`
  - `REVENUECAT_WEBHOOK_SECRET`
- Plain runtime env includes the production billing boundary, RevenueCat app
  allowlist/project/public web key, and the explicit dark-launch controls.

### Preview services: `nham-pr-<number>` (disabled by default)

- CPU: `1`
- Memory: `1Gi`
- Concurrency: `20`
- Timeout: `60`
- Min instances: `0`
- Max instances: `3`
- Public URL enabled
- `DATABASE_URL` source depends on `PREVIEW_DATABASE_MODE`:
  - shared mode uses Secret Manager-backed `nham-nonprod-database-url`
  - branch mode injects the per-branch URL with `--update-env-vars`
- `GEMINI_API_KEY` stays Secret Manager-backed in both modes
- Preview services are retired. If a temporary QA lane is designed later, it
  must not inherit production Auth-admin or provider-erasure credentials.

### Vertex AI provider

The production service calls Gemini through **Vertex AI** via Application
Default Credentials. Local dev and the helper scripts in
`scripts/` continue to use the Google AI Studio API key from `GEMINI_API_KEY`.

The selection is controlled by `AI_PROVIDER` in `lib/ai/provider/client.ts:resolveGeminiProvider`:

| `AI_PROVIDER` | Auth | Required env |
| --- | --- | --- |
| unset or `ai-studio` | API key | `GEMINI_API_KEY` |
| `vertex` | ADC (service account on Cloud Run) | `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` |

Prerequisites the Cloud Run service account needs **before** flipping
`AI_PROVIDER=vertex`:

1. Vertex AI API enabled on the project: `gcloud services enable aiplatform.googleapis.com`.
2. `roles/aiplatform.user` granted to the runtime service account (see
   "Runtime service account" above).
3. `GOOGLE_CLOUD_LOCATION=global`. `gemini-3.1-flash-lite` is currently only
   published on the `global` endpoint, so no regional endpoint would serve it
   whatever region we picked. Using `global` also avoids per-region
   model-availability skew across our STABLE models (`gemini-3.1-flash-lite`,
   `gemini-2.5-flash-lite`, `gemini-embedding-001`). For the record, Cloud Run
   itself runs **prod in `asia-southeast1` (Singapore)**, co-located with the
   Supabase database, while internal and staging run in `asia-southeast3`
   (Bangkok, Thailand) — see `docs/PROD_DOMAIN_SETUP.md`.

Rollback is a single env-var flip: set `AI_PROVIDER=ai-studio` on the Cloud Run
service and redeploy (or `gcloud run services update --update-env-vars`). The
`GEMINI_API_KEY` secret is intentionally retained in `--set-secrets` so this
fallback works without re-issuing the secret.

## 9. Workflow map

| Workflow | Purpose |
| --- | --- |
| `CI` | Validate repo, then build and push SHA-tagged image |
| `Cloud Run Preview` | Disabled automatic preview deploy path retained for future/manual recovery work |
| `Cloud Run Internal` | Deploy `main` to `nham-internal`, with smoke-triggered rollback |
| `Cloud Run Preview Cleanup` | Delete legacy preview Cloud Run services on PR close, remove matching Supabase branches, and clean up orphan previews nightly |
| `Cloud Run Staging` | Manual shared-staging promotion with lease protection, migrations, smoke check, and PR comment updates |
| `Cloud Run Ops` | Manual internal ops plus legacy preview refresh operations |

## 10. Manual operations

The `Cloud Run Ops` workflow supports:

- `redeploy-internal`
- `rollback-internal`
- `refresh-preview` (legacy/manual preview recovery only while auto-previews stay disabled)

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
   - no automatic preview deploy runs after CI succeeds
2. Manually run `Cloud Run Staging` for that PR and confirm:
   - the workflow acquires the staging lease
   - migrations apply against the shared non-prod DB
   - the PR gets a staging comment when `ref` is `pr-<number>` or ends with `#<number>`
   - `https://<staging-url>/api/healthz` returns the expected health JSON
3. Merge a known-good change to `main` and confirm:
   - `Cloud Run Internal` deploys `nham-internal`
   - smoke checks pass without rollback
4. Run a controlled rollback drill in a non-production window:
   - force smoke verification to fail once
   - confirm traffic returns to the previously serving revision
5. Run `Cloud Run Ops` once with a known digest:
   - redeploy internal by digest
   - confirm deployment-record artifacts are uploaded
6. If you still have legacy preview services to clean up, close the PR or run the cleanup workflow and confirm:
   - `Cloud Run Preview Cleanup` deletes `nham-pr-<number>` and the matching Supabase branch
   - the old preview URL no longer serves the app

## 12. Known boundaries of the current setup

- Automatic PR previews are disabled; shared staging is the only supported
  pre-merge deployment lane.
- Legacy preview services and cleanup workflows still exist for compatibility,
  recovery, and eventual re-enablement work.
- Previews and internal share one non-production Supabase backend for now.
- This setup is intentionally open on the default Cloud Run URL; application auth
  is still the access gate.
- Normal preview and internal deploy workflows do not run destructive database
  reset commands.
- The manual **Reset Staging Database** workflow is the exception: it verifies
  `SUPABASE_PROJECT_ID` matches the database behind
  `nham-nonprod-database-url`, then runs `supabase db reset --linked --yes`,
  reapplies `seed_food.sql`, and replays the `public.user_profiles` backfill so
  existing `auth.users` rows are restored safely.
- A later production environment with different `NEXT_PUBLIC_*` values will need
  a separate image build or a different client-config bootstrap strategy.
