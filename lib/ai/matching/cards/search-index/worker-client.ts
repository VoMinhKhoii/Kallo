/**
 * The main thread's side of the search worker (`worker.mjs`): spawns it,
 * matches replies to requests, and settles every pending request when the
 * worker fails, exits or does not answer in time. Owned by `search-index.ts`.
 *
 * Timeouts are counted here, on the worker's own handle: Next bundles
 * `search-index.ts` into the boot hook and each route as separate copies, so
 * a check like `err instanceof SomeError` in the calling copy would not
 * recognise an error class from the copy that spawned the worker.
 */
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import type { VectorHit } from '../vector-arm';
import type { Manifest } from './manifest';

/** Repo-relative; standalone `server.js` runs with its own directory as cwd. */
export const WORKER_PATH = 'lib/ai/matching/cards/search-index/worker.mjs';

export interface SearchWorker {
  /** Resolves when the build is loaded and self-tested; rejects on failure. */
  ready: Promise<number>;
  search(embeddings: number[][], timeoutMs: number): Promise<VectorHit[][]>;
  terminate(): void;
}

/** Timeouts in a row after which the worker counts as hung and is replaced. */
export const TIMEOUTS_BEFORE_RESTART = 3;

export interface HangRule {
  /**
   * The full time a search gets. Only a search given all of it and still
   * unanswered is evidence of a hung worker: one cut short by its caller's
   * deadline can time out on a healthy worker.
   */
  fullTimeoutMs: number;
  /**
   * The strikes must span at least this long, so one momentary stall (a GC
   * pause, CPU throttling) that times out several concurrent searches at once
   * is not mistaken for a hang.
   */
  minStrikeSpanMs: number;
}

export const DEFAULT_HANG_RULE: HangRule = {
  fullTimeoutMs: 2_000,
  minStrikeSpanMs: 2_000,
};

type Reply =
  | { type: 'ready'; ms: number }
  | { type: 'failed'; error: string }
  | { id: number; hits: [string, number][][] }
  | { id: number; error: string };

interface Pending {
  resolve: (hits: VectorHit[][]) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function spawnSearchWorker(
  uri: string,
  manifest: Manifest,
  onFailure: (err: Error) => void,
  workerPath = path.join(process.cwd(), WORKER_PATH),
  hangRule: HangRule = DEFAULT_HANG_RULE
): SearchWorker {
  const worker = new Worker(/* turbopackIgnore: true */ workerPath, {
    workerData: { uri, manifest },
  });
  const pending = new Map<number, Pending>();
  let nextId = 1;
  let dead: Error | null = null;
  let markReady: (ms: number) => void = () => {};
  let markFailed: (err: Error) => void = () => {};
  const ready = new Promise<number>((resolve, reject) => {
    markReady = resolve;
    markFailed = reject;
  });
  // A rejected `ready` nobody awaits must not crash the process.
  ready.catch(() => {});

  const fail = (err: Error) => {
    if (dead) return;
    dead = err;
    markFailed(err);
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    pending.clear();
    onFailure(err);
  };

  worker.on('message', (reply: Reply) => {
    if ('type' in reply) {
      if (reply.type === 'ready') markReady(reply.ms);
      else fail(new Error(reply.error));
      return;
    }
    const p = pending.get(reply.id);
    if (!p) return; // timed out already
    pending.delete(reply.id);
    clearTimeout(p.timer);
    if ('error' in reply) p.reject(new Error(reply.error));
    else
      p.resolve(
        reply.hits.map((list) =>
          list.map(([id, similarity]) => ({ id, similarity }))
        )
      );
  });
  worker.on('error', (err) => fail(err));
  worker.on('exit', (code) =>
    fail(new Error(`card index worker exited (code ${code})`))
  );

  const terminate = (reason: string) => {
    fail(new Error(reason));
    void worker.terminate();
  };
  let timeoutsInARow = 0;
  let firstStrikeAt = 0;
  const strike = () => {
    if (timeoutsInARow++ === 0) firstStrikeAt = Date.now();
    // A worker that keeps missing full-length searches, over a span longer
    // than one stall, is hung: replace it (its failure handler retries)
    // rather than make every call wait.
    if (
      timeoutsInARow >= TIMEOUTS_BEFORE_RESTART &&
      Date.now() - firstStrikeAt >= hangRule.minStrikeSpanMs
    ) {
      terminate(`card index worker missed ${timeoutsInARow} searches in a row`);
    }
  };

  return {
    ready,
    search(embeddings, timeoutMs) {
      if (dead) return Promise.reject(dead);
      const id = nextId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => {
            pending.delete(id);
            reject(
              new Error(`card index search timed out after ${timeoutMs} ms`)
            );
            if (timeoutMs >= hangRule.fullTimeoutMs) strike();
          },
          Math.max(0, timeoutMs)
        );
        pending.set(id, {
          resolve: (hits) => {
            timeoutsInARow = 0;
            resolve(hits);
          },
          reject,
          timer,
        });
        worker.postMessage({ id, queries: embeddings });
      });
    },
    terminate() {
      terminate('card index worker terminated');
    },
  };
}
