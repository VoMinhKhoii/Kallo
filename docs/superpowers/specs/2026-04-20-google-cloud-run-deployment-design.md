# Google Cloud Run Deployment Platform Design

**Date:** 2026-04-20
**Status:** Approved
**Scope:** Deploy the existing Next.js app to Google Cloud Run with one shared internal environment on `main`, ephemeral PR preview environments, production-grade CI/CD guardrails, and a clean upgrade path to later staging/production separation.

---

## 1. Problem

The repo has strong local development and CI foundations, but it does not yet have
a production-grade deployment path on Google Cloud. The current state is:

- the app is a standard Next.js App Router application running on the Node runtime
- CI already covers lint, typecheck, tests, build, and migration validation
- runtime configuration is environment-variable driven
- there is no Dockerfile, Artifact Registry flow, Cloud Run service definition, or
  Google Cloud deployment workflow

The goal is to make the app continuously deployable and easy to dogfood internally
without waiting until the codebase is much larger. That deployment system should
improve confidence, not create extra operational drag for the team.

## 2. Repo Findings That Shape the Design

### 2.1 Runtime and framework fit

- `package.json` uses `next build` and `next start`; no custom Node server exists.
- `app/api/analyze-meal/route.ts` explicitly opts into `runtime = 'nodejs'`.
- The app exposes server-side routes and authenticated app pages, so it needs a
  full server runtime rather than static hosting.
- The same route streams SSE responses, which Cloud Run can serve behind normal
  HTTP request handling.

### 2.2 Runtime configuration already exists

The deployed app needs at least these values:

| Category | Variables |
|---|---|
| Public runtime config | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Sensitive server config | `DATABASE_URL`, `GEMINI_API_KEY`, `USDA_API_KEY` |

`USDA_API_KEY` was script-only until the barcode lookup chain began querying
USDA FoodData Central at runtime. It is optional at the *application* layer: a
deploy that omits it keeps resolving barcodes through Open Food Facts alone, so
a missed rollout degrades coverage rather than causing an outage.

It is **not** optional at the *deploy* layer. `cloud-run-prod.yml` wires it in
through `--set-secrets=…,USDA_API_KEY=kallo-prod-usda-api-key:latest`, and
`gcloud run deploy` fails the entire deploy when any referenced Secret Manager
secret is missing — a partial rollout bricks the release instead of degrading
it. Ordering is therefore a hard constraint: `kallo-prod-usda-api-key` must be
created in Secret Manager (and made readable by the runtime service account) as
a manual step **before** the workflow change merges, not after.

Additional script-only variables such as `GOOGLE_TRANSLATE_API_KEY` are not part
of the app runtime contract and should not be bundled into the normal app deploy
path unless a later workflow explicitly needs them.

### 2.3 Existing CI can be reused

The existing `.github/workflows/ci.yml` already enforces:

1. Biome linting
2. Type checking
3. Vitest unit tests
4. Production build
5. Supabase migration validation

Deployment should build on top of this rather than replacing it.

## 3. Goals and Non-Goals

### 3.1 Goals

This design must deliver:

1. one long-lived internal Cloud Run service for the `main` branch
2. one ephemeral preview Cloud Run service per pull request
3. automatic deploys from GitHub Actions with no long-lived Google credentials
4. deterministic builds with immutable container images
5. easy rollback and low-stress recovery workflows
6. secret handling appropriate for a production-grade team workflow
7. a clean path to future staging and production environments

### 3.2 Non-Goals for the first pass

This design does **not** include:

- a separate production Cloud Run service yet
- per-preview isolated databases or Supabase projects
- custom domains
- Google-side end-user access restrictions such as IAP or Workspace-only gating
- full Terraform ownership of the entire platform
- automatic destructive database reset or backfill scripts in deployment workflows

Those are intentionally deferred, but nothing in this design should block them.

## 4. Recommended Deployment Architecture

### 4.1 Decision

Use a **container-first Cloud Run platform**:

- build a Docker image from this repo
- push the image to Artifact Registry
- deploy the image to Cloud Run via GitHub Actions
- run one shared internal service for `main`
- run one ephemeral preview service per PR

### 4.2 Why this approach

