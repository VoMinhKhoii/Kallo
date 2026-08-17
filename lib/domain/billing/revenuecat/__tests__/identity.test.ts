import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let getBillingEnvironmentForUser: typeof import('../identity').getBillingEnvironmentForUser;

beforeAll(async () => {
  ({ getBillingEnvironmentForUser } = await import('../identity'));
});

afterEach(() => {
  delete process.env.BILLING_SANDBOX_USER_IDS;
  delete process.env.BILLING_ENVIRONMENT;
});

const REVIEW_USER_ID = '11111111-1111-4111-8111-111111111111';

describe('getBillingEnvironmentForUser', () => {
  it('isolates sandbox projection to an explicitly allowlisted review UUID', () => {
    process.env.BILLING_ENVIRONMENT = 'production';
    process.env.BILLING_SANDBOX_USER_IDS = `${REVIEW_USER_ID},not-a-uuid`;

    expect(getBillingEnvironmentForUser(REVIEW_USER_ID)).toBe('sandbox');
    expect(
      getBillingEnvironmentForUser('22222222-2222-4222-8222-222222222222')
    ).toBe('production');
  });
});
