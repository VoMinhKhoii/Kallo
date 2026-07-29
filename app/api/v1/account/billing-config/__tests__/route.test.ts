import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAuthAndProfile = vi.fn();

vi.mock('@/lib/auth', () => ({ requireAuthAndProfile }));

const { GET } = await import('@/app/api/v1/account/billing-config/route');

beforeEach(() => {
  requireAuthAndProfile.mockReset();
  requireAuthAndProfile.mockResolvedValue({ user: { id: 'user-1' } });
  process.env.BILLING_ENVIRONMENT = 'sandbox';
  delete process.env.REVENUECAT_WEB_API_KEY;
  process.env.BILLING_PURCHASES_ENABLED = 'true';
  delete process.env.BILLING_SANDBOX_USER_IDS;
});

describe('GET /api/v1/account/billing-config', () => {
  it.each([
    'rcb_publicClient123',
    'test_publicClient123',
  ])('exposes supported public RevenueCat key %s', async (apiKey) => {
    process.env.REVENUECAT_WEB_API_KEY = apiKey;

    const response = await GET();

    expect(await response.json()).toEqual({
      userId: 'user-1',
      purchasesEnabled: true,
      available: true,
      apiKey,
    });
  });

  it.each([
    'sk_secretServerKey',
    'atk_secretApiKey',
    'appl_wrongPlatform',
    'not-a-revenuecat-key',
  ])('never exposes unsupported or secret-looking key %s', async (apiKey) => {
    process.env.REVENUECAT_WEB_API_KEY = apiKey;

    const response = await GET();

    expect(await response.json()).toEqual({
      userId: 'user-1',
      purchasesEnabled: true,
      available: false,
      apiKey: null,
    });
  });

  it('rejects a Test Store key in production', async () => {
    process.env.BILLING_ENVIRONMENT = 'production';
    process.env.REVENUECAT_WEB_API_KEY = 'test_publicClient123';

    const response = await GET();

    expect(await response.json()).toEqual({
      userId: 'user-1',
      purchasesEnabled: true,
      available: false,
      apiKey: null,
    });
  });

  it('withholds the client key while purchases are dark', async () => {
    process.env.BILLING_PURCHASES_ENABLED = 'false';
    process.env.REVENUECAT_WEB_API_KEY = 'rcb_publicClient123';

    const response = await GET();

    expect(await response.json()).toEqual({
      userId: 'user-1',
      purchasesEnabled: false,
      available: false,
      apiKey: null,
    });
  });
});
