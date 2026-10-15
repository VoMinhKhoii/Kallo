import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { revisionPin, servingRevision } from '../card-index-refresh.mjs';

const SHA = '5ccae9e6b6827e67bbff9739674694f7050d9b55';
const URI = 'gs://kallo-prod-card-search/f1/df0f52192c79-20261015T032505Z';

/** `gcloud run revisions describe --format=json`, trimmed to what is read. */
function revision(env: { name: string; value: string }[], sha = SHA) {
  return {
    metadata: { name: 'kallo-prod-00282-qaj', labels: { 'commit-sha': sha } },
    spec: { containers: [{ env }] },
  };
}

describe('servingRevision', () => {
  it('names the revision taking all traffic', () => {
    expect(
      servingRevision({
        status: {
          traffic: [
            { latestRevision: true, percent: 100, revisionName: 'rev-2' },
            // A smoke candidate's tag carries no traffic.
            { revisionName: 'rev-3', tag: 'candidate' },
          ],
        },
      })
    ).toBe('rev-2');
  });

  it('names none while traffic is split', () => {
    expect(
      servingRevision({
        status: {
          traffic: [
            { percent: 90, revisionName: 'rev-1' },
            { percent: 10, revisionName: 'rev-2' },
          ],
        },
      })
    ).toBeNull();
    expect(servingRevision({})).toBeNull();
  });
});

describe('revisionPin', () => {
  it('reads the commit and the pinned build', () => {
    expect(
      revisionPin(revision([{ name: 'CARD_INDEX_URI', value: URI }]))
    ).toEqual({ sha: SHA, uri: URI, enabled: true });
  });

  it('reports no build for a revision without one', () => {
    expect(revisionPin(revision([]))).toEqual({
      sha: SHA,
      uri: '',
      enabled: true,
    });
  });

  it.each([
    'false',
    'FALSE',
    ' 0 ',
    'off',
    'no',
    'disabled',
    'disable',
  ])('reads CARD_INDEX_ENABLED=%j as the kill switch', (value) => {
    const pin = revisionPin(
      revision([
        { name: 'CARD_INDEX_URI', value: URI },
        { name: 'CARD_INDEX_ENABLED', value },
      ])
    );
    expect(pin.enabled).toBe(false);
  });

  it.each([
    'true',
    '1',
    '',
    'yes',
  ])('keeps the build in use for CARD_INDEX_ENABLED=%j', (value) => {
    const pin = revisionPin(revision([{ name: 'CARD_INDEX_ENABLED', value }]));
    expect(pin.enabled).toBe(true);
  });

  it('refuses a revision without a commit label', () => {
    expect(() => revisionPin(revision([], ''))).toThrow(/no commit-sha label/);
    // Never a value that could smuggle extra arguments into `gh workflow run`.
    expect(() => revisionPin(revision([], 'main -f x=y'))).toThrow(
      /no commit-sha label/
    );
  });
});

describe('card-index-refresh.mjs CLI', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const SCRIPT = resolve('scripts/cloud-run/card-index-refresh.mjs');
  const run = (command: string, json: unknown, script = SCRIPT) => {
    const dir = mkdtempSync(join(tmpdir(), 'card-refresh-'));
    dirs.push(dir);
    const file = join(dir, 'in.json');
    writeFileSync(file, JSON.stringify(json));
    return execFileSync('node', [script, command, file], { encoding: 'utf8' });
  };
  const servingAll = {
    status: { traffic: [{ percent: 100, revisionName: 'rev-2' }] },
  };

  it('prints the revision taking all traffic', () => {
    expect(run('revision', servingAll)).toBe('rev-2\n');
  });

  it('still answers when run through a symlink', () => {
    const dir = mkdtempSync(join(tmpdir(), 'card-refresh-link-'));
    dirs.push(dir);
    const link = join(dir, 'card-index-refresh.mjs');
    symlinkSync(SCRIPT, link);
    expect(run('revision', servingAll, link)).toBe('rev-2\n');
  });

  it('prints the pin as output lines', () => {
    expect(run('pin', revision([{ name: 'CARD_INDEX_URI', value: URI }]))).toBe(
      `sha=${SHA}\nuri=${URI}\nenabled=true\n`
    );
  });

  it('prints an empty line for split traffic', () => {
    expect(run('revision', { status: { traffic: [] } })).toBe('\n');
  });
});
