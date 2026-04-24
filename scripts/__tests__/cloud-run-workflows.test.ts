import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readWorkflow(name: string): string {
  return readFileSync(resolve('.github/workflows', name), 'utf8');
}

describe('Cloud Run workflow contracts', () => {
  it('publishes immutable commit-sha images in CI', () => {
    const ciWorkflow = readWorkflow('ci.yml');

    expect(ciWorkflow).toContain('container-publish:');
    expect(ciWorkflow).toContain(
      `IMAGE_TAG: \${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}`
    );
    expect(ciWorkflow).toContain(
      `IMAGE_URI: \${{ vars.GCP_REGION }}-docker.pkg.dev/\${{ vars.GCP_PROJECT_ID }}/\${{ vars.GCP_ARTIFACT_REPO }}/nham:\${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}`
    );
    expect(ciWorkflow).toContain('docker build');
    expect(ciWorkflow).toContain('docker push "$IMAGE_URI"');
  });

  it('promotes the CI image through manual staging instead of rebuilding it', () => {
    const stagingWorkflow = readWorkflow('cloud-run-staging.yml');

    expect(stagingWorkflow).toContain('commit_sha="$(git rev-parse HEAD)"');
    expect(stagingWorkflow).toContain(
      `echo "IMAGE_TAG=\${{ vars.GCP_REGION }}-docker.pkg.dev/\${{ vars.GCP_PROJECT_ID }}/\${{ vars.GCP_ARTIFACT_REPO }}/nham:\${commit_sha}" >> "$GITHUB_ENV"`
    );
    expect(stagingWorkflow).toContain(
      'gcloud artifacts docker images describe "$IMAGE_TAG"'
    );
    expect(stagingWorkflow).toContain(
      `echo "IMAGE_URI=\${IMAGE_TAG%:*}@\${digest}" >> "$GITHUB_ENV"`
    );
    expect(stagingWorkflow).not.toContain('docker build');
  });

  it('promotes the CI image into nham-internal after main CI succeeds', () => {
    const internalWorkflow = readWorkflow('cloud-run-internal.yml');

    expect(internalWorkflow).toContain("workflows: ['CI']");
    expect(internalWorkflow).toContain(
      "github.event.workflow_run.head_branch == 'main'"
    );
    expect(internalWorkflow).toContain(
      `IMAGE_TAG: \${{ vars.GCP_REGION }}-docker.pkg.dev/\${{ vars.GCP_PROJECT_ID }}/\${{ vars.GCP_ARTIFACT_REPO }}/nham:\${{ github.event.workflow_run.head_sha }}`
    );
    expect(internalWorkflow).toContain(
      'gcloud artifacts docker images describe "$IMAGE_TAG"'
    );
    expect(internalWorkflow).not.toContain('docker build');
  });

  it('keeps auto-preview disabled while retaining future branch-preview hooks', () => {
    const previewWorkflow = readWorkflow('cloud-run-preview.yml');

    expect(previewWorkflow).toContain(
      'if: false  # Auto-previews disabled; use manual staging workflow instead'
    );
    expect(previewWorkflow).toContain('PREVIEW_DATABASE_MODE');
    expect(previewWorkflow).toContain("env.PREVIEW_DATABASE_MODE == 'branch'");
    expect(previewWorkflow).toContain('Build preview image');
    expect(previewWorkflow).toContain('docker push "$IMAGE_TAG"');
  });
});
