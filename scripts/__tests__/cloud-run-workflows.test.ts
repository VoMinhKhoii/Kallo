import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readWorkflow(name: string): string {
  return readFileSync(resolve('.github/workflows', name), 'utf8');
}

describe('Cloud Run staging workflow', () => {
  it('accepts workflow-dispatch input or staging branch push and resolves it before deploy checkout', () => {
    const workflow = readWorkflow('cloud-run-staging.yml');

    expect(workflow).toContain('id: resolve_target');
    expect(workflow).toContain(
      `INPUT_REF: \${{ github.event.inputs.ref || github.ref_name }}`
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

  it('auto-triggers on push to the staging branch', () => {
    const workflow = readWorkflow('cloud-run-staging.yml');

    expect(workflow).toContain('push:');
    expect(workflow).toContain('branches: [staging]');
    expect(workflow).toContain('workflow_dispatch:');
  });

  it('falls back to a generated reason and force_takeover=false when no dispatch inputs are provided', () => {
    const workflow = readWorkflow('cloud-run-staging.yml');

    // The reason fallback is defined once at the job level as DEPLOY_REASON
    // and reused across the lease, metadata, and summary steps.
    expect(workflow).toContain(
      `DEPLOY_REASON: \${{ github.event.inputs.reason || format('Auto-deploy from staging branch (commit {0})', github.sha) }}`
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
  it('asserts that all local migrations are applied before deploying', () => {
    const workflow = readWorkflow('cloud-run-internal.yml');

    expect(workflow).toContain(
      'node ./scripts/cloud-run/shared-db.mjs assert-migrations-applied --db-url "$db_url" --migrations-dir ./supabase/migrations'
    );
  });
});
