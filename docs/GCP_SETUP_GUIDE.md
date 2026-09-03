# Google Cloud Run Setup Guide (`kallo-prod`)

This guide details the step-by-step setup for deploying the `kallo-prod` service to Google Cloud Run via GitHub Actions OIDC (Workload Identity Federation).

## 1. Environment & Prerequisites

Set these variables in your shell before executing setup commands:

```bash
export GCP_PROJECT_ID="your-gcp-project-id"
export GCP_PROJECT_NUMBER="your-gcp-project-number"
export GCP_REGION="asia-southeast1" # Production service location (co-located with Supabase DB)
export GCP_CI_REGION="asia-southeast3" # Region for Artifact Registry (if different)
export GCP_ARTIFACT_REPO="nham"
export GCP_WIF_POOL_ID="github-actions"
export GCP_WIF_PROVIDER_ID="github"
export GCP_DEPLOYER_SA_ID="github-deployer"
export GCP_RUNTIME_SA_ID="cloud-run-runtime"
export GITHUB_REPOSITORY="VoMinhKhoii/Nham"
export GCS_PROD_LEASE_BUCKET="kallo-prod-leases"
```

## 2. Enable GCP APIs

```bash
gcloud services enable \
  aiplatform.googleapis.com \
  artifactregistry.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com
```

## 3. Create Artifact Registry & Lease Bucket

```bash
# Artifact Registry for Docker images
gcloud artifacts repositories create "$GCP_ARTIFACT_REPO" \
  --repository-format=docker \
  --location="$GCP_CI_REGION" \
  --description="Kallo Cloud Run images"

# GCS Bucket for deployment lease serialization
gcloud storage buckets create "gs://$GCS_PROD_LEASE_BUCKET" \
  --project="$GCP_PROJECT_ID" \
  --location="$GCP_REGION" \
  --uniform-bucket-level-access
```

## 4. Service Accounts & IAM Setup

```bash
# Create Service Accounts
gcloud iam service-accounts create "$GCP_DEPLOYER_SA_ID" --display-name="GitHub Actions deployer"
gcloud iam service-accounts create "$GCP_RUNTIME_SA_ID" --display-name="Cloud Run runtime"

export GCP_DEPLOYER_SERVICE_ACCOUNT="$GCP_DEPLOYER_SA_ID@$GCP_PROJECT_ID.iam.gserviceaccount.com"
export GCP_RUNTIME_SERVICE_ACCOUNT="$GCP_RUNTIME_SA_ID@$GCP_PROJECT_ID.iam.gserviceaccount.com"

# Grant Lease Bucket Permissions to Deployer
gcloud storage buckets add-iam-policy-binding "gs://$GCS_PROD_LEASE_BUCKET" \
  --member="serviceAccount:$GCP_DEPLOYER_SERVICE_ACCOUNT" \
  --role="roles/storage.objectAdmin"

# Deployer IAM Roles
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" --member="serviceAccount:$GCP_DEPLOYER_SERVICE_ACCOUNT" --role="roles/run.admin"
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" --member="serviceAccount:$GCP_DEPLOYER_SERVICE_ACCOUNT" --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" --member="serviceAccount:$GCP_DEPLOYER_SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" --member="serviceAccount:$GCP_DEPLOYER_SERVICE_ACCOUNT" --role="roles/aiplatform.user"
gcloud iam service-accounts add-iam-policy-binding "$GCP_RUNTIME_SERVICE_ACCOUNT" --member="serviceAccount:$GCP_DEPLOYER_SERVICE_ACCOUNT" --role="roles/iam.serviceAccountUser"

# Runtime IAM Roles
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" --member="serviceAccount:$GCP_RUNTIME_SERVICE_ACCOUNT" --role="roles/secretmanager.secretAccessor"
gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" --member="serviceAccount:$GCP_RUNTIME_SERVICE_ACCOUNT" --role="roles/aiplatform.user"
```

## 5. Secret Manager Configuration

All secrets required by `cloud-run-prod.yml` must exist prior to deploy:

```bash
printf '%s' 'postgres://...' | gcloud secrets create kallo-prod-database-url --data-file=-
printf '%s' 'your-gemini-api-key' | gcloud secrets create kallo-prod-gemini-api-key --data-file=-
printf '%s' 'your-guard-hash-secret' | gcloud secrets create kallo-prod-analysis-guard-hash-secret --data-file=-
printf '%s' 'your-origin-shared-secret' | gcloud secrets create kallo-prod-origin-shared-secret --data-file=-
printf '%s' 'your-service-role-key' | gcloud secrets create kallo-prod-supabase-service-role-key --data-file=-
printf '%s' 'your-rc-customer-delete-key' | gcloud secrets create kallo-prod-revenuecat-customer-delete-api-key --data-file=-
printf '%s' 'your-rc-rest-api-key' | gcloud secrets create kallo-prod-revenuecat-rest-api-key --data-file=-
printf '%s' 'your-rc-webhook-secret' | gcloud secrets create kallo-prod-revenuecat-webhook-secret --data-file=-
printf '%s' 'your-resend-api-key' | gcloud secrets create kallo-prod-resend-api-key --data-file=-
printf '%s' 'v1,whsec_...' | gcloud secrets create kallo-prod-send-email-hook-secret --data-file=-
printf '%s' 'your-usda-api-key' | gcloud secrets create kallo-prod-usda-api-key --data-file=-
```

