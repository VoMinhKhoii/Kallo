import { readFileSync } from 'node:fs';
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

  it('scopes the deploy-time append-only check to pending migrations only', () => {
    const workflow = readWorkflow('cloud-run-prod.yml');

    // A deploy job has no git baseline, so the check is scoped to the
    // not-yet-applied migrations rather than re-scanning all of history.
    expect(workflow).toContain(
      'list-pending --db-url "$PROD_DATABASE_URL" --migrations-dir ./supabase/migrations'
    );
    expect(workflow).toContain(
      'node ./scripts/check-append-only-migrations.mjs'
    );
  });
});

describe('CI workflow', () => {
  it('runs on pushes and PRs targeting both main and staging', () => {
    const workflow = readWorkflow('ci.yml');

    expect(workflow).toContain('branches: [main, staging]');
  });
});
