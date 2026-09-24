import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readWorkflow(name: string): string {
  return readFileSync(resolve('.github/workflows', name), 'utf8');
}

describe('Cloud Run prod workflow', () => {
  it('deploys only via manual dispatch, scoped to main', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');

    // Prod deploys are a deliberate human action: merging to main must never
    // auto-ship. The dispatch takes an optional sha (a green-CI commit whose
    // image exists) and the job refuses non-main refs.
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('workflow_run:');
    expect(workflow).toContain(`if: github.ref == 'refs/heads/main'`);
    expect(workflow).toContain(
      `DEPLOY_SHA: \${{ inputs.sha != '' && inputs.sha || github.sha }}`
    );
    expect(workflow).not.toContain('github.event.workflow_run');
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
    expect(workflow).toContain(`TRIAL_DAYS: \${{ vars.TRIAL_DAYS || '0' }}`);
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

  it('pushes images only from main, while PRs still build them', () => {
    const workflow = readWorkflow('ci.yml');
    const job = workflow.slice(workflow.indexOf('  container-publish:'));

    // cloud-run-prod.yml deploys only main SHAs; every other pushed image is
    // pure Artifact Registry storage cost. PRs must keep building the image so
    // a broken Dockerfile fails before merge.
    expect(job).toContain(
      `PUBLISH: \${{ github.event_name == 'push' && github.ref == 'refs/heads/main' }}`
    );
    expect(job).toMatch(
      /- name: Push container image\n\s+if: env\.PUBLISH == 'true'\n/
    );
    expect(job).toMatch(/- name: Build container image\n\s+env:/);
  });
});

describe('Artifact Registry retention', () => {
  it('tags the deployed image prod-<sha> before migrating', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');
    const tagAt = workflow.indexOf(
      `gcloud artifacts docker tags add "$IMAGE_TAG" "\${IMAGE_TAG%:*}:prod-\${DEPLOY_SHA}"`
    );

    // The cleanup policy deletes images older than 14 days unless they carry
    // a prod- tag, so the tag must land before anything that can fail.
    expect(tagAt).toBeGreaterThan(-1);
    expect(tagAt).toBeLessThan(
      workflow.indexOf('- name: Apply pending migrations to prod DB')
    );
  });

  it('keeps recent prod releases and pins, and never deletes young images', () => {
    const policy = JSON.parse(
      readFileSync(
        resolve('scripts/cloud-run/artifact-cleanup-policy.json'),
        'utf8'
      )
    ) as Array<{
      action: { type: string };
      condition?: {
        tagState?: string;
        tagPrefixes?: string[];
        olderThan?: string;
      };
    }>;
    const keepPrefixes = policy
      .filter((rule) => rule.action.type === 'Keep')
      .flatMap((rule) => rule.condition?.tagPrefixes ?? []);
    const deletes = policy.filter((rule) => rule.action.type === 'Delete');

    expect(keepPrefixes).toEqual(expect.arrayContaining(['prod-', 'keep-']));
    // Nearly every image is SHA-tagged: a delete rule scoped to untagged
    // images would silently delete nothing.
    expect(deletes).toEqual([
      expect.objectContaining({
        condition: { tagState: 'any', olderThan: '14d' },
      }),
    ]);
  });
});
