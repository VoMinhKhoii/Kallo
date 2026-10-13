import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDiscard } = vi.hoisted(() => ({ mockDiscard: vi.fn() }));

vi.mock('@/lib/actions/meals/mutate-meal', () => ({
  discardPendingAnalysisAction: mockDiscard,
}));

import { DELETE } from '@/app/api/v1/meals/pending/[analysisId]/route';

const ANALYSIS_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

function call(analysisId = ANALYSIS_ID) {
  return DELETE({} as NextRequest, {
    params: Promise.resolve({ analysisId }),
  });
}

describe('DELETE /api/v1/meals/pending/[analysisId]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('answers 200 when the staged analysis is discarded', async () => {
    mockDiscard.mockResolvedValueOnce({ success: true });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it('keeps answering 400 for one already gone — the app reads that as deleted', async () => {
    // The action now RETURNS not_found (so web can tell it apart from a real
    // failure); the route must still speak the status mobile depends on.
    mockDiscard.mockResolvedValueOnce({ success: false, reason: 'not_found' });
    const res = await call();
    expect(res.status).toBe(400);
  });

  it('rejects an id that is not a uuid before touching the action', async () => {
    const res = await call('bad');
    expect(res.status).toBe(400);
    expect(mockDiscard).not.toHaveBeenCalled();
  });
});