This is the best fit for the repo because it preserves the exact artifact that was
tested in CI and gives a reliable foundation for later promotion flows. Compared
with Cloud Run source deployments, it is more explicit, easier to audit, and more
aligned with future production promotion by image digest.

### 4.3 Service model

| Service type | Naming pattern | Lifecycle | Traffic purpose |
|---|---|---|---|
| Shared internal app | `nham-internal` | Long-lived | Latest approved code from `main` |
| PR preview app | `nham-pr-<number>` | Ephemeral | Feature review before merge |

Each service is a full Cloud Run service. The preview model is intentionally not
"one service with many revisions" because the team needs stable, PR-specific URLs
that are easy to reason about and easy to clean up.

### 4.4 Access model

- Cloud Run services are publicly reachable via the default Cloud Run URL.
- The application itself continues to enforce user access through Supabase auth.
- This matches the current product behavior and keeps internal tester onboarding
  simple while still allowing Google-side controls to be added later.

## 5. Container Strategy

### 5.1 Next.js packaging

`next.config.ts` should opt into `output: 'standalone'`.

The container build should:

1. install dependencies with Bun
2. run the production build
3. package the minimal `.next/standalone` server
4. copy `public/` and `.next/static/` into the standalone output
5. run the generated standalone server in the final image

This keeps the runtime image focused and avoids shipping the full development
workspace into production.

### 5.2 Runtime contract

The container must:

- listen on the Cloud Run-provided `PORT`
- run as a stateless web process
- read environment variables at runtime rather than baking environment-specific
  secrets into the image

That allows the same built image to be reused across internal, preview, and later
production-style environments.

### 5.3 Build-time vs runtime config boundary

This repo currently uses `NEXT_PUBLIC_*` variables for Supabase client bootstrap.
For Next.js, those values are effectively part of the client bundle contract and
should be treated as **build-time configuration**, not as freely swappable runtime
secrets.

That means the first-pass deployment model is:

- one image build is reused across the shared internal service and all PR previews
  because they intentionally point at the same non-production public Supabase
  values
- server-only secrets remain runtime-injected through Cloud Run and Secret Manager
- when a later production environment needs different `NEXT_PUBLIC_*` values, that
  future design must either build a production-specific image or introduce a
  different runtime bootstrap pattern explicitly

The current design does **not** promise that a single image can span environments
with different public client configuration.

## 6. Google Cloud Resource Model

### 6.1 Required GCP resources

The first-pass platform uses:

| Resource | Purpose |
|---|---|
| Artifact Registry repository | Stores immutable application images |
| Cloud Run services | Hosts the shared internal app and PR previews |
| Secret Manager secrets | Stores sensitive runtime secrets |
| Workload Identity Pool + Provider | Lets GitHub Actions authenticate without a JSON key |
| Deployer service account | Used by GitHub Actions to deploy |
| Runtime service account | Used by the running app revisions |

### 6.2 Identity boundaries

Two service accounts are required:

1. **Deployer service account**
   - impersonated by GitHub Actions through Workload Identity Federation
   - needs the minimum roles required to push images and deploy services
2. **Runtime service account**
   - attached to Cloud Run services
   - needs only the permissions required by the app at runtime, such as reading
     Secret Manager values if that access pattern is used

Deployment and runtime identities must stay separate so a compromise in one path
does not automatically become full platform compromise.

## 7. Configuration and Secret Model

### 7.1 Public configuration

These values are public, but for this repo they should be treated as build-time
inputs to the client bundle:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

They are not secrets, but they still need to be managed explicitly per non-production
build. For the first pass, preview services and the shared internal service reuse the
same values because they target the same non-production Supabase backend.

### 7.2 Sensitive configuration

These values must come from Secret Manager-backed configuration:

- `DATABASE_URL`
- `GEMINI_API_KEY`

The deployment workflow should reference named secrets, not embed literal secret
values in repository files or workflow YAML.

### 7.3 Environment separation

For the first pass:

- the shared internal service and all PR previews use the same non-production
  Supabase backend
- configuration names should still be scoped clearly enough that later splitting
  them into `internal`, `preview`, and `production` variants does not require a
  workflow redesign

