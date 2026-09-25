import { beforeEach, describe, expect, it, vi } from 'vitest';

// App Store 5.1.2(i): agreeing stamps ai_processing_consented_at; withdrawing
// clears it, which is what re-arms the server-side gate.

const { mockGetUser, mockSet, mockReturning } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSet: vi.fn(),
  mockReturning: vi.fn(),
}));

vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    update: () => ({
      set: (values: unknown) => {
        mockSet(values);
        return { where: () => ({ returning: mockReturning }) };
      },
    }),
  },
}));

import { setAiProcessingConsent } from '@/lib/actions/privacy/ai-consent';

const USER_ID = '9d1f2c44-7b3e-4a55-9c22-1aa2bb334455';

describe('setAiProcessingConsent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
  });

  it('stamps the consent time on agreement and returns it as ISO', async () => {
    mockReturning.mockImplementation(async () => [
      { consentedAt: mockSet.mock.calls[0][0].aiProcessingConsentedAt },
    ]);
    const before = Date.now();

    const result = await setAiProcessingConsent(true);

    const values = mockSet.mock.calls[0][0] as {
      aiProcessingConsentedAt: Date | null;
    };
    expect(values.aiProcessingConsentedAt).toBeInstanceOf(Date);
    expect(values.aiProcessingConsentedAt?.getTime()).toBeGreaterThanOrEqual(
      before
    );
    expect(result.aiProcessingConsentedAt).toBe(
      values.aiProcessingConsentedAt?.toISOString()
    );
  });

  it('clears the consent on withdrawal', async () => {
    mockReturning.mockResolvedValue([{ consentedAt: null }]);

    const result = await setAiProcessingConsent(false);

    expect(mockSet.mock.calls[0][0]).toMatchObject({
      aiProcessingConsentedAt: null,
    });
    expect(result).toEqual({ aiProcessingConsentedAt: null });
  });

  it('rejects a non-boolean from a direct caller before touching the DB', async () => {
    await expect(setAiProcessingConsent('yes' as never)).rejects.toThrow();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('refuses an unauthenticated caller', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(setAiProcessingConsent(true)).rejects.toThrow();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('reports a missing profile as PROFILE_NOT_FOUND', async () => {
    mockReturning.mockResolvedValue([]);

    await expect(setAiProcessingConsent(true)).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });
});
