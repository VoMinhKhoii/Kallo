import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readWorkflow(name: string): string {
  return readFileSync(resolve('.github/workflows', name), 'utf8');
}

describe('Cloud Run prod workflow', () => {
  it('auto-triggers from a successful CI run on the main branch', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');

    // workflow_run is preferred over push so the container image CI publishes
    // is guaranteed to exist by the time prod tries to deploy it, and so a
    // failing CI on main blocks the deploy.
    expect(workflow).toContain('workflow_run:');
    expect(workflow).toContain(`workflows: ['CI']`);
    expect(workflow).toContain(
      `github.event.workflow_run.conclusion == 'success'`
    );
    expect(workflow).toContain(
      `github.event.workflow_run.head_branch == 'main'`
    );
  });

  it('applies pending migrations on the deploy, then verifies them', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');

    // Migrations are applied on the prod deploy itself, then re-asserted so a
    // partial push fails the deploy.
    expect(workflow).toContain(
      'run: yes | supabase db push --db-url "$PROD_DATABASE_URL_ENCODED"'
    );
    expect(workflow).toContain(
      'node ./scripts/cloud-run/shared-db.mjs assert-migrations-applied --db-url "$PROD_DATABASE_URL" --migrations-dir ./supabase/migrations'
    );
  });

  it('delegates embedding completion verification to the backfill script', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');
    const backfill = readFileSync(
      resolve('scripts/db/backfill_embeddings.ts'),
      'utf8'
    );

    expect(workflow).not.toContain('Verify curated broth embeddings');
    expect(workflow).not.toContain('usda_6008_raw');
    expect(workflow).toContain('bun scripts/db/backfill_embeddings.ts');
    expect(backfill).toContain('countMissingEmbeddings');
    expect(backfill).toContain('Embedding backfill incomplete');
  });

  it('runs the embedding backfill on Vertex, not a free-tier API key', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');
    const backfill = readFileSync(
      resolve('scripts/db/backfill_embeddings.ts'),
      'utf8'
    );

    // The deploy must embed with the same provider the service it ships runs
    // on. Exporting a GEMINI_API_KEY here would silently bill an abandoned
    // AI Studio free-tier key and reinstate the 35s-per-batch pacing.
    expect(workflow).not.toContain('export GEMINI_API_KEY=');
    expect(workflow).toContain('AI_PROVIDER: vertex');
    expect(workflow).toContain(
      `GOOGLE_CLOUD_PROJECT: \${{ vars.GCP_PROJECT_ID }}`
    );
    expect(workflow).toContain('GOOGLE_CLOUD_LOCATION: global');
    expect(backfill).toContain('vertexai: true');
    expect(backfill).toContain(
      'AI_PROVIDER=vertex requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION'
    );
    // The AI Studio path stays intact for local `dbr:reset` against .env.local.
    expect(backfill).toContain('apiKey: process.env.GEMINI_API_KEY');
  });

  it('scopes the deploy-time append-only check to pending migrations only', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');

    // A deploy job has no git baseline, so the check is scoped to the
    // not-yet-applied migrations rather than re-scanning all of history.
    expect(workflow).toContain(
      'list-pending --db-url "$PROD_DATABASE_URL" --migrations-dir ./supabase/migrations'
    );
    expect(workflow).toContain(
      'node ./scripts/ci/check-append-only-migrations.mjs'
    );
  });

  it('wires billing secrets and dark-launch controls into prod', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');

    for (const secret of [
      'kallo-prod-supabase-service-role-key',
      'kallo-prod-revenuecat-customer-delete-api-key',
      'kallo-prod-revenuecat-rest-api-key',
      'kallo-prod-revenuecat-webhook-secret',
    ]) {
      expect(workflow).toContain(secret);
    }
    expect(workflow).toContain('BILLING_ENVIRONMENT=production');
    expect(workflow).toContain(
      `BILLING_ENFORCEMENT_ENABLED: \${{ vars.BILLING_ENFORCEMENT_ENABLED || 'false' }}`
    );
    expect(workflow).toContain(`TRIAL_DAYS: \${{ vars.TRIAL_DAYS || '7' }}`);
    expect(workflow).toContain('SUBSCRIPTION_LAUNCH_DATE');
  });

  it('does not resurrect retired non-production deploy workflows', () => {
    for (const name of [
      'cloud-run-internal.yml',
      'cloud-run-preview.yml',
      'cloud-run-staging.yml',
    ]) {
      expect(existsSync(resolve('.github/workflows', name))).toBe(false);
    }
  });
});

describe('CI workflow', () => {
  it('runs on pushes and PRs targeting both main and staging', () => {
    const workflow = readWorkflow('ci.yml');

    expect(workflow).toContain('branches: [main, staging]');
  });
});