The design does not assume isolated preview data yet, but it does preserve the
configuration seam needed to add it later. The same is true for public client
configuration: the first pass shares one non-production value set, while later
environment-specific public values will require an explicit build/runtime strategy.

## 8. CI/CD Design

### 8.1 High-level rule

CI remains the merge gate. Deployment is a separate concern layered on top of it.
No deploy job should run unless the existing validation jobs succeeded first.

### 8.2 Workflow paths

#### Pull request deploy path

On PR open, synchronize, or reopen for a branch in this repository:

1. run CI prerequisites or depend on successful CI status
2. build the application image
3. push the image to Artifact Registry
4. deploy or update `nham-pr-<number>`
5. run post-deploy smoke checks against that preview URL
6. comment or update the PR with the preview URL, commit SHA, and deploy status

On PR close or merge:

1. delete the matching preview service
2. clean up any preview-specific metadata or comments if desired

Forked pull requests are a separate trust boundary. Because preview deployment
needs cloud credentials and deploy permissions, the first-pass design should **not**
automatically deploy previews for forked PRs. Forked PRs continue to get normal CI,
and maintainers can later add a separate reviewed/manual preview path if needed.

#### Main branch deploy path

On push to `main`:

1. wait for successful CI
2. build the application image once
3. push it to Artifact Registry
4. deploy the image to `nham-internal`
5. run post-deploy smoke checks
6. if smoke checks fail, automatically roll back to the previous healthy revision

#### Recovery paths

The platform also needs explicit manual workflows for:

- redeploying the shared internal service from a known image
- rolling back the shared internal service to a prior revision or image
- forcing refresh of a PR preview service

These should be easy button workflows so the team does not have to invent a
recovery plan during an incident.

### 8.3 Artifact discipline

Deployments should be image-centric:

- build once per commit
- tag images with the commit SHA as the primary identifier
- record the resolved image digest
- deploy by the exact built artifact

This avoids rebuild drift and makes future promotion to separate environments much
safer.

Services and revisions should also carry enough labels or annotations to connect a
deploy back to:

- commit SHA
- PR number for preview services
- GitHub Actions run identifier
- deployment target (`preview` or `internal`)

## 9. Preview Environment Design

### 9.1 What a preview provides

Every pull request gets a live Cloud Run URL before merge so the team can:

- dogfood the feature end-to-end
- validate auth flows and route behavior in a real deployment
- review UX and integration behavior beyond what CI alone can prove

### 9.2 Data model

All previews point to the same shared non-production backend for now.

That is a deliberate trade-off:

- **Pros:** much simpler setup, lower cost, faster rollout
- **Cons:** previews are not data-isolated from each other

Because of that trade-off, the deployment design must keep preview services easy to
create and delete, while leaving database isolation as a future enhancement rather
than pretending it already exists.

### 9.3 Cleanup model

Preview services must be:

- updated on every new commit to the PR
- deleted automatically when the PR closes
- additionally covered by a scheduled cleanup workflow to catch orphaned services

Cleanup must be idempotent so repeated delete attempts do not fail the workflow.

## 10. Runtime Service Settings

### 10.1 Shared internal service defaults

The shared internal service should start with:

- public ingress
- request timeout sized for normal SSR/API behavior and the current SSE route
- moderate concurrency suitable for a Next.js server workload
- optional low minimum instance count if cold starts become annoying for dogfooding

Here, "internal" means **internal-use by the team**, not ingress-restricted at the
Cloud Run layer. The service is still public on the network and protected by the
app's own auth model.

The design intentionally does not hardcode numeric scaling values into the spec
because those should be tuned from observed traffic and cost after the first live
deploy. The implementation plan should include where those values are configured.

### 10.2 PR preview defaults

Preview services should prioritize cost efficiency:

- minimum instances at zero
- no attempt to keep previews warm
- same app behavior, lower always-on spend

### 10.3 Logging and metadata

Deployments should label or annotate services and revisions with enough metadata to
connect:

- commit SHA
- PR number for previews
- deployment target
- image digest

This makes Cloud Run revisions and GitHub Actions runs easy to correlate.

## 11. Safety and Failure-Handling Workflows

### 11.1 Pre-deploy validation

Before deployment, the workflow should verify that:

