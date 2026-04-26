import { describe, expect, it } from 'vitest';

import { parseStagingDispatchInput } from './staging-input.mjs';

describe('parseStagingDispatchInput', () => {
  it('treats a plain number as a PR shortcut', () => {
    expect(parseStagingDispatchInput('76')).toEqual({
      kind: 'pull_request',
      prNumber: 76,
      rawInput: '76',
    });
  });

  it('treats a branch name as a git ref', () => {
    expect(
      parseStagingDispatchInput('codex/manual-staging-verification')
    ).toEqual({
      kind: 'git_ref',
      rawInput: 'codex/manual-staging-verification',
    });
  });

  it('treats commit shas as git refs', () => {
    expect(
      parseStagingDispatchInput('ea61be001875d1254a12d72cde597e9c1e1341a0')
    ).toEqual({
      kind: 'git_ref',
      rawInput: 'ea61be001875d1254a12d72cde597e9c1e1341a0',
    });
  });

  it('trims whitespace before parsing', () => {
    expect(parseStagingDispatchInput('  75  ')).toEqual({
      kind: 'pull_request',
      prNumber: 75,
      rawInput: '75',
    });
  });
});
