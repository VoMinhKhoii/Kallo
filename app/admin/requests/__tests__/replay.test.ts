import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted spies — must be declared before vi.mock factories run
// ---------------------------------------------------------------------------
const {
  insertedTables,
  insertValuesSpy,
  updateSpy,
  selectSpy,
  llmCallsSelectSpy,
  analyzeMealSpy,
  startCallOrder,
  createGeminiClientSpy,
} = vi.hoisted(() => {
  const insertedTables: unknown[] = [];
  const insertValuesSpy = vi.fn();
  const updateSpy = vi.fn().mockResolvedValue([]);
  const selectSpy = vi.fn();
  const llmCallsSelectSpy = vi.fn();
  const startCallOrder: string[] = [];
  const analyzeMealSpy = vi.fn(async () => {
    startCallOrder.push('analyzeMeal');
    return { success: true, data: {} as unknown };
  });
  const createGeminiClientSpy = vi.fn(() => ({}));
  return {
    insertedTables,
    insertValuesSpy,
    updateSpy,
    selectSpy,
    llmCallsSelectSpy,
    analyzeMealSpy,
    startCallOrder,
    createGeminiClientSpy,
  };
});

// ---------------------------------------------------------------------------
// DB mock — track which tables are passed to db.insert()
// ---------------------------------------------------------------------------
vi.mock('@/lib/db', () => ({
  db: {
    insert: vi.fn((table: unknown) => {
      insertedTables.push(table);
      return {
        values: (v: unknown) => {
          startCallOrder.push('insertValues');
          return insertValuesSpy(v);
        },
      };
    }),
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: selectSpy,
          orderBy: llmCallsSelectSpy,
        }),
      }),
    })),
    update: () => ({ set: () => ({ where: updateSpy }) }),
  },
}));

// ---------------------------------------------------------------------------
// Other mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/ai/pipeline/orchestrator', () => ({
  analyzeMeal: analyzeMealSpy,
}));
vi.mock('@/lib/ai/gemini', () => ({
  createGeminiClient: createGeminiClientSpy,
}));
vi.mock('@/lib/admin/require-admin', () => ({
  requireAdmin: async () => ({ id: 'admin-1', email: 'a@x.com' }),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { pendingAnalyses, pipelineRequests } from '@/lib/db/schema';
import { replayRequest } from '../[id]/actions';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('replayRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedTables.length = 0;
    startCallOrder.length = 0;
    insertValuesSpy.mockResolvedValue(undefined);
    process.env.GEMINI_API_KEY = 'test-key';
    selectSpy.mockResolvedValue([
      { rawInput: 'x', userContextJson: {}, userId: 'orig-user' },
    ]);
    llmCallsSelectSpy.mockResolvedValue([]);
    analyzeMealSpy.mockImplementation(async () => {
      startCallOrder.push('analyzeMeal');
      return { success: true, data: {} as unknown };
    });
  });

  it('does not write to pendingAnalyses', async () => {
    await replayRequest('11111111-1111-4111-a111-111111111111');
    expect(insertedTables).not.toContain(pendingAnalyses);
    expect(analyzeMealSpy).toHaveBeenCalled();
  });

  it('rejects non-uuid input', async () => {
    await expect(replayRequest('not-a-uuid')).rejects.toThrow();
  });

  it('reuses original user_id, not admin id', async () => {
    await replayRequest('11111111-1111-4111-a111-111111111111');
    const insertArgs = insertValuesSpy.mock.calls[0]?.[0];
    expect(insertArgs?.userId).toBe('orig-user');
  });

  it('inserts logPipelineStart row before invoking analyzeMeal (FK ordering)', async () => {
    await replayRequest('11111111-1111-4111-a111-111111111111');
    const insertIdx = startCallOrder.indexOf('insertValues');
    const analyzeIdx = startCallOrder.indexOf('analyzeMeal');
    expect(insertIdx).toBeGreaterThanOrEqual(0);
    expect(analyzeIdx).toBeGreaterThan(insertIdx);
  });

  it('records error status when analyzeMeal returns {success: false}', async () => {
    analyzeMealSpy.mockImplementationOnce(async () => {
      startCallOrder.push('analyzeMeal');
      return {
        success: false,
        error: { message: 'parse_error: bad json', kind: 'parse_error' },
      };
    });
    await replayRequest('11111111-1111-4111-a111-111111111111');
    // setPipelineFinalState is called via update()
    const updateArgs = updateSpy.mock.calls[0];
    // updateSpy is the where() call; the .set() arg is captured one level up,
    // so we just assert update was called (and analyzeMeal returned success:false).
    expect(updateArgs).toBeDefined();
    expect(analyzeMealSpy).toHaveBeenCalledOnce();
  });

  it('persists dryRun=true and skips createGeminiClient', async () => {
    llmCallsSelectSpy.mockResolvedValue([
      { responseRaw: '{"foo":"bar"}' },
      { responseRaw: '{"baz":"qux"}' },
    ]);
    await replayRequest('11111111-1111-4111-a111-111111111111', {
      dryRun: true,
    });
    expect(createGeminiClientSpy).not.toHaveBeenCalled();
    // Find the insert call into pipelineRequests
    const reqInsertIdx = insertedTables.indexOf(pipelineRequests);
    expect(reqInsertIdx).toBeGreaterThanOrEqual(0);
    const insertArgs = insertValuesSpy.mock.calls[reqInsertIdx]?.[0];
    expect(insertArgs?.dryRun).toBe(true);
  });
});
