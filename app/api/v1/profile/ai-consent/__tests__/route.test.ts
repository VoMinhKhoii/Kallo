import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Auth-before-body, malformed JSON and the 413 cap are covered for this route
// in `lib/api/__tests__/protected-body-routes.test.ts`; this file covers the
// contract the route owns: body shape in, stored consent state out.

const requireUserId = vi.fn();
const setAiProcessingConsent = vi.fn();

vi.mock('@/lib/api/auth', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/api/auth')>()),
  requireUserId,
}));
vi.mock('@/lib/actions/privacy/ai-consent', () => ({
  setAiProcessingConsent,
}));

const { PUT } = await import('@/app/api/v1/profile/ai-consent/route');

function put(body: unknown): NextRequest {
  return new Request('http://localhost/api/v1/profile/ai-consent', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  requireUserId.mockReset();
  requireUserId.mockResolvedValue('user-1');
  setAiProcessingConsent.mockReset();
});

describe('PUT /api/v1/profile/ai-consent', () => {
  it('records consent and returns the stored timestamp', async () => {
    setAiProcessingConsent.mockResolvedValue({
      aiProcessingConsentedAt: '2026-09-25T12:10:00.000Z',
    });

    const res = await PUT(put({ consented: true }));

    expect(res.status).toBe(200);
    expect(setAiProcessingConsent).toHaveBeenCalledWith(true);
    expect(await res.json()).toEqual({
      aiProcessingConsentedAt: '2026-09-25T12:10:00.000Z',
    });
  });

  it('withdraws consent and returns null', async () => {
    setAiProcessingConsent.mockResolvedValue({ aiProcessingConsentedAt: null });

    const res = await PUT(put({ consented: false }));

    expect(res.status).toBe(200);
    expect(setAiProcessingConsent).toHaveBeenCalledWith(false);
    expect(await res.json()).toEqual({ aiProcessingConsentedAt: null });
  });

  it.each([
    [{}],
    [{ consented: 'yes' }],
    [{ autoShareToCircle: true }],
  ])('answers 400 for %j without writing', async (body) => {
    const res = await PUT(put(body));

    expect(res.status).toBe(400);
    expect(setAiProcessingConsent).not.toHaveBeenCalled();
  });
});
