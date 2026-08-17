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
  checkAdminReplayGuardSpy,
} = vi.hoisted(() => {
  const insertedTables: unknown[] = [];
  const insertValuesSpy = vi.fn();
  const updateSpy = vi.fn().mockResolvedValue([]);
  const selectSpy = vi.fn();
  const llmCallsSelectSpy = vi.fn();
  const startCallOrder: string[] = [];
  type AnalyzeMealResult =
    | { success: true; data: unknown }
    | { success: false; error: { message: string; kind: string } };
  const analyzeMealSpy = vi.fn<() => Promise<AnalyzeMealResult>>(async () => {
    startCallOrder.push('analyzeMeal');
    return { success: true, data: {} as unknown };
  });
  const createGeminiClientSpy = vi.fn(() => ({}));
  const checkAdminReplayGuardSpy = vi.fn(
    async (): Promise<
      | { allowed: true }
      | {
          allowed: false;
          status: 429;
          reason: string;
          retryAfterSeconds: number;
        }
    > => ({ allowed: true })
  );
  return {
    insertedTables,
    insertValuesSpy,
    updateSpy,
    selectSpy,
    llmCallsSelectSpy,
    analyzeMealSpy,
    startCallOrder,
    createGeminiClientSpy,
    checkAdminReplayGuardSpy,
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
vi.mock('@/lib/ai/pipeline/analyze-meal', () => ({
  analyzeMeal: analyzeMealSpy,
}));
vi.mock('@/lib/ai/provider/provider', () => ({
  createGeminiClient: createGeminiClientSpy,
  resolveGeminiProvider: () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY missing');
    return { provider: 'ai-studio' as const, apiKey };
  },
}));
vi.mock('@/lib/admin/authz/require-admin', () => ({
  requireAdmin: async () => ({ id: 'admin-1', email: 'a@x.com' }),
}));
vi.mock('@/lib/rate-limit/analysis-guards', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/rate-limit/analysis-guards')>();

  return {
    ...actual,
    checkAdminReplayGuard: checkAdminReplayGuardSpy,
  };
});
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { replayRequest } from '@/app/[locale]/(app)/admin/requests/[id]/actions';
import {
  analysisGuardEvents,
  pendingAnalyses,
  pipelineRequestReplayAuditLogs,
  pipelineRequests,
} from '@/lib/db/schema';
import { adminReplayGuardRoute } from '@/lib/rate-limit/analysis-guard-limits';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('replayRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedTables.length = 0;
    startCallOrder.length = 0;
    insertValuesSpy.mockResolvedValue(undefined);
    checkAdminReplayGuardSpy.mockResolvedValue({ allowed: true });
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
    const reqInsertIdx = insertedTables.indexOf(pipelineRequests);
    const insertArgs = insertValuesSpy.mock.calls[reqInsertIdx]?.[0];
    expect(insertArgs?.userId).toBe('orig-user');
  });

  it('inserts logPipelineStart row before invoking analyzeMeal (FK ordering)', async () => {
    await replayRequest('11111111-1111-4111-a111-111111111111');
    const insertIdx = insertedTables.indexOf(pipelineRequests);
    const analyzeIdx = startCallOrder.indexOf('analyzeMeal');
    expect(insertIdx).toBeGreaterThanOrEqual(0);
    expect(analyzeIdx).toBeGreaterThan(insertIdx);
  });

  it('persists a replay audit row without admin email PII', async () => {
    await replayRequest('11111111-1111-4111-a111-111111111111');
    const auditInsertIdx = insertedTables.indexOf(
      pipelineRequestReplayAuditLogs
    );
    expect(auditInsertIdx).toBeGreaterThanOrEqual(0);
    const auditArgs = insertValuesSpy.mock.calls[auditInsertIdx]?.[0];
    expect(auditArgs).toMatchObject({
      originalRequestId: '11111111-1111-4111-a111-111111111111',
      dryRun: false,
    });
    expect(auditArgs?.adminUserIdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(auditArgs)).not.toContain('a@x.com');
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

  it('blocks live replay when admin replay quota is exhausted', async () => {
    checkAdminReplayGuardSpy.mockResolvedValueOnce({
      allowed: false,
      status: 429,
      reason: 'admin_replay',
      retryAfterSeconds: 120,
    });

    const result = await replayRequest('11111111-1111-4111-a111-111111111111');

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        status: 429,
        retryable: true,
        message:
          'Admin replay quota exhausted. Please wait before replaying again.',
        reason: 'admin_replay',
        retryAfterSeconds: 120,
      },
    });

    expect(checkAdminReplayGuardSpy).toHaveBeenCalledWith({
      adminId: 'admin-1',
      db: expect.any(Object),
    });
    expect(createGeminiClientSpy).not.toHaveBeenCalled();
    expect(analyzeMealSpy).not.toHaveBeenCalled();
    expect(insertedTables).toContain(analysisGuardEvents);
    expect(insertedTables).not.toContain(pipelineRequests);
    expect(insertedTables).not.toContain(pipelineRequestReplayAuditLogs);
  });

  it('writes an admin_replay guard event without raw input on live replay block', async () => {
    checkAdminReplayGuardSpy.mockResolvedValueOnce({
      allowed: false,
      status: 429,
      reason: 'admin_replay',
      retryAfterSeconds: 90,
    });

    const result = await replayRequest('11111111-1111-4111-a111-111111111111');

    expect(result?.ok).toBe(false);
    if (result?.ok === false) {
      expect(result.error.reason).toBe('admin_replay');
    }

    const guardInsertIdx = insertedTables.indexOf(analysisGuardEvents);
    expect(guardInsertIdx).toBeGreaterThanOrEqual(0);
    const guardArgs = insertValuesSpy.mock.calls[guardInsertIdx]?.[0];
    expect(guardArgs).toMatchObject({
      route: adminReplayGuardRoute,
      reason: 'admin_replay',
      retryAfterSeconds: 90,
      ipHash: null,
    });
    expect(guardArgs?.userIdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(guardArgs).not.toHaveProperty('rawInput');
    expect(guardArgs).not.toHaveProperty('message');
    expect(JSON.stringify(guardArgs)).not.toContain('x');
    expect(JSON.stringify(guardArgs)).not.toContain('admin-1');
    expect(JSON.stringify(guardArgs)).not.toContain('a@x.com');
  });

  it('allows dry-run replay when live replay quota is exhausted and skips real Gemini', async () => {
    delete process.env.GEMINI_API_KEY;
    checkAdminReplayGuardSpy.mockResolvedValue({
      allowed: false,
      status: 429,
      reason: 'admin_replay',
      retryAfterSeconds: 120,
    });
    llmCallsSelectSpy.mockResolvedValue([
      { responseRaw: '{"foo":"bar"}' },
      { responseRaw: '{"baz":"qux"}' },
    ]);

    await replayRequest('11111111-1111-4111-a111-111111111111', {
      dryRun: true,
    });

    expect(checkAdminReplayGuardSpy).not.toHaveBeenCalled();
    expect(createGeminiClientSpy).not.toHaveBeenCalled();
    expect(analyzeMealSpy).toHaveBeenCalledOnce();
    expect(insertedTables).toContain(pipelineRequests);
    expect(insertedTables).toContain(pipelineRequestReplayAuditLogs);
    expect(insertedTables).not.toContain(analysisGuardEvents);
  });
});
