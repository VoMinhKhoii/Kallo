import { describe, expect, it } from 'vitest';
import {
  endInputSchema,
  giveInputSchema,
} from '@/lib/admin/premium/grants/grant-input';

const ID = '11111111-1111-4111-a111-111111111111';

describe('giveInputSchema', () => {
  const base = {
    who: { kind: 'users', userIds: [ID, ID] },
    length: { unit: 'days', days: '14' },
    mode: 'extend',
    reason: ' Launch apology ',
  } as const;

  it('dedupes accounts, coerces days and trims the reason', () => {
    expect(giveInputSchema.parse(base)).toEqual({
      who: { kind: 'users', userIds: [ID] },
      length: { unit: 'days', days: 14 },
      mode: 'extend',
      reason: 'Launch apology',
    });
  });

  it.each([0, 366, 1.5])('rejects %s days', (days) => {
    expect(
      giveInputSchema.safeParse({ ...base, length: { unit: 'days', days } })
        .success
    ).toBe(false);
  });

  it('rejects dates that do not exist, before they reach Postgres', () => {
    const until = (date: string) =>
      giveInputSchema.safeParse({
        ...base,
        length: { unit: 'until', until: date },
      }).success;
    const joined = (date: string) =>
      giveInputSchema.safeParse({
        ...base,
        who: { kind: 'group', plan: 'free', joinedFrom: date },
      }).success;
    expect(until('2026-02-30')).toBe(false);
    expect(until('2028-02-29')).toBe(true);
    expect(joined('2026-13-01')).toBe(false);
    expect(joined('2026-10-04')).toBe(true);
  });

  it('requires a reason and at least one picked account', () => {
    expect(giveInputSchema.safeParse({ ...base, reason: ' ' }).success).toBe(
      false
    );
    expect(
      giveInputSchema.safeParse({
        ...base,
        who: { kind: 'users', userIds: [] },
      }).success
    ).toBe(false);
  });

  it('needs EVERYONE typed to give everyone Premium', () => {
    const everyone = { ...base, who: { kind: 'everyone' } };
    expect(giveInputSchema.safeParse(everyone).success).toBe(false);
    expect(
      giveInputSchema.safeParse({ ...everyone, confirm: 'EVERYONE' }).success
    ).toBe(true);
  });

  it('accepts a group with a signup window', () => {
    expect(
      giveInputSchema.safeParse({
        ...base,
        who: {
          kind: 'group',
          plan: 'free',
          joinedFrom: '2026-09-01',
          joinedTo: '2026-09-30',
        },
      }).success
    ).toBe(true);
  });
});

describe('endInputSchema', () => {
  it('needs END typed to end free Premium for everyone', () => {
    const everyone = { who: { kind: 'everyone' }, reason: 'Promo over' };
    expect(endInputSchema.safeParse(everyone).success).toBe(false);
    expect(
      endInputSchema.safeParse({ ...everyone, confirm: 'END' }).success
    ).toBe(true);
    expect(
      endInputSchema.safeParse({
        who: { kind: 'users', userIds: [ID] },
        reason: 'Abuse report',
      }).success
    ).toBe(true);
  });
});
