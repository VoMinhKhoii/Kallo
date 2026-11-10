import { describe, expect, it } from 'vitest';
import { ServerTiming } from '@/lib/infra/http/server-timing';

describe('ServerTiming', () => {
  it('measures completed and failed stages without changing their outcomes', async () => {
    let now = 0;
    const timing = new ServerTiming(() => now);
    await expect(
      timing.measure('auth', async () => {
        now += 12.5;
        return 'actor';
      })
    ).resolves.toBe('actor');
    const failure = new Error('database unavailable');
    await expect(
      timing.measure('page', async () => {
        now += 43;
        throw failure;
      })
    ).rejects.toBe(failure);
    expect(timing.toHeader()).toBe('auth;dur=12.5, page;dur=43.0');
    expect(timing.toJSON()).toEqual({ auth: 12.5, page: 43 });
    expect(new ServerTiming().toHeader()).toBe('');
  });
});
