import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildBranchName,
  buildPreviewImageTag,
  parseBranchEnv,
  parseCleanupArgs,
  parseCleanupOrphansArgs,
  preparePreviewBranch,
  selectOrphanPreviewBranches,
} from '@/scripts/cloud-run/preview-db';

describe('buildBranchName', () => {
  it('builds preview branch names from PR numbers', () => {
    expect(buildBranchName(42)).toBe('pr-42');
  });
});

describe('buildPreviewImageTag', () => {
  it('includes the preview branch and sha in the image tag', () => {
    expect(buildPreviewImageTag(42, 'abc123')).toContain(':pr-42-abc123');
  });
});

describe('parseBranchEnv', () => {
  it('extracts required branch env values from Supabase env output', () => {
    const parsed = parseBranchEnv(`
SUPABASE_URL=https://example.supabase.co
SUPABASE_ANON_KEY=anon-key
POSTGRES_URL_NON_POOLING="postgres://postgres:pw@db.example:5432/postgres"
IGNORED=value
`);

    expect(parsed).toEqual({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      POSTGRES_URL_NON_POOLING:
        'postgres://postgres:pw@db.example:5432/postgres',
    });
  });
});

describe('parseCleanupArgs', () => {
  it('accepts the workflow cleanup alias', () => {
    expect(parseCleanupArgs(['--pr', '42'])).toEqual({
      prNumber: 42,
    });
  });
});

describe('parseCleanupOrphansArgs', () => {
  it('accepts comma-separated open PR numbers for orphan cleanup', () => {
    expect(parseCleanupOrphansArgs(['--open-prs', '1, 2,3'])).toEqual({
      openPrNumbers: ['1', '2', '3'],
    });
  });

  it('treats an empty open-prs value as an empty PR list', () => {
    expect(parseCleanupOrphansArgs(['--open-prs', ''])).toEqual({
      openPrNumbers: [],
    });
  });
});

describe('selectOrphanPreviewBranches', () => {
  it('returns only preview branches whose PRs are no longer open', () => {
    expect(
      selectOrphanPreviewBranches(['pr-1', 'pr-2', 'feature-x'], ['1'])
    ).toEqual(['pr-2']);
  });
});

describe('preparePreviewBranch', () => {
  it('does not create a branch when lookup fails for a non-missing reason', async () => {
    const run = vi.fn().mockImplementationOnce(() => ({
      exitCode: 1,
      stdout: '',
      stderr: 'authentication failed',
    }));

    await expect(
      preparePreviewBranch({
        prNumber: 42,
        sha: 'abc123',
        seedFile: resolve('scripts/__tests__/preview-db-seed.sql'),
        gcsSeedBucket: 'preview-bucket',
        gcsSeedObject: 'supabase/seed_food.sql',
        githubEnvPath: '.github-preview-env',
        run,
        appendGithubEnv: vi.fn(),
      })
    ).rejects.toThrow('authentication failed');

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalledWith('supabase', [
      '--experimental',
      'branches',
      'create',
      'pr-42',
    ]);
  });

  it('deletes a newly created branch when env export fails after create', async () => {
    const appendGithubEnv = vi.fn(() => {
      throw new Error('github env write failed');
    });
    const run = vi
      .fn()
      .mockImplementationOnce(() => ({
        exitCode: 1,
        stdout: '',
        stderr: 'branch not found',
      }))
      .mockImplementationOnce(() => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
      }))
      .mockImplementationOnce(() => ({
        exitCode: 0,
        stdout: [
          'SUPABASE_URL=https://preview.supabase.co',
          'SUPABASE_ANON_KEY=anon-key',
          'POSTGRES_URL_NON_POOLING=postgres://db-url',
        ].join('\n'),
        stderr: '',
      }))
      .mockImplementationOnce(() => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
      }));

    await expect(
      preparePreviewBranch({
        prNumber: 42,
        sha: 'abc123',
        seedFile: resolve('scripts/__tests__/preview-db-seed.sql'),
        gcsSeedBucket: 'preview-bucket',
        gcsSeedObject: 'supabase/seed_food.sql',
        githubEnvPath: '.github-preview-env',
        run,
        appendGithubEnv,
      })
    ).rejects.toThrow('github env write failed');

    expect(run).toHaveBeenNthCalledWith(2, 'supabase', [
      '--experimental',
      'branches',
      'create',
      'pr-42',
    ]);
    expect(run).toHaveBeenLastCalledWith('supabase', [
      '--experimental',
      'branches',
      'delete',
      'pr-42',
      '--yes',
    ]);
  });

  it('deletes a newly created branch when migration or seed fails', async () => {
    const appendGithubEnv = vi.fn();
    const seedFile = resolve('scripts/__tests__/preview-db-seed.sql');
    rmSync(seedFile, { force: true });
    rmSync('.github-preview-env', { force: true });
    const run = vi
      .fn()
      .mockImplementationOnce(() => ({
        exitCode: 1,
        stdout: '',
        stderr: 'branch not found',
      }))
      .mockImplementationOnce(() => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
      }))
      .mockImplementationOnce(() => ({
        exitCode: 0,
        stdout: [
          'SUPABASE_URL=https://preview.supabase.co',
          'SUPABASE_ANON_KEY=anon-key',
          'POSTGRES_URL_NON_POOLING=postgres://db-url',
        ].join('\n'),
        stderr: '',
      }))
      .mockImplementationOnce(() => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
      }))
      .mockImplementationOnce((_command, args) => {
        writeFileSync(args[3], 'SELECT 1;', 'utf8');
        return {
          exitCode: 0,
          stdout: '',
          stderr: '',
        };
      })
      .mockImplementationOnce(() => ({
        exitCode: 1,
        stdout: '',
        stderr: 'psql failed',
      }))
      .mockImplementationOnce(() => ({
        exitCode: 0,
        stdout: '',
        stderr: '',
      }));

    await expect(
      preparePreviewBranch({
        prNumber: 42,
        sha: 'abc123',
        seedFile,
        gcsSeedBucket: 'preview-bucket',
        gcsSeedObject: 'supabase/seed_food.sql',
        githubEnvPath: '.github-preview-env',
        run,
        appendGithubEnv,
      })
    ).rejects.toThrow('psql failed');

    expect(run).toHaveBeenNthCalledWith(2, 'supabase', [
      '--experimental',
      'branches',
      'create',
      'pr-42',
    ]);
    expect(run).toHaveBeenLastCalledWith('supabase', [
      '--experimental',
      'branches',
      'delete',
      'pr-42',
      '--yes',
    ]);
    expect(appendGithubEnv).toHaveBeenCalledWith('.github-preview-env', {
      SUPABASE_URL: 'https://preview.supabase.co',
      SUPABASE_ANON_KEY: 'anon-key',
      POSTGRES_URL_NON_POOLING: 'postgres://db-url',
      BRANCH_NAME: 'pr-42',
      CREATED_BRANCH: 'true',
      IMAGE_TAG: expect.stringContaining(':pr-42-abc123'),
    });
    expect(existsSync(seedFile)).toBe(false);

    rmSync('.github-preview-env', { force: true });
  });
});
