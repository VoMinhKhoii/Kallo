import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAuthAndProfile = vi.fn();

vi.mock('@/lib/auth/session', () => ({ requireAuthAndProfile }));

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
    // Paddle-backed web config — the shape RevenueCat issues for Kallo today.
    'pdl_RiMPLBuAhksjLUoUkOgYyiQYhsnz',
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
    // Paddle's SERVER secret shares the `pdl_` prefix with the public web key.
    // Only the underscores in `_apikey_` keep it out — if this pattern is ever
    // loosened, a misconfigured env var would ship the secret to every browser.
    'pdl_sdbx_apikey_01exampleid_examplesecretvalue',
    'pdl_live_apikey_01exampleid_examplesecretvalue',
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

  it('withholds the production key from a sandbox user on a production deploy', async () => {
    // App Review accounts resolve to the sandbox environment even in
    // production. Handing them the production web key would open checkout in
    // the production Paddle account while the server reconciles the sandbox
    // one, so the payment succeeds in a catalog the projection never reads.
    process.env.BILLING_ENVIRONMENT = 'production';
    process.env.BILLING_SANDBOX_USER_IDS = 'user-1';
    process.env.REVENUECAT_WEB_API_KEY = 'pdl_productionClientKey';
    requireAuthAndProfile.mockResolvedValue({
      user: { id: '11111111-1111-4111-8111-111111111111' },
    });
    process.env.BILLING_SANDBOX_USER_IDS =
      '11111111-1111-4111-8111-111111111111';

    const response = await GET();

    expect(await response.json()).toEqual({
      userId: '11111111-1111-4111-8111-111111111111',
      purchasesEnabled: true,
      available: false,
      apiKey: null,
    });
  });

  it('serves the sandbox key to a sandbox user on a production deploy', async () => {
    process.env.BILLING_ENVIRONMENT = 'production';
    process.env.REVENUECAT_WEB_API_KEY = 'pdl_productionClientKey';
    process.env.REVENUECAT_WEB_API_KEY_SANDBOX = 'pdl_sandboxClientKey';
    requireAuthAndProfile.mockResolvedValue({
      user: { id: '11111111-1111-4111-8111-111111111111' },
    });
    process.env.BILLING_SANDBOX_USER_IDS =
      '11111111-1111-4111-8111-111111111111';

    const response = await GET();

    expect(await response.json()).toMatchObject({
      available: true,
      apiKey: 'pdl_sandboxClientKey',
    });
    delete process.env.REVENUECAT_WEB_API_KEY_SANDBOX;
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
