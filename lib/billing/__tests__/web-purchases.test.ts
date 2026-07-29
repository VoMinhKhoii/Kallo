import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let createSerializedBillingRunner: typeof import('../web-purchases').createSerializedBillingRunner;

beforeAll(async () => {
  ({ createSerializedBillingRunner } = await import('../web-purchases'));
});

describe('web purchase operation serialization', () => {
  it('does not switch accounts until an in-flight purchase settles', async () => {
    const run = createSerializedBillingRunner();
    let releasePurchase: (() => void) | undefined;
    const order: string[] = [];

    const purchase = run(
      () =>
        new Promise<void>((resolve) => {
          order.push('purchase:start');
          releasePurchase = () => {
            order.push('purchase:end');
            resolve();
          };
        })
    );
    const accountSwitch = run(async () => {
      order.push('identity:B');
    });

    await vi.waitFor(() => expect(releasePurchase).toBeTypeOf('function'));
    expect(order).toEqual(['purchase:start']);
    releasePurchase?.();
    await Promise.all([purchase, accountSwitch]);
    expect(order).toEqual(['purchase:start', 'purchase:end', 'identity:B']);
  });
});
