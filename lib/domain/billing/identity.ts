export class BillingIdentityMismatchError extends Error {
  constructor() {
    super('The signed-in account changed. Refresh before purchasing.');
    this.name = 'BillingIdentityMismatchError';
  }
}

/**
 * Billing requests are keyed by a server-rendered user id, but browser auth
 * cookies can change in another tab. Bind every response to the freshly
 * authenticated server identity before caching data or opening checkout.
 */
export function assertBillingIdentity(
  expectedUserId: string,
  authenticatedUserId: unknown
): asserts authenticatedUserId is string {
  if (authenticatedUserId !== expectedUserId) {
    throw new BillingIdentityMismatchError();
  }
}
