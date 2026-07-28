import 'server-only';

import { z } from 'zod';

const projectIdSchema = z.string().regex(/^proj[0-9a-z]+$/i);
const customerIdSchema = z.string().uuid();

interface DeleteRevenueCatCustomerDeps {
  apiKey?: string;
  fetch?: typeof fetch;
  projectId?: string;
}

/**
 * Erase the authenticated Kallo user from RevenueCat before local account
 * deletion. This does not cancel App Store or Play Store billing, but it does
 * cancel RevenueCat Billing subscriptions immediately. Both outcomes are
 * disclosed in the deletion UI.
 */
export async function deleteRevenueCatCustomer(
  customerId: string,
  deps: DeleteRevenueCatCustomerDeps = {}
): Promise<void> {
  const apiKey = deps.apiKey ?? process.env.REVENUECAT_CUSTOMER_DELETE_API_KEY;
  const projectId = deps.projectId ?? process.env.REVENUECAT_PROJECT_ID;
  if (!apiKey) {
    throw new Error('revenuecat_customer_delete_api_key_missing');
  }
  if (!apiKey.startsWith('sk_')) {
    throw new Error('revenuecat_customer_delete_api_key_invalid');
  }
  if (!projectId || !projectIdSchema.safeParse(projectId).success) {
    throw new Error('revenuecat_project_id_missing_or_invalid');
  }
  if (!customerIdSchema.safeParse(customerId).success) {
    throw new Error('revenuecat_customer_id_invalid');
  }

  const fetchImpl = deps.fetch ?? fetch;
  const response = await fetchImpl(
    `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(customerId)}`,
    {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    }
  );

  // RevenueCat may queue deletion (202). A missing customer is already in the
  // desired erased state, making retries idempotent.
  if (
    response.status === 200 ||
    response.status === 202 ||
    response.status === 404
  ) {
    return;
  }
  throw new Error(`revenuecat_customer_delete_http_${response.status}`);
}
