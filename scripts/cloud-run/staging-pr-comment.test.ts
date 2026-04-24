import { describe, expect, it } from 'vitest';

import {
  buildStagingPreviewCommentBody,
  extractPullRequestNumberFromRef,
} from './staging-pr-comment.mjs';

describe('staging PR comment helpers', () => {
  it('extracts the PR number from a plain numeric input', () => {
    expect(extractPullRequestNumberFromRef('76')).toBe(76);
  });

  it('extracts the PR number from pr-<number> refs', () => {
    expect(extractPullRequestNumberFromRef('pr-75')).toBe(75);
  });

  it('extracts the PR number from refs ending with #<number>', () => {
    expect(extractPullRequestNumberFromRef('feat/manual-staging#75')).toBe(75);
  });

  it('rejects refs with incidental digits', () => {
    expect(extractPullRequestNumberFromRef('v1.2.3')).toBeNull();
    expect(extractPullRequestNumberFromRef('release-2026')).toBeNull();
    expect(extractPullRequestNumberFromRef('feat/fix-42-login')).toBeNull();
  });

  it('rejects unsupported pr ref variants', () => {
    expect(extractPullRequestNumberFromRef('pr-75-hotfix')).toBeNull();
    expect(extractPullRequestNumberFromRef('feat#75/more')).toBeNull();
  });

  it('builds the staging preview PR comment body', () => {
    expect(
      buildStagingPreviewCommentBody({
        prNumber: 75,
        reason: 'manual QA',
        timestamp: '2026-04-24T10:00:00.000Z',
        url: 'https://nham-staging.example.com',
      })
    ).toBe(
      [
        '<!-- nham-staging-preview -->',
        '**Staging Preview for PR #75**',
        '',
        'URL: https://nham-staging.example.com',
        'Deployed at: 2026-04-24T10:00:00.000Z',
        'Reason: manual QA',
      ].join('\n')
    );
  });
});
