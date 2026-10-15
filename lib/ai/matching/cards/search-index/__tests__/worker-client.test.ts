import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Manifest } from '../manifest';
import { spawnSearchWorker, TIMEOUTS_BEFORE_RESTART } from '../worker-client';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A stand-in worker script: `body` runs with `port` = parentPort. */
function fakeWorker(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'fake-worker-'));
  dirs.push(dir);
  const file = join(dir, 'worker.mjs');
  writeFileSync(
    file,
    `import { parentPort as port } from 'node:worker_threads';\n${body}\n`
  );
  return file;
}

const manifest = {} as Manifest;

describe('spawnSearchWorker', () => {
  // Listens (so it stays alive) but never answers.
  const silent = () =>
    fakeWorker(`port.postMessage({ type: 'ready', ms: 1 });
port.on('message', () => {});`);

  it('times out a search the worker does not answer, without failing it', async () => {
    const onFailure = vi.fn();
    const w = spawnSearchWorker('file:///x', manifest, onFailure, silent());
    await w.ready;
    await expect(w.search([[1]], 50)).rejects.toThrow(/timed out/);
    expect(onFailure).not.toHaveBeenCalled();
    w.terminate();
  });

  /** A test-scale hang rule: a "full" search is 20 ms, strikes span ≥ 30 ms. */
  const rule = { fullTimeoutMs: 20, minStrikeSpanMs: 30 };

  it(`replaces a worker that misses ${TIMEOUTS_BEFORE_RESTART} full searches in a row`, async () => {
    const onFailure = vi.fn();
    const w = spawnSearchWorker(
      'file:///x',
      manifest,
      onFailure,
      silent(),
      rule
    );
    await w.ready;
    for (let i = 0; i < TIMEOUTS_BEFORE_RESTART; i++) {
      await expect(w.search([[1]], 20)).rejects.toThrow(/timed out/);
    }
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0][0].message).toMatch(/missed 3 searches/);
    await expect(w.search([[1]], 20)).rejects.toThrow(/missed 3 searches/);
  });

  it('never counts a search cut short by its caller as a strike', async () => {
    const onFailure = vi.fn();
    // The default rule: only a full 2 s search that times out counts.
    const w = spawnSearchWorker('file:///x', manifest, onFailure, silent());
    await w.ready;
    for (let i = 0; i < 5; i++) {
      await expect(w.search([[1]], 5)).rejects.toThrow(/timed out/);
    }
    expect(onFailure).not.toHaveBeenCalled();
    w.terminate();
  });

  it('does not take one stall that times out concurrent searches for a hang', async () => {
    const onFailure = vi.fn();
    const w = spawnSearchWorker('file:///x', manifest, onFailure, silent(), {
      fullTimeoutMs: 20,
      minStrikeSpanMs: 60_000,
    });
    await w.ready;
    const all = Array.from({ length: 4 }, () => w.search([[1]], 20));
    for (const s of all) await expect(s).rejects.toThrow(/timed out/);
    expect(onFailure).not.toHaveBeenCalled();
    w.terminate();
  });

  it('starts counting again after an answer', async () => {
    const onFailure = vi.fn();
    // Answers only queries whose first value is 1.
    const w = spawnSearchWorker(
      'file:///x',
      manifest,
      onFailure,
      fakeWorker(`port.postMessage({ type: 'ready', ms: 1 });
port.on('message', ({ id, queries }) => {
  if (queries[0][0] === 1) port.postMessage({ id, hits: [[]] });
});`),
      rule
    );
    await w.ready;
    // Four full-length misses, which would replace the worker without the
    // answer between them.
    for (const value of [0, 0, 1, 0, 0]) {
      const search = w.search([[value]], 20);
      if (value === 1) await search;
      else await expect(search).rejects.toThrow(/timed out/);
    }
    expect(onFailure).not.toHaveBeenCalled();
    w.terminate();
  });

  it('settles pending searches and reports the failure when the worker dies', async () => {
    const onFailure = vi.fn();
    const w = spawnSearchWorker(
      'file:///x',
      manifest,
      onFailure,
      fakeWorker(`port.postMessage({ type: 'ready', ms: 1 });
port.on('message', () => process.exit(3));`)
    );
    await w.ready;
    await expect(w.search([[1]], 5_000)).rejects.toThrow(/exited \(code 3\)/);
    expect(onFailure).toHaveBeenCalledTimes(1);
    await expect(w.search([[1]], 5_000)).rejects.toThrow(/exited/);
  });

  it('rejects ready when the worker reports a failed load', async () => {
    const onFailure = vi.fn();
    const w = spawnSearchWorker(
      'file:///x',
      manifest,
      onFailure,
      fakeWorker(`port.postMessage({ type: 'failed', error: 'bad build' });`)
    );
    await expect(w.ready).rejects.toThrow('bad build');
    expect(onFailure).toHaveBeenCalledTimes(1);
    w.terminate();
  });

  it('matches replies to their requests', async () => {
    const w = spawnSearchWorker(
      'file:///x',
      manifest,
      vi.fn(),
      fakeWorker(`port.postMessage({ type: 'ready', ms: 1 });
port.on('message', ({ id, queries }) =>
  setTimeout(() => port.postMessage({ id, hits: [[['row_' + queries[0][0], 0.5]]] }), queries[0][0] === 1 ? 30 : 0));`)
    );
    await w.ready;
    const [a, b] = await Promise.all([
      w.search([[1]], 2_000),
      w.search([[2]], 2_000),
    ]);
    expect(a[0][0]).toEqual({ id: 'row_1', similarity: 0.5 });
    expect(b[0][0]).toEqual({ id: 'row_2', similarity: 0.5 });
    w.terminate();
  });
});