- the target Artifact Registry repository is reachable
- the target Cloud Run service name is valid for the workflow path
- required secrets and environment variables exist
- required service accounts are configured

This catches platform misconfiguration before a broken revision is created.

### 11.2 Post-deploy smoke checks

After each deploy:

- PR previews run smoke checks and report failure back to the PR
- `main` deploys run smoke checks against `nham-internal`

Smoke verification must use concrete, deterministic checks rather than "site seems
up" heuristics. The first-pass design should use:

1. a dedicated unauthenticated health endpoint such as `/api/healthz` that returns
   `200` and a small JSON payload confirming the app booted successfully
2. a basic page check against a public localized landing route such as `/en` to
   confirm the deployed web surface responds successfully

If the shared internal service fails post-deploy smoke verification, the workflow
should trigger an automatic rollback to the last known good revision or image.

For rollback purposes, "last known good" means the most recent deployed revision or
image for `nham-internal` whose post-deploy smoke checks completed successfully.

### 11.3 Failure isolation

- A failed preview deploy must not affect the shared internal service.
- A failed preview cleanup must not block the rest of the repository workflow.
- A failed `main` deploy must leave the previous healthy revision recoverable.

### 11.4 Auditability

Each deploy workflow should emit a concise deployment record containing:

- commit SHA
- image digest
- target service
- resulting Cloud Run revision
- preview URL or internal URL
- smoke-check result

This turns deploy investigations into simple lookup work instead of timeline
reconstruction.

## 11.5 Preview cleanup contract

An "orphaned" preview service is any Cloud Run service whose name matches
`nham-pr-<number>` where `<number>` is not an open pull request in the repository.

The scheduled cleanup workflow should therefore:

1. list open pull request numbers via the GitHub API
2. list Cloud Run services matching the preview naming pattern
3. delete any preview service whose PR number is not in the open PR set

This keeps cleanup deterministic and safe.

## 12. Database and Migration Policy

Application deployment must stay separate from risky database operations.

### 12.1 Allowed in normal deploy workflows

- application image build and deploy
- non-destructive runtime configuration updates
- smoke verification

### 12.2 Not allowed in normal deploy workflows

- `bun dbr:reset`
- destructive reset/backfill flows
- hidden coupling between app deploy and manual data repair scripts

Schema migration automation can be added later, but the first-pass design should
keep deploys predictable and reversible instead of bundling app rollout with shared
data mutation.

## 13. Expected Repo Surfaces for the Implementation Plan

The eventual implementation plan will likely need to touch:

| File or area | Purpose |
|---|---|
| `next.config.ts` | Enable standalone output |
| `Dockerfile` | Build the deployable image |
| `.dockerignore` | Keep build context small and safe |
| `.github/workflows/` | Add deploy, preview, rollback, and cleanup workflows |
| deployment documentation | Document required GCP setup and secret naming |

The design deliberately stops at the boundary of *what must exist* and *how it
should behave*, not the step-by-step implementation plan.

## 14. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| GitHub holds overly powerful Google credentials | Use Workload Identity Federation instead of service account keys |
| A bad merge instantly breaks the shared internal environment | Require CI first, run smoke checks after deploy, auto-rollback on failure |
| Preview services become cluttered and expensive | Delete on PR close and run scheduled stale-preview cleanup |
| Shared preview backend causes cross-PR data interference | Accept this explicitly for now and preserve config seams for later isolation |
| Runtime revisions drift from tested code | Build immutable images and deploy the exact built artifact |
| Recovery requires tribal knowledge | Add explicit rollback and redeploy workflows from day one |

## 15. Acceptance Criteria

This design is successful when:

1. the repo can produce a Cloud Run-compatible container image of the Next.js app
2. GitHub Actions can deploy the app to a shared internal Cloud Run service without
   storing long-lived Google credentials in GitHub
3. each pull request can receive a live preview URL before merge
4. preview services are removed automatically when the PR closes
5. failed `main` deployments can be detected by smoke checks and rolled back
   without manual reconstruction
6. runtime secrets are sourced from Secret Manager rather than committed files or
   long-lived GitHub secrets
7. the deployment model can grow into separate staging/production services later
   without discarding the core CI/CD design
