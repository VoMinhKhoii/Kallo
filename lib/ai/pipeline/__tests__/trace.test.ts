import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import type { AppDb } from '@/lib/db';

vi.mock('server-only', () => ({}));

// Must be imported after potential env manipulation
let recordPromptVersion: typeof import('@/lib/ai/pipeline/trace').recordPromptVersion;
let logStage: typeof import('@/lib/ai/pipeline/trace').logStage;
let logLlmCall: typeof import('@/lib/ai/pipeline/trace').logLlmCall;
let _resetPromptVersionCacheForTests: typeof import('@/lib/ai/pipeline/trace')._resetPromptVersionCacheForTests;

// ── Mock helpers ─────────────────────────────────────────────────────────────

function makeReturningMock(rows: { id: string }[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoNothing });
  return {
    insert: vi.fn().mockReturnValue({ values }),
    values,
    onConflictDoNothing,
    returning,
  };
}

/** Build a db mock where insert resolves, suitable for logStage / logLlmCall */
function makeInsertCatchMock() {
  const catchFn = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ catch: catchFn });
  const insert = vi.fn().mockReturnValue({ values });
  return { insert, values, catch: catchFn } as unknown as AppDb & {
    insert: MockInstance;
    values: MockInstance;
    catch: MockInstance;
  };
}

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(async () => {
  // Re-import to pick up env changes and reset module state
  vi.resetModules();
  const mod = await import('@/lib/ai/pipeline/trace');
  recordPromptVersion = mod.recordPromptVersion;
  logStage = mod.logStage;
  logLlmCall = mod.logLlmCall;
  _resetPromptVersionCacheForTests = mod._resetPromptVersionCacheForTests;
  _resetPromptVersionCacheForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ── 1. recordPromptVersion — cache deduplication ──────────────────────────────

describe('recordPromptVersion — cache', () => {
  it('returns the same id on second call without hitting DB again', async () => {
    const mock = makeReturningMock([{ id: 'pv-1' }]);
    const db = { ...mock, select: vi.fn() } as unknown as AppDb;
    const builder = () => 'template';

    const id1 = await recordPromptVersion({
      db,
      name: 'test',
      builder,
      templateSample: 'tpl',
      model: 'gpt-4',
    });
    const id2 = await recordPromptVersion({
      db,
      name: 'test',
      builder,
      templateSample: 'tpl',
      model: 'gpt-4',
    });

    expect(id1).toBe('pv-1');
    expect(id2).toBe('pv-1');
    // INSERT called only once
    expect(mock.insert).toHaveBeenCalledTimes(1);
  });
});

// ── 2. recordPromptVersion — no negative cache on failure ────────────────────

describe('recordPromptVersion — no negative cache', () => {
  it('returns null on DB failure and retries on next call', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // First call: insert throws
    const failReturning = vi.fn().mockRejectedValue(new Error('db down'));
    const failOnConflict = vi
      .fn()
      .mockReturnValue({ returning: failReturning });
    const failValues = vi
      .fn()
      .mockReturnValue({ onConflictDoNothing: failOnConflict });
    const failInsert = vi.fn().mockReturnValue({ values: failValues });

    const failDb = { insert: failInsert, select: vi.fn() } as unknown as AppDb;
    const builder = () => 'template';

    const id1 = await recordPromptVersion({
      db: failDb,
      name: 'retry-test',
      builder,
      templateSample: 'tpl',
      model: 'gpt-4',
    });
    expect(id1).toBeNull();
    expect(consoleError).toHaveBeenCalled();

    // Second call with working db — should retry (no cache from failure)
    const workingMock = makeReturningMock([{ id: 'pv-retry' }]);
    const workingDb = { ...workingMock, select: vi.fn() } as unknown as AppDb;

    const id2 = await recordPromptVersion({
      db: workingDb,
      name: 'retry-test',
      builder,
      templateSample: 'tpl',
      model: 'gpt-4',
    });
    expect(id2).toBe('pv-retry');
    expect(workingMock.insert).toHaveBeenCalledTimes(1);
  });
});

// ── 3. logStage — fires INSERT with supplied stageLogId ───────────────────────

describe('logStage', () => {
  it('calls db.insert with the supplied stageLogId', () => {
    const mock = makeInsertCatchMock();

    logStage({
      db: mock,
      requestId: 'req-1',
      stageLogId: 'stage-log-abc',
      stage: 'decomposition',
      stageIndex: 0,
      inputJson: { raw: 'food' },
      outputJson: { parsed: true },
      status: 'success',
      durationMs: 42,
    });

    expect(mock.insert).toHaveBeenCalledTimes(1);
    expect(mock.values).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'stage-log-abc',
        requestId: 'req-1',
        stage: 'decomposition',
      })
    );
  });
});

// ── 4. logStage / logLlmCall swallow errors ───────────────────────────────────

