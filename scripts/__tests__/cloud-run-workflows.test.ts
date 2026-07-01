import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readWorkflow(name: string): string {
  return readFileSync(resolve('.github/workflows', name), 'utf8');
}

describe('Cloud Run staging workflow', () => {
  it('accepts workflow-dispatch input or workflow_run head_sha and resolves it before deploy checkout', () => {
    const workflow = readWorkflow('cloud-run-staging.yml');

    expect(workflow).toContain('id: resolve_target');
    expect(workflow).toContain(
      `INPUT_REF: \${{ github.event.inputs.ref || github.event.workflow_run.head_sha }}`
    );
    expect(workflow).toContain(
      `const isPullRequestNumber = /^\\d+$/.test(rawInput);`
    );
    expect(workflow).toContain(`core.setOutput('resolved_ref', resolvedRef);`);
    expect(workflow).toContain(`core.setOutput('pr_number', prNumber);`);
    expect(workflow).toContain(
      `ref: \${{ steps.resolve_target.outputs.resolved_ref }}`
    );
  });

  it('auto-triggers from a successful CI run on the staging branch', () => {
    const workflow = readWorkflow('cloud-run-staging.yml');

    // workflow_run is preferred over push so the container image CI publishes
    // is guaranteed to exist by the time staging tries to deploy it, and so a
    // failing CI on staging blocks the deploy.
    expect(workflow).toContain('workflow_run:');
    expect(workflow).toContain(`workflows: ['CI']`);
    expect(workflow).toContain('workflow_dispatch:');
    // Job guard rejects workflow_run events for branches other than staging,
    // forks, and failed CI runs; manual dispatches are always allowed.
    expect(workflow).toContain(`github.event_name == 'workflow_dispatch'`);
    expect(workflow).toContain(
      `github.event.workflow_run.head_branch == 'staging'`
    );
    expect(workflow).toContain(
      `github.event.workflow_run.conclusion == 'success'`
    );
    // The push trigger must NOT come back as an active trigger — it raced
    // CI's container publish step. Match only "push:" at the start of an `on:`
    // entry (two-space indent), not the substring inside an explanatory
    // comment.
    expect(workflow).not.toMatch(/^ {2}push:$/m);
  });

  it('falls back to a generated reason and force_takeover=false when no dispatch inputs are provided', () => {
    const workflow = readWorkflow('cloud-run-staging.yml');

    // The reason fallback is defined once at the job level as DEPLOY_REASON
    // and reused across the lease, metadata, and summary steps.
    expect(workflow).toContain(
      `DEPLOY_REASON: \${{ github.event.inputs.reason || format('Auto-deploy from staging branch (commit {0})', github.event.workflow_run.head_sha) }}`
    );
    expect(workflow).toContain(`STAGING_REASON: \${{ env.DEPLOY_REASON }}`);
    expect(workflow).toContain(
      `STAGING_FORCE_TAKEOVER: \${{ github.event.inputs.force_takeover || 'false' }}`
    );
  });

  it('uses the supported supabase db push subcommand form', () => {
    const workflow = readWorkflow('cloud-run-staging.yml');

    expect(workflow).toContain(
      'run: yes | supabase db push --db-url "$STAGING_DATABASE_URL_ENCODED"'
    );
    expect(workflow).not.toContain(
      'run: supabase --yes db push --db-url "$STAGING_DATABASE_URL"'
    );
    expect(workflow).toContain(`STAGING_DATABASE_URL_ENCODED<<EOF`);
  });

  it('scopes the deploy-time append-only check to pending migrations only', () => {
    const workflow = readWorkflow('cloud-run-staging.yml');

    // A deploy job has no git baseline; scope the check to the not-yet-applied
    // migrations so historical, already-applied ones are not re-flagged.
    expect(workflow).toContain(
      'list-pending --db-url "$STAGING_DATABASE_URL" --migrations-dir ./supabase/migrations'
    );
    expect(workflow).toContain('node scripts/check-append-only-migrations.mjs');
  });

  it('passes through the resolved PR number for staging comment updates', () => {
    const workflow = readWorkflow('cloud-run-staging.yml');

    expect(workflow).toContain(
      `RESOLVED_PR_NUMBER: \${{ steps.resolve_target.outputs.pr_number }}`
    );
    expect(workflow).toContain(
      "const explicitPrNumber = process.env.RESOLVED_PR_NUMBER || '';"
    );
    expect(workflow).toContain('prNumber,');
    expect(workflow).toContain('--arg pr_number "$RESOLVED_PR_NUMBER"');
  });

  it('disables default deploy-cloudrun labels so target commit labels stay unique', () => {
    const workflow = readWorkflow('cloud-run-staging.yml');

    expect(workflow).toContain('skip_default_labels: true');
    expect(workflow).toContain(
      `--update-labels=commit-sha=\${{ env.COMMIT_SHA }},deployment-target=staging,github-run-id=\${{ github.run_id }}`
    );
    expect(workflow).not.toContain('--revision-labels=');
  });

  it('writes the PR number into the workflow summary for shared staging runs', () => {
    const workflow = readWorkflow('cloud-run-staging.yml');

    expect(workflow).toContain('- name: Write staging summary');
    expect(workflow).toContain("echo '## Shared staging deployment'");
    expect(workflow).toContain('echo "- PR: #$RESOLVED_PR_NUMBER"');
  });
});

describe('Cloud Run internal workflow', () => {
  it('applies pending migrations on the main deploy, then verifies them', () => {
    const workflow = readWorkflow('cloud-run-internal.yml');

    // Migrations are applied on the main deploy itself (no separate staging
    // trip), then re-asserted so a partial push fails the deploy.
    expect(workflow).toContain(
      'run: yes | supabase db push --db-url "$INTERNAL_DATABASE_URL_ENCODED"'
    );
    expect(workflow).toContain(
      'node ./scripts/cloud-run/shared-db.mjs assert-migrations-applied --db-url "$INTERNAL_DATABASE_URL" --migrations-dir ./supabase/migrations'
    );
  });

  it('scopes the deploy-time append-only check to pending migrations only', () => {
    const workflow = readWorkflow('cloud-run-internal.yml');

    // A deploy job has no git baseline, so the check is scoped to the
    // not-yet-applied migrations rather than re-scanning all of history.
    expect(workflow).toContain(
      'list-pending --db-url "$INTERNAL_DATABASE_URL" --migrations-dir ./supabase/migrations'
    );
    expect(workflow).toContain(
      'node ./scripts/check-append-only-migrations.mjs'
    );
  });
});

describe('Reset staging database workflow', () => {
  it('replays migrations from the staging branch by default', () => {
    const workflow = readWorkflow('reset-staging-db.yml');

    // Default ref is `staging` (the canonical pre-prod source of truth), with
    // an optional override input for emergency recovery.
    expect(workflow).toContain('default: staging');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: matches exact workflow string
    expect(workflow).toContain('ref: ${{ github.event.inputs.ref }}');
    // Must not silently fall back to the repo default branch — that would
    // replay `main`'s migrations and miss anything already applied to staging.
    expect(workflow).not.toContain(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: matches exact workflow string
      'ref: ${{ github.event.repository.default_branch }}'
    );
  });
});

describe('CI workflow', () => {
  it('runs on pushes and PRs targeting both main and staging', () => {
    const workflow = readWorkflow('ci.yml');

    expect(workflow).toContain('branches: [main, staging]');
  });
});
