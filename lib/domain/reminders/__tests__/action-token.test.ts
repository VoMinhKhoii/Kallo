import { describe, expect, it } from 'vitest';
import {
  ACTION_TOKEN_TTL_MS,
  signCloseDayToken,
  verifyCloseDayToken,
} from '@/lib/domain/reminders/action-token';

const SECRET = 'test-reminder-secret';
const USER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const NOW = new Date('2026-11-04T14:00:00Z');

describe('close-day action token', () => {
  const day = {
    userId: USER,
    date: '2026-11-04',
    dayStart: new Date('2026-11-03T17:00:00Z'),
    dayEnd: new Date('2026-11-04T17:00:00Z'),
  };
  const token = signCloseDayToken(SECRET, { ...day, now: NOW });

  it('round-trips the user, the day and its bounds', () => {
    expect(verifyCloseDayToken(SECRET, token, NOW)).toEqual(day);
  });

  it('refuses another secret', () => {
    expect(verifyCloseDayToken('other', token, NOW)).toBeNull();
  });

  it('refuses a token whose day or user was swapped', () => {
    const [, , start, end, expires, sig] = token.split('.');
    const forged = (user: string, date: string, from = start) =>
      `${user}.${date}.${from}.${end}.${expires}.${sig}`;
    expect(
      verifyCloseDayToken(SECRET, forged(USER, '2026-11-03'), NOW)
    ).toBeNull();
    const other = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    expect(
      verifyCloseDayToken(SECRET, forged(other, '2026-11-04'), NOW)
    ).toBeNull();
    // Nor can the bounds be widened to pull in another day's meals.
    expect(
      verifyCloseDayToken(SECRET, forged(USER, '2026-11-04', '0'), NOW)
    ).toBeNull();
  });

  it('expires', () => {
    const later = new Date(NOW.getTime() + ACTION_TOKEN_TTL_MS + 1000);
    expect(verifyCloseDayToken(SECRET, token, later)).toBeNull();
  });

  it('refuses junk without throwing', () => {
    for (const junk of [
      '',
      'a.b.c.d.e.f',
      `${USER}.2026-11-04.1.2.x.y`,
      'no-dots',
    ]) {
      expect(verifyCloseDayToken(SECRET, junk, NOW)).toBeNull();
    }
  });
});
