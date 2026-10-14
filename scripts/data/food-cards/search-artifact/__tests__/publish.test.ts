import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { type BuildOptions, runBuild } from '../publish';
import { cardData, fakeDatabase, memoryBucket } from './card-data-doubles';

const data = cardData(160, 8);
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function options(over: Partial<BuildOptions> = {}): BuildOptions {
  const outDir = mkdtempSync(join(tmpdir(), 'publish-test-'));
  dirs.push(outDir);
  return { bucket: 'b', force: false, dryRun: false, outDir, ...over };
}

function deps(
  db: ReturnType<typeof fakeDatabase>,
  storage: ReturnType<typeof memoryBucket>['storage'],
  at = '2026-10-15T01:02:03.000Z'
) {
  return {
    sql: db.sql,
    storage,
    gitSha: 'abc123',
    now: () => new Date(at),
    log: () => {},
  };
}

const pointerOf = (bucket: ReturnType<typeof memoryBucket>) =>
  [...bucket.objects.keys()].find((k) => k.includes('/by-key/')) as string;

describe('runBuild', () => {
  it('builds, gates and publishes files, then the manifest, then the pointer', async () => {
    const db = fakeDatabase(data);
    const bucket = memoryBucket();

    const result = await runBuild(deps(db, bucket.storage), options());

    expect(result.kind).toBe('published');
    const buildId = (result as { uri: string }).uri.split('/').at(-1);
    expect(buildId).toMatch(/^[0-9a-f]{12}-20261015T010203Z$/);
    expect(bucket.writes).toEqual([
      `f1/${buildId}/catalog.json`,
      `f1/${buildId}/texts.f16`,
      `f1/${buildId}/text-rows.json`,
      `f1/${buildId}/index.usearch`,
      `f1/${buildId}/manifest.json`,
      pointerOf(bucket),
    ]);
    // Every query ran inside an explicit read-only transaction (the fake
    // database refuses anything else).
    expect(db.modes).toEqual([
      'read only',
      'isolation level repeatable read read only',
      'read only',
    ]);
  });

  it('reuses the published build for an unchanged key without reading vectors', async () => {
    const bucket = memoryBucket();
    const first = await runBuild(
      deps(fakeDatabase(data), bucket.storage),
      options()
    );
    const db = fakeDatabase(data);

    const second = await runBuild(deps(db, bucket.storage), options());

    expect(second).toEqual({
      kind: 'reused',
      uri: (first as { uri: string }).uri,
    });
    const queries = db.unsafe.mock.calls.map(([q]) => q as string);
    expect(queries.some((q) => q.includes('halfvec_send(t.embedding)'))).toBe(
      false
    );
  });

  it('with --force, rebuilds and repoints the key at the new build', async () => {
    const bucket = memoryBucket();
    await runBuild(deps(fakeDatabase(data), bucket.storage), options());

    const forced = await runBuild(
      deps(fakeDatabase(data), bucket.storage, '2026-10-16T00:00:00.000Z'),
      options({ force: true })
    );

    expect(forced.kind).toBe('published');
    const pointer = JSON.parse(
      bucket.objects.get(pointerOf(bucket))!.body.toString()
    );
    expect(pointer.uri).toBe((forced as { uri: string }).uri);
    expect(pointer.buildId).toMatch(/-20261016T000000Z$/);
  });

  it('without --force, adopts the build another run published first', async () => {
    const bucket = memoryBucket();
    const originalUpload = bucket.storage.upload;
    // Another run creates the key's pointer just before ours.
    bucket.storage.upload = async (b, name, body, gen, type) => {
      if (name.includes('/by-key/') && !bucket.objects.has(name)) {
        const key = name.slice('f1/by-key/'.length, -'.json'.length);
        const other = {
          buildId: 'other-build',
          key,
          uri: 'gs://b/f1/other-build',
        };
        bucket.put(name, Buffer.from(JSON.stringify(other)));
      }
      return originalUpload(b, name, body, gen, type);
    };

    const result = await runBuild(
      deps(fakeDatabase(data), bucket.storage),
      options()
    );

    expect(result).toEqual({ kind: 'published', uri: 'gs://b/f1/other-build' });
  });

  it('treats its own landed write (response lost) as published', async () => {
    const bucket = memoryBucket();
    const originalUpload = bucket.storage.upload;
    bucket.storage.upload = async (b, name, body, gen, type) => {
      // The write lands, but the caller sees a failed precondition.
      if (name.includes('/by-key/') && !bucket.objects.has(name)) {
        bucket.put(name, body);
        return false;
      }
      return originalUpload(b, name, body, gen, type);
    };

    const result = await runBuild(
      deps(fakeDatabase(data), bucket.storage),
      options()
    );

    expect(result.kind).toBe('published');
    const pointer = JSON.parse(
      bucket.objects.get(pointerOf(bucket))!.body.toString()
    );
    expect((result as { uri: string }).uri).toBe(pointer.uri);
  });

  it('with --force, gives up after the pointer keeps changing underneath it', async () => {
    const bucket = memoryBucket();
    await runBuild(deps(fakeDatabase(data), bucket.storage), options());
    bucket.storage.upload = async () => false;

    await expect(
      runBuild(
        deps(fakeDatabase(data), bucket.storage, '2026-10-17T00:00:00.000Z'),
        options({ force: true })
      )
    ).rejects.toThrow(/could not update/);
  });

  it('publishes nothing when the parity gate fails', async () => {
    const bucket = memoryBucket();
    const db = fakeDatabase(data, { dbAnswers: () => [] });

    await expect(runBuild(deps(db, bucket.storage), options())).rejects.toThrow(
      /parity gate failed/
    );
    expect(bucket.writes).toEqual([]);
  });

  it('refuses a pointer that names another key or bucket', async () => {
    const bucket = memoryBucket();
    await runBuild(deps(fakeDatabase(data), bucket.storage), options());
    const name = pointerOf(bucket);
    bucket.put(
      name,
      Buffer.from(
        JSON.stringify({ buildId: 'x', key: 'wrong', uri: 'gs://b/f1/x' })
      )
    );

    await expect(
      runBuild(deps(fakeDatabase(data), bucket.storage), options())
    ).rejects.toThrow(/names key wrong/);
  });

  it('a dry run builds into a fresh directory and touches no storage', async () => {
    const bucket = memoryBucket();
    const outDir = join(options().outDir, 'nested', 'out');

    const result = await runBuild(
      deps(fakeDatabase(data), bucket.storage),
      options({ dryRun: true, outDir })
    );

    expect(result.kind).toBe('dry-run');
    expect(existsSync(join(outDir, 'manifest.json'))).toBe(true);
    expect(bucket.writes).toEqual([]);
  });
});