describe('error swallowing', () => {
  it('logStage does not throw on DB error and calls console.error', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const catchFn = vi.fn().mockImplementation((cb) => {
      cb(new Error('boom'));
    });
    const values = vi.fn().mockReturnValue({ catch: catchFn });
    const insert = vi.fn().mockReturnValue({ values });
    const errDb = { insert, values, catch: catchFn } as unknown as AppDb & {
      insert: MockInstance;
      values: MockInstance;
    };

    expect(() =>
      logStage({
        db: errDb,
        requestId: 'req-1',
        stageLogId: 'sl-1',
        stage: 'matching',
        stageIndex: 1,
        inputJson: {},
        outputJson: {},
        status: 'error',
        durationMs: 10,
      })
    ).not.toThrow();

    expect(consoleError).toHaveBeenCalledWith(
      '[trace] logStage failed',
      expect.any(Error)
    );
  });

  it('logLlmCall does not throw on DB error and calls console.error', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const values = vi.fn().mockReturnValue(Promise.reject(new Error('boom')));
    const insert = vi.fn().mockReturnValue({ values });
    const errDb = { insert, values } as unknown as AppDb & {
      insert: MockInstance;
      values: MockInstance;
    };

    logLlmCall({
      db: errDb,
      requestId: 'req-1',
      stageLogId: 'sl-1',
      promptVersionId: 'pv-1',
      model: 'gpt-4',
      promptRendered: 'hello',
      responseRaw: null,
      inputTokens: null,
      outputTokens: null,
      latencyMs: 100,
      attempt: 1,
    });

    // logLlmCall is fire-and-forget — let the microtask queue drain so the
    // rejection reaches the .catch() handler.
    await new Promise((r) => setTimeout(r, 10));

    expect(consoleError).toHaveBeenCalledWith(
      '[trace] logLlmCall failed',
      expect.any(Error)
    );
  });
});

// ── 5. PIPELINE_TRACE_ENABLED=false → no-op ───────────────────────────────────

describe('PIPELINE_TRACE_ENABLED=false', () => {
  beforeEach(async () => {
    vi.stubEnv('PIPELINE_TRACE_ENABLED', 'false');
    vi.resetModules();
    const mod = await import('@/lib/ai/pipeline/trace');
    recordPromptVersion = mod.recordPromptVersion;
    logStage = mod.logStage;
    logLlmCall = mod.logLlmCall;
    _resetPromptVersionCacheForTests = mod._resetPromptVersionCacheForTests;
  });

  it('recordPromptVersion returns null without touching db', async () => {
    const insert = vi.fn();
    const db = { insert } as unknown as AppDb;
    const result = await recordPromptVersion({
      db,
      name: 'x',
      builder: () => '',
      templateSample: '',
      model: 'gpt-4',
    });
    expect(result).toBeNull();
    expect(insert).not.toHaveBeenCalled();
  });

  it('logStage does not call db.insert', () => {
    const insert = vi.fn();
    const db = { insert } as unknown as AppDb;
    logStage({
      db,
      requestId: 'r',
      stageLogId: 's',
      stage: 'nutrition',
      stageIndex: 2,
      inputJson: {},
      outputJson: {},
      status: 'success',
      durationMs: 1,
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it('logLlmCall does not call db.insert', () => {
    const insert = vi.fn();
    const db = { insert } as unknown as AppDb;
    logLlmCall({
      db,
      requestId: 'r',
      stageLogId: 's',
      promptVersionId: 'pv',
      model: 'm',
      promptRendered: 'p',
      responseRaw: null,
      inputTokens: null,
      outputTokens: null,
      latencyMs: 1,
      attempt: 1,
    });
    expect(insert).not.toHaveBeenCalled();
  });
});

// ── 6. Cache keyed by (name, hash) ────────────────────────────────────────────

describe('recordPromptVersion — cache keyed by (name, hash)', () => {
  it('different builders for same name yield different ids', async () => {
    // We need one db that returns different IDs depending on order of calls
    let callCount = 0;
    const returningFn = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve([{ id: callCount === 1 ? 'pv-A' : 'pv-B' }]);
    });
    const onConflictDoNothing = vi
      .fn()
      .mockReturnValue({ returning: returningFn });
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert, select: vi.fn() } as unknown as AppDb;

    const builderA = () => 'template A';
    const builderB = () => 'template B'; // different source → different hash

    const idA = await recordPromptVersion({
      db,
      name: 'same-name',
      builder: builderA,
      templateSample: 'tpl',
      model: 'gpt-4',
    });
    const idB = await recordPromptVersion({
      db,
      name: 'same-name',
      builder: builderB,
      templateSample: 'tpl',
      model: 'gpt-4',
    });

    expect(idA).toBe('pv-A');
    expect(idB).toBe('pv-B');
    // Two separate INSERT calls since hashes differ
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('same builder for same name is cached (only one INSERT)', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'pv-same' }]);
    const onConflictDoNothing = vi.fn().mockReturnValue({ returning });
    const values = vi.fn().mockReturnValue({ onConflictDoNothing });
    const insert = vi.fn().mockReturnValue({ values });
    const db = { insert, select: vi.fn() } as unknown as AppDb;

    const builder = () => 'identical template';

    const id1 = await recordPromptVersion({
      db,
      name: 'same-name',
      builder,
      templateSample: 'tpl',
      model: 'gpt-4',
    });
    const id2 = await recordPromptVersion({
      db,
      name: 'same-name',
      builder,
      templateSample: 'tpl',
      model: 'gpt-4',
    });

    expect(id1).toBe('pv-same');
    expect(id2).toBe('pv-same');
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
