import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
const assertRateLimit = vi.fn();
const acquireSpendLease = vi.fn();
const settle = vi.fn(async (_cost: number | null) => undefined);
const runDecompositionDebugStep = vi.fn();
const runDbLookupDebugStep = vi.fn();
const runNutritionDebugStep = vi.fn();
const runAssemblyDebugStep = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
vi.mock('@/lib/admin/authz/is-admin', () => ({
  isAdminEmail: (email?: string) => email === 'admin@kallo.fit',
}));
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  assertRateLimit: (...args: unknown[]) => assertRateLimit(...args),
  acquireSpendLease: (...args: unknown[]) => acquireSpendLease(...args),
}));
vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [{ userId: 'a' }] }) }),
    }),
  },
}));
vi.mock('@/lib/ai/adapters/user-context', () => ({
  buildUserContext: () => ({}),
}));
vi.mock('@/lib/ai/provider/provider', () => ({
  createPipelineLlm: () => ({}),
  resolveGeminiProvider: () => ({}),
}));
vi.mock('../step-decomposition', () => ({
  runDecompositionDebugStep: (...a: unknown[]) =>
    runDecompositionDebugStep(...a),
}));
vi.mock('../step-db-lookup', () => ({
  runDbLookupDebugStep: (...a: unknown[]) => runDbLookupDebugStep(...a),
}));
vi.mock('../step-nutrition-assembly', () => ({
  runNutritionDebugStep: (...a: unknown[]) => runNutritionDebugStep(...a),
  runAssemblyDebugStep: (...a: unknown[]) => runAssemblyDebugStep(...a),
}));

const { POST } = await import('../route');
const { Errors } = await import('@/lib/core/errors/catalog');
const { meterAttemptSpend } = await import('@/lib/ai/cost/spend-meter');

function request() {
  return new Request('http://localhost/api/analyze-meal/debug', {
    method: 'POST',
    body: JSON.stringify({ input: 'phở bò' }),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({
    data: { user: { id: 'admin-1', email: 'admin@kallo.fit' } },
  });
  assertRateLimit.mockResolvedValue(undefined);
  acquireSpendLease.mockResolvedValue({ release: settle, addLate: vi.fn() });
  runDecompositionDebugStep.mockImplementation(async () => {
    meterAttemptSpend('gemini-3.1-flash-lite', {
      inputTokens: 1000,
      outputTokens: 100,
      cachedTokens: 0,
      cacheWriteTokens: 0,
      thoughtTokens: 0,
    });
    return { step1: {}, decomposition: {} };
  });
  runDbLookupDebugStep.mockResolvedValue({
    step2: {},
    matched: [],
    unmatched: [],
  });
  runNutritionDebugStep.mockResolvedValue({ step3: {}, nutritionAdj: {} });
  runAssemblyDebugStep.mockReturnValue({ result: null });
});

describe('POST /api/analyze-meal/debug — AI spend brake', () => {
  it('reserves a debug run and settles what its calls cost', async () => {
    const res = await POST(request());

    expect(res.status).toBe(200);
    expect(acquireSpendLease).toHaveBeenCalledWith('debug', { enforce: true });
    expect(settle).toHaveBeenCalledOnce();
    expect(settle.mock.calls[0][0]).toBeCloseTo(0.0004, 10);
  });

  it('refuses with the RATE_LIMITED 429 before any model call once the brake trips', async () => {
    acquireSpendLease.mockRejectedValue(Errors.aiPaused(600));

    const res = await POST(request());

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('600');
    expect((await res.json()).error.code).toBe('RATE_LIMITED');
    expect(runDecompositionDebugStep).not.toHaveBeenCalled();
  });

  it('settles even when a step throws', async () => {
    runNutritionDebugStep.mockRejectedValue(new Error('gemini boom'));

    await expect(POST(request())).rejects.toThrow('gemini boom');
    expect(settle).toHaveBeenCalledOnce();
  });
});
