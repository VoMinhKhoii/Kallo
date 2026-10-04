import { describe, expect, it } from 'vitest';
import {
  grantPremiumInputSchema,
  splitEmailList,
} from '@/lib/admin/premium/grant-input';

describe('grantPremiumInputSchema', () => {
  it('normalises and de-duplicates emails', () => {
    const parsed = grantPremiumInputSchema.parse({
      scope: 'users',
      days: '14',
      emails: ['A@x.com', ' a@x.com ', 'b@x.com'],
    });
    expect(parsed).toEqual({
      scope: 'users',
      days: 14,
      emails: ['a@x.com', 'b@x.com'],
    });
  });

  it.each([0, -3, 366, 1.5, 'abc'])('rejects %s days', (days) => {
    expect(
      grantPremiumInputSchema.safeParse({ scope: 'everyone', days }).success
    ).toBe(false);
  });

  it('accepts the 1 and 365 day bounds', () => {
    for (const days of [1, 365]) {
      expect(
        grantPremiumInputSchema.safeParse({ scope: 'everyone', days }).success
      ).toBe(true);
    }
  });

  it('rejects an empty, malformed or oversized email list', () => {
    const users = (emails: string[]) =>
      grantPremiumInputSchema.safeParse({ scope: 'users', days: 7, emails })
        .success;
    expect(users([])).toBe(false);
    expect(users(['not-an-email'])).toBe(false);
    expect(users(Array.from({ length: 101 }, (_, i) => `u${i}@x.com`))).toBe(
      false
    );
  });

  it('rejects an unknown scope', () => {
    expect(
      grantPremiumInputSchema.safeParse({ scope: 'admins', days: 7 }).success
    ).toBe(false);
  });
});

describe('splitEmailList', () => {
  it('splits on commas, semicolons, spaces and new lines', () => {
    expect(splitEmailList('a@x.com, b@x.com;c@x.com\n d@x.com  ')).toEqual([
      'a@x.com',
      'b@x.com',
      'c@x.com',
      'd@x.com',
    ]);
  });
});