## 6. Workload Identity Federation (WIF)

```bash
# Create Workload Identity Pool
gcloud iam workload-identity-pools create "$GCP_WIF_POOL_ID" \
  --project="$GCP_PROJECT_ID" \
  --location="global" \
  --display-name="GitHub Actions"

# Create GitHub OIDC Provider
gcloud iam workload-identity-pools providers create-oidc "$GCP_WIF_PROVIDER_ID" \
  --project="$GCP_PROJECT_ID" \
  --location="global" \
  --workload-identity-pool="$GCP_WIF_POOL_ID" \
  --display-name="GitHub" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref" \
  --attribute-condition="attribute.repository == '$GITHUB_REPOSITORY'"

# Bind Deployer SA to GitHub Repository
gcloud iam service-accounts add-iam-policy-binding "$GCP_DEPLOYER_SERVICE_ACCOUNT" \
  --project="$GCP_PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$GCP_PROJECT_NUMBER/locations/global/workloadIdentityPools/$GCP_WIF_POOL_ID/attribute.repository/$GITHUB_REPOSITORY"
```

## 7. GitHub Environment & Settings

### GitHub Secrets (`production` Environment)
- `KALLO_PROD_PROJECT_ID`: Production Supabase Project Ref (used for DB target assertions).

### GitHub Variables
- `GCP_PROJECT_ID`: GCP Project ID
- `GCP_PROJECT_NUMBER`: GCP Project Number
- `GCP_REGION`: Region for Artifact Registry (e.g. `asia-southeast3`)
- `GCP_ARTIFACT_REPO`: `nham`
- `GCP_WIF_PROVIDER`: `projects/<project-number>/locations/global/workloadIdentityPools/github-actions/providers/github`
- `GCP_DEPLOYER_SERVICE_ACCOUNT`: `github-deployer@<project-id>.iam.gserviceaccount.com`
- `GCP_RUNTIME_SERVICE_ACCOUNT`: `cloud-run-runtime@<project-id>.iam.gserviceaccount.com`
- `GCS_PROD_LEASE_BUCKET`: `kallo-prod-leases`
- `BILLING_ENFORCEMENT_ENABLED`: `false` (or `true`)
- `BILLING_PURCHASES_ENABLED`: `false` (or `true`)
- `BILLING_SANDBOX_USER_IDS`: Comma-separated user IDs
- `SUBSCRIPTION_LAUNCH_DATE`: ISO launch date string
- `TRIAL_DAYS`: `7`
- `REVENUECAT_PROJECT_ID`: RevenueCat Project ID
- `REVENUECAT_ALLOWED_APP_IDS`: Allowed app bundle IDs
- `REVENUECAT_WEB_API_KEY`: Client-public web key
- `REVENUECAT_WEB_API_KEY_SANDBOX`: Sandbox web key
- `REVENUECAT_INFER_MISSING_EVENT_ENVIRONMENT`: `false`
- `GOOGLE_WEB_CLIENT_ID`: Google Web Client ID for OAuth

## 8. Alignment Check with Production Setup

| Component | Workflow Spec (`cloud-run-prod.yml`) | Setup Guide | Verification |
| --- | --- | --- | --- |
| **Service Name** | `kallo-prod` | `kallo-prod` | MATCH |
| **Service Region** | `asia-southeast1` (Singapore) | `asia-southeast1` | MATCH |
| **Resource Limits** | 1 vCPU, 2Gi RAM, 80 Concurrency | 1 vCPU, 2Gi RAM, 80 Concurrency | MATCH |
| **Auth Mechanics** | Workload Identity Federation (OIDC) | WIF setup steps included | MATCH |
| **AI Engine** | `AI_PROVIDER=vertex`, `GOOGLE_CLOUD_LOCATION=global` | Vertex AI permissions & location | MATCH |
| **Secrets Count** | 11 Secret Manager items (`kallo-prod-*`) | All 11 secrets detailed | MATCH |
| **Lease Locking** | GCS Bucket object lock (`GCS_PROD_LEASE_BUCKET`) | Bucket creation & role binding | MATCH |
