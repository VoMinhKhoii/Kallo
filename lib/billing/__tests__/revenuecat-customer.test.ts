import { describe, expect, it, vi } from 'vitest';
import { deleteRevenueCatCustomer } from '@/lib/billing/revenuecat-customer';

const CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';
const PROJECT_ID = 'proj5c917f9b';

describe('deleteRevenueCatCustomer', () => {
  it('deletes the URL-encoded customer with a v2 secret key', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));

    await deleteRevenueCatCustomer(CUSTOMER_ID, {
      apiKey: 'sk_test-secret',
      projectId: PROJECT_ID,
      fetch: fetchMock as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.revenuecat.com/v2/projects/${PROJECT_ID}/customers/${CUSTOMER_ID}`,
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({
          authorization: 'Bearer sk_test-secret',
        }),
      })
    );
  });

  it.each([
    200, 202, 404,
  ])('treats HTTP %s as an idempotent success', async (status) => {
    await expect(
      deleteRevenueCatCustomer(CUSTOMER_ID, {
        apiKey: 'sk_test-secret',
        projectId: PROJECT_ID,
        fetch: vi.fn(
          async () => new Response(null, { status })
        ) as typeof fetch,
      })
    ).resolves.toBeUndefined();
  });

  it('surfaces provider failures so local deletion can stop safely', async () => {
    await expect(
      deleteRevenueCatCustomer(CUSTOMER_ID, {
        apiKey: 'sk_test-secret',
        projectId: PROJECT_ID,
        fetch: vi.fn(
          async () => new Response(null, { status: 503 })
        ) as typeof fetch,
      })
    ).rejects.toThrow('revenuecat_customer_delete_http_503');
  });

  it.each([
    [{ projectId: PROJECT_ID }, 'revenuecat_customer_delete_api_key_missing'],
    [
      { apiKey: 'appl_public-key', projectId: PROJECT_ID },
      'revenuecat_customer_delete_api_key_invalid',
    ],
    [{ apiKey: 'sk_test-secret' }, 'revenuecat_project_id_missing_or_invalid'],
    [
      { apiKey: 'sk_test-secret', projectId: 'wrong' },
      'revenuecat_project_id_missing_or_invalid',
    ],
  ])('rejects invalid privileged configuration', async (deps, message) => {
    const fetchMock = vi.fn();
    await expect(
      deleteRevenueCatCustomer(CUSTOMER_ID, {
        ...deps,
        fetch: fetchMock as typeof fetch,
      })
    ).rejects.toThrow(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID customer before contacting RevenueCat', async () => {
    const fetchMock = vi.fn();
    await expect(
      deleteRevenueCatCustomer('not-a-kallo-user', {
        apiKey: 'sk_test-secret',
        projectId: PROJECT_ID,
        fetch: fetchMock as typeof fetch,
      })
    ).rejects.toThrow('revenuecat_customer_id_invalid');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
