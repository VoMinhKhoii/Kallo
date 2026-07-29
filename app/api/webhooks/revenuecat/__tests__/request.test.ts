import { describe, expect, it } from 'vitest';
import {
  payloadForAudit,
  revenueCatBodySchema,
} from '@/app/api/webhooks/revenuecat/_lib/request';

describe('payloadForAudit', () => {
  it('stores only the explicit replay and identity envelope', () => {
    const parsed = revenueCatBodySchema.parse({
      provider_future_field: 'must-not-persist',
      event: {
        id: 'event-1',
        type: 'INITIAL_PURCHASE',
        event_timestamp_ms: 1_789_000_000_000,
        app_id: 'app-1',
        app_user_id: '11111111-1111-1111-1111-111111111111',
        original_app_user_id: '11111111-1111-1111-1111-111111111111',
        aliases: ['11111111-1111-1111-1111-111111111111'],
        environment: 'PRODUCTION',
        subscriber_attributes: { email: { value: 'private@example.test' } },
        provider_future_event_field: 'must-not-persist',
      },
    });

    const stored = payloadForAudit(parsed);

    expect(stored).toEqual({
      event: {
        id: 'event-1',
        type: 'INITIAL_PURCHASE',
        event_timestamp_ms: 1_789_000_000_000,
        app_id: 'app-1',
        app_user_id: '11111111-1111-1111-1111-111111111111',
        original_app_user_id: '11111111-1111-1111-1111-111111111111',
        aliases: ['11111111-1111-1111-1111-111111111111'],
        transferred_from: null,
        transferred_to: null,
        redeemed_from: null,
        redeemed_by: null,
        redemption_outcome: null,
        environment: 'PRODUCTION',
      },
    });
    expect(JSON.stringify(stored)).not.toContain('private@example.test');
    expect(JSON.stringify(stored)).not.toContain('provider_future');
  });
});
