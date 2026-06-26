import { describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/lib/db';

vi.mock('@/lib/db/schema', () => ({
  pipelineRequests: { id: 'id' },
}));

// Helper to build a db mock that captures the last SET payload
function makeMockDb() {
  let capturedSet: Record<string, unknown> | null = null;

  const catchFn = vi.fn().mockReturnValue(undefined);
  const where = vi.fn().mockReturnValue({ catch: catchFn });
  const set = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
    capturedSet = payload;
    return { where };
  });
  const update = vi.fn().mockReturnValue({ set });

  return {
    db: { update } as unknown as AppDb,
    getCapturedSet: () => capturedSet,
    set,
    catchFn,
  };
}

// Import after mocks
const { logPipelineEnd } = await import('@/lib/ai/pipeline/telemetry/logging');

describe('logPipelineEnd', () => {
  it('includes promptVersionsUsed in SET when provided with data', () => {
    const { db, getCapturedSet } = makeMockDb();

    logPipelineEnd('req-1', 'success', 100, db, undefined, {
      decomposition: 'v-abc123',
      nutrition: 'v-def456',
    });

    const payload = getCapturedSet();
    expect(payload).not.toBeNull();
    expect(payload?.promptVersionsUsed).toEqual({
      decomposition: 'v-abc123',
      nutrition: 'v-def456',
    });
  });

  it('leaves promptVersionsUsed null when not provided', () => {
    const { db, getCapturedSet } = makeMockDb();

    logPipelineEnd('req-1', 'error', 50, db, 'boom');

    const payload = getCapturedSet();
    expect(payload).not.toBeNull();
    expect(payload?.promptVersionsUsed).toBeUndefined();
  });

  it('leaves promptVersionsUsed null when passed null', () => {
    const { db, getCapturedSet } = makeMockDb();

    logPipelineEnd('req-1', 'success', 200, db, undefined, null);

    const payload = getCapturedSet();
    expect(payload).not.toBeNull();
    expect(payload?.promptVersionsUsed).toBeUndefined();
  });

  it('is a no-op when requestId is null', () => {
    const { db, set } = makeMockDb();

    logPipelineEnd(null, 'success', 100, db);

    expect(set).not.toHaveBeenCalled();
  });
});
