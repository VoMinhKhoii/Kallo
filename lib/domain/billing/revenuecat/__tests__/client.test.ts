import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CUSTOMER_INFO_USER_ID, customerInfo } from './fixtures/customer-info';

vi.mock('server-only', () => ({}));

let fetchRevenueCatSnapshot: typeof import('../client').fetchRevenueCatSnapshot;

beforeAll(async () => {
  ({ fetchRevenueCatSnapshot } = await import('../client'));
});

const USER_ID = CUSTOMER_INFO_USER_ID;

describe('fetchRevenueCatSnapshot', () => {
  it('URL-encodes the customer id and sends the server API key', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(customerInfo()), { status: 200 })
    );
    await fetchRevenueCatSnapshot('user/with spaces', {
      apiKey: 'appl_public-key',
      fetch: fetchMock as typeof fetch,
      billingEnvironment: 'production',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.revenuecat.com/v1/subscribers/user%2Fwith%20spaces',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer appl_public-key',
        }),
      })
    );
  });

  it('surfaces provider HTTP failures as retryable processing errors', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 503 }));
    await expect(
      fetchRevenueCatSnapshot(USER_ID, {
        apiKey: 'appl_public-key',
        fetch: fetchMock as typeof fetch,
        billingEnvironment: 'production',
      })
    ).rejects.toThrow('revenuecat_http_503');
  });

  it('marks a 201 response as a newly created empty customer', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(customerInfo()), { status: 201 })
    );
    const snapshot = await fetchRevenueCatSnapshot(USER_ID, {
      apiKey: 'appl_public-key',
      fetch: fetchMock as typeof fetch,
      billingEnvironment: 'production',
    });
    expect(snapshot.customerCreated).toBe(true);
  });

  it.each([
    'sk_project-secret',
    'atk_project-secret',
    'server-key',
  ])('rejects non-public RevenueCat credentials before fetching (%s)', async (apiKey) => {
    const fetchMock = vi.fn();
    await expect(
      fetchRevenueCatSnapshot(USER_ID, {
        apiKey,
        fetch: fetchMock as typeof fetch,
        billingEnvironment: 'production',
      })
    ).rejects.toThrow('revenuecat_rest_api_key_invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows Test Store keys only in sandbox deployments', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(customerInfo()), { status: 200 })
    );
    await expect(
      fetchRevenueCatSnapshot(USER_ID, {
        apiKey: 'test_public-key',
        fetch: fetchMock as typeof fetch,
        billingEnvironment: 'production',
      })
    ).rejects.toThrow('revenuecat_rest_api_key_invalid');
    expect(fetchMock).not.toHaveBeenCalled();

    await fetchRevenueCatSnapshot(USER_ID, {
      apiKey: 'test_public-key',
      fetch: fetchMock as typeof fetch,
      billingEnvironment: 'sandbox',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
